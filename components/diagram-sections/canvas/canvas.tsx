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

  const onPointerDown = (e: React.PointerEvent) => {
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

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current.active) return;
    const dx = e.clientX - drag.current.lastX;
    const dy = e.clientY - drag.current.lastY;
    drag.current.lastX = e.clientX;
    drag.current.lastY = e.clientY;
    panBy(dx, dy);
  };

  const onPointerUp = (e: React.PointerEvent) => {
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
            {tables.map((table) => (
              <g 
                key={table.id} 
                className="pointer-events-auto cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedTableId(table.id);
                }}
              >
                 <TableNode 
                   table={table} 
                   selected={selectedTableId === table.id} 
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
