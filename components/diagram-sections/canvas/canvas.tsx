"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useEditorStore } from "@/store/useEditorStore";
import { useCanvasStore } from "@/store/useCanvasStore";
import { WorldBackground } from "@/components/diagram-general/canvas-world-background";
import { Minimap } from "./minimap";
import { TableNode } from "./table-node";

const WORLD_WIDTH = 6000;
const WORLD_HEIGHT = 6000;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function CanvasStage() {
  const rootRef = useRef<HTMLDivElement>(null);

  const background = useCanvasStore((s) => s.background);
  const tables = useCanvasStore((s) => s.tables);
  const selectedTableId = useCanvasStore((s) => s.selectedTableId);
  const setSelectedTableId = useCanvasStore((s) => s.setSelectedTableId);

  const camera = useEditorStore((s) => s.camera);
  const panBy = useEditorStore((s) => s.panBy);
  const zoomAt = useEditorStore((s) => s.zoomAt);

  const setViewportStore = useEditorStore((s) => s.setViewport);
  const setWorldStore = useEditorStore((s) => s.setWorld);
  const setCameraXY = useEditorStore((s) => s.setCameraXY);

  const [viewport, setViewport] = useState({ w: 1, h: 1 });

  // Tell store the world bounds (so clamping uses the same world as the grid)
  useEffect(() => {
    setWorldStore(WORLD_WIDTH, WORLD_HEIGHT);
  }, [setWorldStore]);

  // Measure viewport (so minimap + zoomAt math is correct) + inform store (for clamping)
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const update = () => {
      const r = el.getBoundingClientRect();
      setViewport({ w: r.width, h: r.height });
      setViewportStore(r.width, r.height);
    };

    const ro = new ResizeObserver(update);
    ro.observe(el);

    update();

    return () => ro.disconnect();
  }, [setViewportStore]);

  // Space-to-pan
  const [spaceDown, setSpaceDown] = useState(false);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;

      const t = e.target as HTMLElement | null;
      const isTyping =
        t?.tagName === "INPUT" ||
        t?.tagName === "TEXTAREA" ||
        t?.isContentEditable;

      if (isTyping) return;

      e.preventDefault();
      setSpaceDown(true);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      setSpaceDown(false);
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // Pointer panning
  const drag = useRef<{
    active: boolean;
    lastX: number;
    lastY: number;
    pointerId: number | null;
  }>({ active: false, lastX: 0, lastY: 0, pointerId: null });

  // Table dragging
  const dragTable = useRef<{
    active: boolean;
    id: string | null;
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    pointerId: number | null;
  }>({ active: false, id: null, startX: 0, startY: 0, initialX: 0, initialY: 0, pointerId: null });

  // Actions
  const updateTablePos = useCanvasStore((s) => s.updateTablePos);
  const relationships = useCanvasStore((s) => s.relationships);
  const addRelationship = useCanvasStore((s) => s.addRelationship);

  const snapToGrid = useCanvasStore((s) => s.snapToGrid);

  // Connection dragging
  const dragConnection = useRef<{
    active: boolean;
    sourceTableId: string;
    sourceColumnId: string;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    pointerId: number | null;
  }>({ active: false, sourceTableId: "", sourceColumnId: "", startX: 0, startY: 0, currentX: 0, currentY: 0, pointerId: null });

  const [, setTick] = useState(0);

  // Helper to get column position in world coordinates
  const getColumnPosition = (tableId: string, columnId: string, isSource: boolean) => {
    const table = tables.find(t => t.id === tableId);
    if (!table) return null;
    const colIndex = table.columns.findIndex(c => c.id === columnId);
    if (colIndex === -1) return null;

    const HEADER_HEIGHT = 36;
    const ROW_HEIGHT = 30;
    const WIDTH = 220;

    const x = table.x + (isSource ? WIDTH : 0);
    const y = table.y + HEADER_HEIGHT + colIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
    return { x, y };
  };

  // Orthogonal path calculator with rounded corners (DrawDB style)
  const calculatePath = (x1: number, y1: number, x2: number, y2: number) => {
    const cornerRadius = 8;
    const midX = (x1 + x2) / 2;
    
    // Determine if we need to go around obstacles
    const dx = x2 - x1;
    const dy = y2 - y1;
    
    // Simple case: straight horizontal or mostly horizontal
    if (Math.abs(dy) < 10) {
      return `M ${x1} ${y1} L ${x2} ${y2}`;
    }
    
    // Orthogonal routing: horizontal -> vertical -> horizontal
    // Start horizontal from x1
    const segments: string[] = [];
    
    if (dx > cornerRadius * 2) {
      // Going right: x1 -> midX (horizontal), midX -> y2 (vertical), midX -> x2 (horizontal)
      segments.push(`M ${x1} ${y1}`);
      
      // Horizontal segment to midpoint
      segments.push(`L ${midX - cornerRadius} ${y1}`);
      
      // Rounded corner going down/up
      if (dy > 0) {
        segments.push(`Q ${midX} ${y1} ${midX} ${y1 + cornerRadius}`);
      } else {
        segments.push(`Q ${midX} ${y1} ${midX} ${y1 - cornerRadius}`);
      }
      
      // Vertical segment
      if (dy > 0) {
        segments.push(`L ${midX} ${y2 - cornerRadius}`);
      } else {
        segments.push(`L ${midX} ${y2 + cornerRadius}`);
      }
      
      // Rounded corner going right
      if (dy > 0) {
        segments.push(`Q ${midX} ${y2} ${midX + cornerRadius} ${y2}`);
      } else {
        segments.push(`Q ${midX} ${y2} ${midX + cornerRadius} ${y2}`);
      }
      
      // Final horizontal segment to end
      segments.push(`L ${x2} ${y2}`);
    } else {
      // Going left or very short distance: need different routing
      const offset = 30;
      
      segments.push(`M ${x1} ${y1}`);
      
      // Go right a bit
      segments.push(`L ${x1 + offset - cornerRadius} ${y1}`);
      
      // Turn down/up
      if (dy > 0) {
        segments.push(`Q ${x1 + offset} ${y1} ${x1 + offset} ${y1 + cornerRadius}`);
        segments.push(`L ${x1 + offset} ${y2 - cornerRadius}`);
        segments.push(`Q ${x1 + offset} ${y2} ${x1 + offset - cornerRadius} ${y2}`);
      } else {
        segments.push(`Q ${x1 + offset} ${y1} ${x1 + offset} ${y1 - cornerRadius}`);
        segments.push(`L ${x1 + offset} ${y2 + cornerRadius}`);
        segments.push(`Q ${x1 + offset} ${y2} ${x1 + offset - cornerRadius} ${y2}`);
      }
      
      // Go to end
      segments.push(`L ${x2} ${y2}`);
    }
    
    return segments.join(' ');
  };

  const onColumnPointerDown = (e: React.PointerEvent, tableId: string, columnId: string, isSource: boolean) => {
    e.stopPropagation();
    e.preventDefault();
    
    const pos = getColumnPosition(tableId, columnId, isSource);
    if (!pos) return;

    const target = e.currentTarget as Element;
    target.setPointerCapture(e.pointerId);

    dragConnection.current = {
      active: true,
      sourceTableId: tableId,
      sourceColumnId: columnId,
      startX: pos.x,
      startY: pos.y,
      currentX: pos.x,
      currentY: pos.y,
      pointerId: e.pointerId
    };
    setTick(t => t + 1);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    // If dragging a table, don't pan
    if (dragTable.current.active) return;
    
    const shouldPan = e.button === 1 || (e.button === 0 && spaceDown);
    if (!shouldPan) return;

    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    drag.current = {
      active: true,
      lastX: e.clientX,
      lastY: e.clientY,
      pointerId: e.pointerId,
    };
  };

  const onTablePointerDown = (e: React.PointerEvent, tableId: string, initialX: number, initialY: number) => {
     if (spaceDown) return; // If panning mode, ignore table drag
     
     e.stopPropagation();
     e.preventDefault();
     
     const target = e.currentTarget as Element;
     target.setPointerCapture(e.pointerId);

     dragTable.current = {
       active: true,
       id: tableId,
       startX: e.clientX,
       startY: e.clientY,
       initialX,
       initialY,
       pointerId: e.pointerId
     };
     
     setSelectedTableId(tableId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    // 1. Handle Table Drag
    if (dragTable.current.active && dragTable.current.id) {
       e.preventDefault();
       const dx = (e.clientX - dragTable.current.startX) / camera.zoom;
       const dy = (e.clientY - dragTable.current.startY) / camera.zoom;
       
       let newX = dragTable.current.initialX + dx;
       let newY = dragTable.current.initialY + dy;

       if (snapToGrid) {
         const SNAP = 24;
         newX = Math.round(newX / SNAP) * SNAP;
         newY = Math.round(newY / SNAP) * SNAP;
       }

       updateTablePos(
         dragTable.current.id, 
         newX,
         newY
       );
       return;
    }

    // 2. Handle Connection Drag
    if (dragConnection.current.active) {
       e.preventDefault();
       const rect = rootRef.current?.getBoundingClientRect();
       if (!rect) return;
       
       const clientX = e.clientX - rect.left;
       const clientY = e.clientY - rect.top;
       
       const worldX = (clientX - camera.x) / camera.zoom;
       const worldY = (clientY - camera.y) / camera.zoom;
       
       dragConnection.current.currentX = worldX;
       dragConnection.current.currentY = worldY;
       setTick(t => t + 1);
       return;
    }

    // 3. Handle Canvas Pan
    if (!drag.current.active) return;
    const dx = e.clientX - drag.current.lastX;
    const dy = e.clientY - drag.current.lastY;
    drag.current.lastX = e.clientX;
    drag.current.lastY = e.clientY;
    panBy(dx, dy);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    // Handle Table Drop
    if (dragTable.current.active && dragTable.current.pointerId === e.pointerId) {
       dragTable.current.active = false;
       dragTable.current.pointerId = null;
       const target = e.currentTarget as Element;
       if (target.hasPointerCapture(e.pointerId)) {
          target.releasePointerCapture(e.pointerId);
       }
       return;
    }

    // Handle Connection Drop
    if (dragConnection.current.active && dragConnection.current.pointerId === e.pointerId) {
       dragConnection.current.active = false;
       dragConnection.current.pointerId = null;
       const target = e.currentTarget as Element;
       if (target.hasPointerCapture(e.pointerId)) {
          target.releasePointerCapture(e.pointerId);
       }
       setTick(t => t + 1);

       // Check what we dropped on using data attributes
       const hitEl = document.elementFromPoint(e.clientX, e.clientY);
       const gripTableId = hitEl?.getAttribute("data-table-id");
       const gripColId = hitEl?.getAttribute("data-col-id");

       // Valid drop? (different table)
       if (gripTableId && gripColId && gripTableId !== dragConnection.current.sourceTableId) {
           addRelationship({
             id: crypto.randomUUID(),
             sourceTableId: dragConnection.current.sourceTableId,
             sourceColumnId: dragConnection.current.sourceColumnId,
             targetTableId: gripTableId,
             targetColumnId: gripColId
           });
       }

       return;
    }

    if (drag.current.pointerId !== e.pointerId) return;
    drag.current.active = false;
    drag.current.pointerId = null;
  };

  /**
   * DrawDB-like wheel behavior:
   * - wheel => pan
   * - shift+wheel => horizontal pan
   * - ctrl/meta+wheel => zoom at cursor
   */
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      const isZoomGesture = e.ctrlKey || e.metaKey;

      if (isZoomGesture) {
        const factor = Math.exp(-e.deltaY * 0.0015);
        const safeFactor = clamp(factor, 0.85, 1.15);
        zoomAt(safeFactor, sx, sy);
        return;
      }

      let dx = -e.deltaX;
      let dy = -e.deltaY;

      if (e.shiftKey) {
        dx = -e.deltaY;
        dy = 0;
      }

      dx = clamp(dx, -120, 120);
      dy = clamp(dy, -120, 120);

      panBy(dx, dy);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [panBy, zoomAt]);

  const worldTransform = useMemo(
    () => `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
    [camera.x, camera.y, camera.zoom]
  );

  return (
    <div
      ref={rootRef}
      className="relative h-full w-full overflow-hidden bg-background"
    >
      {/* World */}
      <div
        className="absolute inset-0 touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={(e) => {
           // If we clicked directly on the background (not a node), deselect
           // Note: Nodes should stopPropagation on their click
           if (e.target === e.currentTarget) {
             setSelectedTableId(null);
           }
        }}
        style={{ cursor: spaceDown ? "grab" : "default" }}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width: WORLD_WIDTH,
            height: WORLD_HEIGHT,
            transform: worldTransform,
          }}
        >
          <WorldBackground
            w={WORLD_WIDTH}
            h={WORLD_HEIGHT}
            variant={background}
          />

          {/* SVG Layer for Tables */}
          <svg
            width={WORLD_WIDTH}
            height={WORLD_HEIGHT}
            className="absolute inset-0 overflow-visible pointer-events-none"
          >
            {/* Existing Relationships */}
            {relationships.map(rel => {
               const start = getColumnPosition(rel.sourceTableId, rel.sourceColumnId, true);
               const end = getColumnPosition(rel.targetTableId, rel.targetColumnId, false);
               
               if (!start || !end) return null;

               return (
                 <path 
                   key={rel.id}
                   d={calculatePath(start.x, start.y, end.x, end.y)}
                   stroke="var(--primary)"
                   strokeWidth={2}
                   fill="none"
                 />
               );
            })}

            {/* Pending Connection */}
            {dragConnection.current.active && (
              <path
                d={calculatePath(
                   dragConnection.current.startX, 
                   dragConnection.current.startY, 
                   dragConnection.current.currentX, 
                   dragConnection.current.currentY
                )}
                stroke="var(--primary)"
                strokeWidth={2}
                fill="none"
                strokeDasharray="5,5"
                opacity={0.6}
              />
            )}

            {/* Tables */}
            {tables.map((table) => (
              <g 
                key={table.id} 
                className="pointer-events-auto cursor-pointer"
                onPointerDown={(e) => onTablePointerDown(e, table.id, table.x, table.y)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedTableId(table.id);
                }}
              >
                 <TableNode 
                   table={table} 
                   selected={selectedTableId === table.id}
                   onColumnPointerDown={(e, colId, isSource) => onColumnPointerDown(e, table.id, colId, isSource)}
                 />
              </g>
            ))}
          </svg>
        </div>
      </div>

      {/* Minimap overlay */}
      <Minimap
        className="absolute bottom-4 right-4"
        world={{ w: WORLD_WIDTH, h: WORLD_HEIGHT }}
        viewport={viewport}
        camera={camera}
        onRecenter={(worldX, worldY) => {
          const targetScreenX = viewport.w / 2;
          const targetScreenY = viewport.h / 2;

          const nextX = targetScreenX - worldX * camera.zoom;
          const nextY = targetScreenY - worldY * camera.zoom;

          // ✅ go through store action so clamping is applied
          setCameraXY(nextX, nextY);
        }}
      />
    </div>
  );
}
