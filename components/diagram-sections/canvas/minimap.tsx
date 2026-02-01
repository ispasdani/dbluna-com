"use client";

import React, { useMemo, useRef } from "react";
import { cn } from "@/lib/utils";

type Camera = { x: number; y: number; zoom: number };

export function Minimap({
  className,
  world,
  viewport,
  camera,
  tables = [],
  notes = [],
  areas = [],
  onRecenter,
}: {
  className?: string;
  world: { w: number; h: number };
  viewport: { w: number; h: number };
  camera: Camera;
  tables?: { id: string; x: number; y: number; width?: number; height?: number }[];
  notes?: { id: string; x: number; y: number; width: number; height: number }[];
  areas?: { id: string; x: number; y: number; width: number; height: number }[];
  onRecenter: (worldX: number, worldY: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const size = { w: 220, h: 160 };

  const scale = useMemo(() => {
    return Math.min(size.w / world.w, size.h / world.h);
  }, [size.w, size.h, world.w, world.h]);

  // Convert camera -> visible world rect:
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
        "select-none rounded-xl border bg-card/90 backdrop-blur p-2 shadow-sm pointer-events-auto",
        className
      )}
      style={{ width: size.w, height: size.h }}
      onPointerDown={onPointerDown}
      role="button"
      aria-label="Minimap"
      title="Click to jump"
    >
      <div className="relative h-full w-full overflow-hidden rounded-lg bg-muted/40">
        <MinimapContent
          scale={scale}
          tables={tables}
          notes={notes}
          areas={areas}
        />

        {/* World bounds border */}
        <div
          className="absolute left-0 top-0 border border-border/60 pointer-events-none"
          style={{
            width: world.w * scale,
            height: world.h * scale,
          }}
        />

        {/* Viewport rect */}
        <div
          className="absolute border-2 border-primary/70 bg-primary/10 rounded-sm pointer-events-none"
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

// Memoized content so panning (camera changes) doesn't re-render all nodes
// Only re-renders if tables/notes/areas change
const MinimapContent = React.memo(
  ({
    scale,
    tables,
    notes,
    areas,
  }: {
    scale: number;
    tables: { id: string; x: number; y: number; width?: number; height?: number }[];
    notes: { id: string; x: number; y: number; width: number; height: number }[];
    areas: { id: string; x: number; y: number; width: number; height: number }[];
  }) => {
    return (
      <>
        {/* Areas - Render first so they are behind */}
        {areas.map((area) => (
          <div
            key={area.id}
            className="absolute border border-indigo-500/30 bg-indigo-500/10 rounded-[1px]"
            style={{
              left: area.x * scale,
              top: area.y * scale,
              width: area.width * scale,
              height: area.height * scale,
            }}
          />
        ))}

        {/* Notes */}
        {notes.map((note) => (
          <div
            key={note.id}
            // Using a distinct color for notes (yellow-ish)
            className="absolute bg-amber-200/50 dark:bg-amber-500/50 rounded-[1px]"
            style={{
              left: note.x * scale,
              top: note.y * scale,
              width: note.width * scale,
              height: note.height * scale,
            }}
          />
        ))}

        {/* Tables */}
        {tables.map((table) => (
          <div
            key={table.id}
            className="absolute bg-foreground/20 rounded-[1px]"
            style={{
              left: table.x * scale,
              top: table.y * scale,
              // Tables might not have explicit width in store depending on implementation
              // Defaulting to typical table size if missing
              width: (table.width ?? 220) * scale,
              height: (table.height ?? 100) * scale,
            }}
          />
        ))}
      </>
    );
  }
);
MinimapContent.displayName = "MinimapContent";
