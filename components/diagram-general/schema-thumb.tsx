"use client";

import { useMemo } from "react";

import type { Relationship, Table } from "@/store/useCanvasStore";
import { useCanvasStyle } from "@/store/useCanvasStyleStore";
import { TABLE_GEOMETRY, tableHeight } from "@/components/diagram-sections/canvas/canvas-style";
import { cn } from "@/lib/utils";
import styles from "./schema-thumb.module.scss";

interface SchemaThumbProps {
  tables: Table[];
  relationships: Relationship[];
  /** Rendered height in px; the width fills the container. */
  height: number;
  /** Extra room around the tables, in canvas units. */
  padding?: number;
  /** Draw a stripe per column (off for tiny thumbnails, where it's noise). */
  columns?: boolean;
  className?: string;
}

/**
 * Miniature of a schema: tables where they sit on the canvas, in their own
 * colours, with a line between related tables. Sized with the current canvas
 * style's table geometry so it matches what the canvas draws.
 */
export function SchemaThumb({ tables, relationships, height, padding = 40, columns = true, className }: SchemaThumbProps) {
  const geo = TABLE_GEOMETRY[useCanvasStyle().table];

  const { boxes, viewBox } = useMemo(() => {
    const b = tables.map((t) => ({ t, w: geo.width, h: tableHeight(geo, t.columns.length) }));
    if (b.length === 0) return { boxes: b, viewBox: "0 0 100 60" };
    const minX = Math.min(...b.map((x) => x.t.x)) - padding;
    const minY = Math.min(...b.map((x) => x.t.y)) - padding;
    const maxX = Math.max(...b.map((x) => x.t.x + x.w)) + padding;
    const maxY = Math.max(...b.map((x) => x.t.y + x.h)) + padding;
    return { boxes: b, viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}` };
  }, [tables, geo, padding]);

  const byId = new Map(boxes.map((b) => [b.t.id, b]));
  const centre = (id: string) => {
    const b = byId.get(id);
    return b ? { x: b.t.x + b.w / 2, y: b.t.y + b.h / 2 } : null;
  };

  return (
    <svg
      className={cn(styles.thumb, className)}
      viewBox={viewBox}
      height={height}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      {relationships.map((r) => {
        const a = centre(r.sourceTableId);
        const z = centre(r.targetTableId);
        if (!a || !z) return null;
        return (
          <line
            key={r.id}
            x1={a.x}
            y1={a.y}
            x2={z.x}
            y2={z.y}
            stroke="var(--muted-foreground)"
            strokeOpacity={0.45}
            strokeWidth={1.2}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
      {boxes.map(({ t, w, h }) => (
        <g key={t.id}>
          <rect x={t.x} y={t.y} width={w} height={h} rx={geo.radius} fill="var(--table-bg)" />
          <rect
            x={t.x}
            y={t.y}
            width={w}
            height={h}
            rx={geo.radius}
            fill={t.color}
            fillOpacity={0.1}
            stroke={t.color}
            strokeOpacity={0.7}
            strokeWidth={1.2}
            vectorEffect="non-scaling-stroke"
          />
          <rect x={t.x} y={t.y} width={w} height={geo.headerHeight} rx={geo.radius} fill={t.color} fillOpacity={0.85} />
          <rect x={t.x} y={t.y + geo.headerHeight / 2} width={w} height={geo.headerHeight / 2} fill={t.color} fillOpacity={0.85} />
          {columns &&
            t.columns.map((c, i) => (
              <rect
                key={c.id}
                x={t.x + 14}
                y={t.y + geo.headerHeight + geo.padTop + i * geo.rowHeight + geo.rowHeight / 2 - 3}
                width={c.isPrimaryKey ? w * 0.35 : w * (0.45 + ((i * 37) % 25) / 100)}
                height={6}
                rx={3}
                fill={c.isPrimaryKey ? t.color : "var(--muted-foreground)"}
                fillOpacity={c.isPrimaryKey ? 0.6 : 0.22}
              />
            ))}
        </g>
      ))}
    </svg>
  );
}
