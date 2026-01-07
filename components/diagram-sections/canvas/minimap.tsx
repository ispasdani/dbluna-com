"use client";

import { useMemo, useRef } from "react";
import { cn } from "@/lib/utils";

type Camera = { x: number; y: number; zoom: number };

export function Minimap({
  className,
  world,
  viewport,
  camera,
  onRecenter,
}: {
  className?: string;
  world: { w: number; h: number };
  viewport: { w: number; h: number };
  camera: Camera;
  onRecenter: (worldX: number, worldY: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const size = { w: 220, h: 160 };

  const scale = useMemo(() => {
    return Math.min(size.w / world.w, size.h / world.h);
  }, [size.w, size.h, world.w, world.h]);

  // Convert camera -> visible world rect:
  // screen = world*zoom + (x,y)
  // => world = (screen - (x,y))/zoom
  const viewWorld = useMemo(() => {
    const left = (0 - camera.x) / camera.zoom;
    const top = (0 - camera.y) / camera.zoom;
    const right = (viewport.w - camera.x) / camera.zoom;
    const bottom = (viewport.h - camera.y) / camera.zoom;

    return {
      x: left,
      y: top,
      w: right - left,
      h: bottom - top,
    };
  }, [camera.x, camera.y, camera.zoom, viewport.w, viewport.h]);

  const viewMini = useMemo(() => {
    return {
      x: viewWorld.x * scale,
      y: viewWorld.y * scale,
      w: viewWorld.w * scale,
      h: viewWorld.h * scale,
    };
  }, [viewWorld, scale]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;

    const worldX = mx / scale;
    const worldY = my / scale;

    onRecenter(worldX, worldY);
  };

  return (
    <div
      ref={ref}
      className={cn(
        "select-none rounded-xl border bg-card/90 backdrop-blur p-2 shadow-sm",
        className
      )}
      style={{ width: size.w, height: size.h }}
      onPointerDown={onPointerDown}
      role="button"
      aria-label="Minimap"
      title="Click to jump"
    >
      <div className="relative h-full w-full overflow-hidden rounded-lg bg-muted/40">
        {/* World bounds */}
        <div
          className="absolute left-0 top-0 border border-border/60"
          style={{
            width: world.w * scale,
            height: world.h * scale,
          }}
        />

        {/* Viewport rect */}
        <div
          className="absolute border-2 border-primary/70 bg-primary/10 rounded-sm"
          style={{
            left: viewMini.x,
            top: viewMini.y,
            width: viewMini.w,
            height: viewMini.h,
          }}
        />
      </div>
    </div>
  );
}
