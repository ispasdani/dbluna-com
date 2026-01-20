"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useEditorStore } from "@/store/useEditorStore";
import { useCanvasStore } from "@/store/useCanvasStore";
import { useDockStore } from "@/store/useDockStore";
import { WorldBackground } from "@/components/diagram-general/canvas-world-background";
import { Minimap } from "./minimap";
import { TableNode } from "./table-node";
import styles from "./canvas.module.scss";

const WORLD_WIDTH = 6000;
const WORLD_HEIGHT = 6000;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function CanvasStage() {
  const rootRef = useRef<HTMLDivElement>(null);

  const background = useCanvasStore((s) => s.background);
  const tables = useCanvasStore((s) => s.tables);
  const selectedTableIds = useCanvasStore((s) => s.selectedTableIds);
  const setSelectedTableIds = useCanvasStore((s) => s.setSelectedTableIds);
  const selectedRelationshipId = useCanvasStore((s) => s.selectedRelationshipId);
  const setSelectedRelationshipId = useCanvasStore((s) => s.setSelectedRelationshipId);
  const moveTables = useCanvasStore((s) => s.moveTables);
  const deleteTables = useCanvasStore((s) => s.deleteTables);

  const openTab = useDockStore((s) => s.openTab);

  const camera = useEditorStore((s) => s.camera);
  const panBy = useEditorStore((s) => s.panBy);
  const zoomAt = useEditorStore((s) => s.zoomAt);

  const setViewportStore = useEditorStore((s) => s.setViewport);
  const setWorldStore = useEditorStore((s) => s.setWorld);
  const setCameraXY = useEditorStore((s) => s.setCameraXY);

  const [viewport, setViewport] = useState({ w: 1, h: 1 });
  const [hoveredRelationshipId, setHoveredRelationshipId] = useState<string | null>(null);
  
  // Selection Rect State (in world coordinates)
  const [selectionRect, setSelectionRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null);

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
      if (e.code === "Space") {
        setSpaceDown(false);
      }
      if ((e.code === "Delete" || e.code === "Backspace") && selectedTableIds.length > 0) {
        // Prevent deleting if typing in input !! 
        // We already check "isTyping" in onKeyDown but not here.
        // We should check here too or move logic. 
        const t = e.target as HTMLElement | null;
        const isTyping = t?.tagName === "INPUT" || t?.tagName === "TEXTAREA" || t?.isContentEditable;
        if (!isTyping) {
           deleteTables(selectedTableIds);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [selectedTableIds, deleteTables]);

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
    initialMouseX: number;
    initialMouseY: number;
    // Map of table ID to its initial position {x, y}
    initialPositions: Map<string, { x: number, y: number }>;
    pointerId: number | null;
  }>({ active: false, initialMouseX: 0, initialMouseY: 0, initialPositions: new Map(), pointerId: null });

  // Marquee Selection dragging
  const dragSelection = useRef<{
    active: boolean;
    startX: number; // World coordinates
    startY: number;
    currentX: number;
    currentY: number;
    pointerId: number | null;
  }>({ active: false, startX: 0, startY: 0, currentX: 0, currentY: 0, pointerId: null });

  // Actions
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

  const calculateMidpoint = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = x2 - x1;
    const cornerRadius = 8;
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    if (dx > cornerRadius * 2) {
      return { x: midX, y: midY };
    } else {
      const offset = 30;
      return { x: x1 + offset, y: midY };
    }
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
    
    // Middle mouse or Space+Left = Pan
    const shouldPan = e.button === 1 || (e.button === 0 && spaceDown);
    
    if (shouldPan) {
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        drag.current = {
          active: true,
          lastX: e.clientX,
          lastY: e.clientY,
          pointerId: e.pointerId,
        };
        return;
    }

    // Left click on background -> Marquee Selection
    if (e.button === 0) {
       e.preventDefault();
       (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

       const rect = rootRef.current?.getBoundingClientRect();
       if (!rect) return;
       const worldX = (e.clientX - rect.left - camera.x) / camera.zoom;
       const worldY = (e.clientY - rect.top - camera.y) / camera.zoom;

       dragSelection.current = {
          active: true,
          startX: worldX,
          startY: worldY,
          currentX: worldX,
          currentY: worldY,
          pointerId: e.pointerId
       };
       // Clear selection unless shift is held (DrawDB behavior usually clears)
       // Let's clear for now to be simple
       if (!e.shiftKey) {
          setSelectedTableIds([]);
       }
       setSelectionRect({ x: worldX, y: worldY, w: 0, h: 0 });
    }
  };

  const onTablePointerDown = (e: React.PointerEvent, tableId: string) => {
     if (spaceDown) return; // If panning mode, ignore table drag
     
     e.stopPropagation();
     e.preventDefault();
     
     const table = tables.find(t => t.id === tableId);
     if (!table) return;

     // If table is locked, just select it (single) and return
     if (table.isLocked) {
       setSelectedTableIds([tableId]);
       return;
     }

     const target = e.currentTarget as Element;
     target.setPointerCapture(e.pointerId);

     // Selection Logic:
     // If clicking an unselected table, select it (exclusive) unless Shift
     // If clicking a selected table, keep selection (to allow group drag)
     let newSelectedIds = [...selectedTableIds];
     if (!selectedTableIds.includes(tableId)) {
        if (e.shiftKey) {
           newSelectedIds.push(tableId);
        } else {
           newSelectedIds = [tableId];
        }
        setSelectedTableIds(newSelectedIds);
        // Force update local variable for initPositions
     }
     // If shift clicking an already selected table, deselect it? 
     // Standard behavior: 
     // - Click selected: Start drag
     // - Shift+Click selected: Deselect (and don't drag typically, or drag remaining)
     else if (e.shiftKey) {
        newSelectedIds = newSelectedIds.filter(id => id !== tableId);
        setSelectedTableIds(newSelectedIds);
        return; // Don't drag if we just deselected it
     }

     // Prepare group drag
     const initialPositions = new Map<string, {x: number, y: number}>();
     newSelectedIds.forEach(id => {
       const t = tables.find(t => t.id === id);
       if (t) initialPositions.set(id, { x: t.x, y: t.y });
     });

     dragTable.current = {
       active: true,
       initialMouseX: e.clientX,
       initialMouseY: e.clientY,
       initialPositions,
       pointerId: e.pointerId
     };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    // 1. Handle Table Drag
    if (dragTable.current.active) {
       e.preventDefault();
       const dx = (e.clientX - dragTable.current.initialMouseX) / camera.zoom;
       const dy = (e.clientY - dragTable.current.initialMouseY) / camera.zoom;
       
       const moves: { id: string, x: number, y: number }[] = [];
       const SNAP = 24;

       dragTable.current.initialPositions.forEach((initPos, id) => {
          let newX = initPos.x + dx;
          let newY = initPos.y + dy;

          if (snapToGrid) {
            newX = Math.round(newX / SNAP) * SNAP;
            newY = Math.round(newY / SNAP) * SNAP;
          }
          moves.push({ id, x: newX, y: newY });
       });

       if (moves.length > 0) {
         moveTables(moves);
       }
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

    // 3. Handle Marquee Selection
    if (dragSelection.current.active) {
       e.preventDefault();
       const rect = rootRef.current?.getBoundingClientRect();
       if (!rect) return;

       const worldX = (e.clientX - rect.left - camera.x) / camera.zoom;
       const worldY = (e.clientY - rect.top - camera.y) / camera.zoom;
       
       dragSelection.current.currentX = worldX;
       dragSelection.current.currentY = worldY;

       // Calculate normalized rect
       const x = Math.min(dragSelection.current.startX, worldX);
       const y = Math.min(dragSelection.current.startY, worldY);
       const w = Math.abs(worldX - dragSelection.current.startX);
       const h = Math.abs(worldY - dragSelection.current.startY);

       setSelectionRect({ x, y, w, h });
       return;
    }

    // 4. Handle Canvas Pan
    if (!drag.current.active) return;
    const dx = e.clientX - drag.current.lastX;
    const dy = e.clientY - drag.current.lastY;
    drag.current.lastX = e.clientX;
    drag.current.lastY = e.clientY;
    panBy(dx, dy);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const target = e.currentTarget as Element;

    // Handle Table Drop
    if (dragTable.current.active && dragTable.current.pointerId === e.pointerId) {
       dragTable.current.active = false;
       dragTable.current.pointerId = null;
       dragTable.current.initialPositions.clear();
       if (target.hasPointerCapture(e.pointerId)) {
          target.releasePointerCapture(e.pointerId);
       }
       return;
    }

    // Handle Connection Drop
    if (dragConnection.current.active && dragConnection.current.pointerId === e.pointerId) {
       dragConnection.current.active = false;
       dragConnection.current.pointerId = null;
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

    // Handle Marquee Drop
    if (dragSelection.current.active && dragSelection.current.pointerId === e.pointerId) {
       dragSelection.current.active = false;
       dragSelection.current.pointerId = null;
       if (target.hasPointerCapture(e.pointerId)) {
          target.releasePointerCapture(e.pointerId);
       }
       
       // Sync Calculation using Ref (more reliable than state during rapid events)
       const { startX, startY, currentX, currentY } = dragSelection.current;
       
       // Normalize bounds
       const rX = Math.min(startX, currentX);
       const rY = Math.min(startY, currentY);
       const rR = Math.max(startX, currentX);
       const rB = Math.max(startY, currentY);

       // Only select if box has some size (avoid accidental clicks acting as tiny drags)
       if (Math.abs(currentX - startX) > 5 || Math.abs(currentY - startY) > 5) {
           const insideIds: string[] = [];
           
           tables.forEach(t => {
              // Estimate Table Bounds
              const estWidth = 220;
              const estHeight = 36 + (t.columns?.length || 0) * 30; // Exact match to TableNode

              const tX = t.x;
              const tY = t.y;
              const tR = t.x + estWidth;
              const tB = t.y + estHeight;

              // AABB Intersection: Rect overlaps Table
              // Check if rectangles overlap
              const overlaps = (rX < tR && rR > tX && rY < tB && rB > tY);
              
              if (overlaps) {
                 insideIds.push(t.id);
              }
           });
           
           if (insideIds.length > 0) {
              setSelectedTableIds(e.shiftKey ? [...selectedTableIds, ...insideIds] : insideIds);
           } else if (!e.shiftKey) {
             setSelectedTableIds([]);
           }
       }
       
       setSelectionRect(null);
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

                const pathData = calculatePath(start.x, start.y, end.x, end.y);
                const mid = calculateMidpoint(start.x, start.y, end.x, end.y);
                const isHovered = hoveredRelationshipId === rel.id;
                const isSelected = selectedRelationshipId === rel.id;
                const label = rel.name || "Relationship";

                return (
                  <g 
                    key={rel.id}
                    onPointerEnter={() => setHoveredRelationshipId(rel.id)}
                    onPointerLeave={() => setHoveredRelationshipId(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedRelationshipId(rel.id);
                      openTab("relationships", "left");
                    }}
                    className="cursor-pointer"
                  >
                    {/* Invisible hit area for easier hovering */}
                    <path
                      d={pathData}
                      fill="none"
                      strokeWidth={12}
                      className={styles["relationship-hit-area"]}
                      style={{ pointerEvents: "auto" }}
                    />
                    {/* The actual visible line */}
                    <path 
                      d={pathData}
                      stroke={isSelected ? "var(--primary)" : "var(--primary)"}
                      strokeWidth={isSelected ? 3 : 2}
                      fill="none"
                      className={`${styles["relationship-path"]} ${isHovered ? styles["marching-ants"] : ""}`}
                      style={{ 
                        filter: isSelected ? "drop-shadow(0 0 4px var(--primary))" : "none",
                        opacity: isSelected ? 1 : 0.8
                      }}
                    />

                    {/* Hover Label */}
                    {isHovered && (
                      <g transform={`translate(${mid.x}, ${mid.y})`}>
                        {/* Background for label */}
                        <rect
                          x={-label.length * 4 - 8}
                          y={-12}
                          width={label.length * 8 + 16}
                          height={24}
                          rx={4}
                          fill="var(--popover)"
                          stroke="var(--border)"
                          strokeWidth={1}
                          className="shadow-md"
                        />
                        <text
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="var(--popover-foreground)"
                          fontSize={11}
                          fontWeight="600"
                          style={{ pointerEvents: "none", userSelect: "none" }}
                        >
                          {label}
                        </text>
                      </g>
                    )}
                  </g>
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
                onPointerDown={(e) => onTablePointerDown(e, table.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  // Click logic now handled in onPointerDown/Up mostly, 
                  // but we might want to ensure robust behavior here if needed.
                  // For now, let's leave it empty or remove this handler as selection is pointer-down based.
                  // However, let's keep it to catch any edge cases or bubbling, but do nothing 
                  // to avoid conflict with drag start selection logic.
                }}
              >
                 <TableNode 
                   table={table} 
                   selected={selectedTableIds.includes(table.id)}
                   onColumnPointerDown={(e, colId, isSource) => onColumnPointerDown(e, table.id, colId, isSource)}
                 />
              </g>
            ))}

            {/* Marquee Selection Rectangle */}
            {selectionRect && (
              <rect
                x={selectionRect.x}
                y={selectionRect.y}
                width={selectionRect.w}
                height={selectionRect.h}
                fill="rgba(59, 130, 246, 0.1)" // blue-500 with opacity
                stroke="rgba(59, 130, 246, 0.5)"
                strokeWidth={1}
                pointerEvents="none"
              />
            )}
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
