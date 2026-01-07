"use client";

import { useEditorStore } from "@/store/useEditorStore";
import { useEffect, useMemo, useRef, useState } from "react";
import { Minimap } from "./minimap";
import { WorldBackground } from "@/components/diagram-general/canvas-world-background";
import { useCanvasStore } from "@/store/useCanvasStore";

const WORLD_WIDTH = 4000;
const WORLD_HEIGHT = 3000;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function CanvasStage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const background = useCanvasStore((s) => s.background);

  const camera = useEditorStore((s) => s.camera);
  const panBy = useEditorStore((s) => s.panBy);
  const zoomAt = useEditorStore((s) => s.zoomAt);

  const [viewport, setViewport] = useState({ w: 1, h: 1 });

  // Measure viewport (so minimap + zoomAt math is correct)
  useEffect(() => {
    if (!rootRef.current) return;

    const el = rootRef.current;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setViewport({ w: r.width, h: r.height });
    });

    ro.observe(el);
    const r = el.getBoundingClientRect();
    setViewport({ w: r.width, h: r.height });

    return () => ro.disconnect();
  }, []);

  // Space-to-pan (like many editors)
  const [spaceDown, setSpaceDown] = useState(false);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;

      // don’t steal space from inputs
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
    // middle mouse OR space+left mouse
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

  // Wheel zoom (trackpad-friendly)
  const onWheel = (e: React.WheelEvent) => {
    if (!rootRef.current) return;

    // If user is panning with trackpad (shift/ctrl patterns differ by OS),
    // we keep it simple: wheel => zoom.
    e.preventDefault();

    const rect = rootRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    // smooth zoom factor
    const delta = clamp(-e.deltaY, -120, 120);
    const factor = delta > 0 ? 1.08 : 1 / 1.08;

    zoomAt(factor, sx, sy);
  };

  const worldTransform = useMemo(() => {
    // Camera convention:
    // - camera.x/y are screen-space translation of the world container
    // - camera.zoom is scale
    return `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`;
  }, [camera.x, camera.y, camera.zoom]);

  return (
    <div
      ref={rootRef}
      className="relative h-full w-full overflow-hidden bg-background"
      onWheel={onWheel}
    >
      {/* World */}
      <div
        className="absolute inset-0 touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          cursor: spaceDown ? "grab" : "default",
        }}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width: WORLD_WIDTH,
            height: WORLD_HEIGHT,
            transform: worldTransform,
          }}
        >
          {/* World background (moves + zooms with camera) */}
          <WorldBackground
            w={WORLD_WIDTH}
            h={WORLD_HEIGHT}
            variant={background}
          />

          {/* put your diagram nodes/edges here; this is just a placeholder */}
          <div className="absolute left-[300px] top-[240px] rounded-lg border bg-card px-3 py-2 shadow-sm">
            Table: users
          </div>
          <div className="absolute left-[900px] top-[540px] rounded-lg border bg-card px-3 py-2 shadow-sm">
            Table: posts
          </div>
        </div>
      </div>

      {/* Minimap overlay */}
      <Minimap
        className="absolute bottom-4 right-4"
        world={{ w: WORLD_WIDTH, h: WORLD_HEIGHT }}
        viewport={viewport}
        camera={camera}
        onRecenter={(worldX, worldY) => {
          // Recenter by moving camera so that world point appears at viewport center
          const targetScreenX = viewport.w / 2;
          const targetScreenY = viewport.h / 2;

          const nextX = targetScreenX - worldX * camera.zoom;
          const nextY = targetScreenY - worldY * camera.zoom;

          useEditorStore.setState((s) => ({
            camera: { ...s.camera, x: nextX, y: nextY },
          }));
        }}
      />
    </div>
  );
}
