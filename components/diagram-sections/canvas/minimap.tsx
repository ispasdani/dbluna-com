"use client";

import React, { useMemo, useRef } from "react";
import { cn } from "@/lib/utils";

type Camera = { x: number; y: number; zoom: number };

export function Minimap({
  className,
  viewport,
  camera,
  tables = [],
  notes = [],
  areas = [],
  onRecenter,
}: {
  className?: string;
  viewport: { w: number; h: number };
  camera: Camera;
  tables?: { id: string; x: number; y: number; width?: number; height?: number }[];
  notes?: { id: string; x: number; y: number; width: number; height: number }[];
  areas?: { id: string; x: number; y: number; width: number; height: number }[];
  onRecenter: (worldX: number, worldY: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const size = { w: 220, h: 160 };

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

  // The world rect the minimap maps onto its 220x160 box.
  //
  // Content only — deliberately *not* unioned with the camera's viewport. When
  // it was, `bounds` (and with it `scale`) changed on every pan, which moved
  // every dot in `MinimapContent` and defeated its memo: on a 428-table diagram
  // a single pan gesture produced ~39k DOM mutations in here, roughly 30x what
  // the canvas itself did. Keeping it fixed while the content is fixed means
  // the dots are laid out once and panning only moves the viewport rect.
  const contentBounds = useMemo(() => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    const expand = (x: number, y: number, w: number, h: number) => {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x + w > maxX) maxX = x + w;
      if (y + h > maxY) maxY = y + h;
    };

    tables.forEach(t => expand(t.x, t.y, t.width ?? 220, t.height ?? 100));
    notes.forEach(n => expand(n.x, n.y, n.width, n.height));
    areas.forEach(a => expand(a.x, a.y, a.width, a.height));

    if (minX === Infinity) return null;

    const padding = 500;
    return { x: minX - padding, y: minY - padding, w: maxX - minX + 2 * padding, h: maxY - minY + 2 * padding };
  }, [tables, notes, areas]);

  // An empty diagram has no content to frame, so fall back to the viewport —
  // there are no dots to re-render, so the camera dependency costs nothing.
  const bounds = useMemo(
    () => contentBounds ?? { x: viewWorld.x - 500, y: viewWorld.y - 500, w: viewWorld.w + 1000, h: viewWorld.h + 1000 },
    [contentBounds, viewWorld]
  );

  const scale = useMemo(() => {
    return Math.min(size.w / bounds.w, size.h / bounds.h);
  }, [size.w, size.h, bounds.w, bounds.h]);

  // Clamped into the box: the bounds no longer stretch to follow the camera, so
  // panning past the edge of the diagram would otherwise slide the rect out of
  // sight entirely. Clamping parks it against the edge you left from.
  const viewMini = useMemo(() => {
    const x = (viewWorld.x - bounds.x) * scale;
    const y = (viewWorld.y - bounds.y) * scale;
    const w = viewWorld.w * scale;
    const h = viewWorld.h * scale;
    const left = Math.min(Math.max(x, -w + 8), size.w - 8);
    const top = Math.min(Math.max(y, -h + 8), size.h - 8);
    return { x: left, y: top, w, h };
  }, [viewWorld, bounds, scale, size.w, size.h]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;

    const worldX = (mx / scale) + bounds.x;
    const worldY = (my / scale) + bounds.y;

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
          bounds={bounds}
          tables={tables}
          notes={notes}
          areas={areas}
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
    bounds,
    tables,
    notes,
    areas,
  }: {
    scale: number;
    bounds: { x: number; y: number; w: number; h: number };
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
              left: (area.x - bounds.x) * scale,
              top: (area.y - bounds.y) * scale,
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
              left: (note.x - bounds.x) * scale,
              top: (note.y - bounds.y) * scale,
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
              left: (table.x - bounds.x) * scale,
              top: (table.y - bounds.y) * scale,
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
