"use client";

import type { Table } from "@/store/useCanvasStore";
import { Key } from "lucide-react";

interface TableNodeProps {
  table: Table;
  selected?: boolean;
  onColumnPointerDown?: (e: React.PointerEvent, columnId: string, isSource: boolean) => void;
}

export function TableNode({ table, selected, onColumnPointerDown }: TableNodeProps) {
  const HEADER_HEIGHT = 36;
  const ROW_HEIGHT = 30;
  const WIDTH = 220;
  const STRIP_HEIGHT = 4;

  const totalHeight = HEADER_HEIGHT + table.columns.length * ROW_HEIGHT;

  return (
    <g transform={`translate(${table.x}, ${table.y})`}>
      {/* 
        Container Frame 
        - rx=8 for rounded corners
        - fill="hsl(var(--card))" for theme awareness 
        - stroke="hsl(var(--border))" for outline
      */}
      <rect
        x={0}
        y={0}
        width={WIDTH}
        height={totalHeight}
        rx={8}
        fill="var(--table-bg)"
        stroke={selected ? "var(--primary)" : "var(--border)"}
        strokeWidth={selected ? 2 : 1}
        // Slightly stronger shadow for the card look
        style={{ filter: "drop-shadow(0 2px 4px rgb(0 0 0 / 0.1))" }}
        className="transition-colors duration-200"
      />

      {/* 
        Color Identity Strip 
        - Height of ~4px at top
        - Uses table.color
        - Clipped/Masked manually by path or just drawn carefully
      */}
      <path
        d={`M1 1 Q 1 1 1 1 L${WIDTH - 1} 1 Q ${WIDTH - 1} 1 ${WIDTH - 1} 1 L${WIDTH - 1} ${STRIP_HEIGHT} L1 ${STRIP_HEIGHT} Z`}
        fill={table.color}
        // Clip to top rounded corners if needed, or just let it sit inside stroke
        // Here we roughly match the inner border
        style={{ clipPath: "inset(0 0 0 0 round 7px 7px 0 0)" }}
      />
      
      {/* Header Area */}
      {/* Background for header (optional, usually just card bg or very faint gray) */}
      <rect
         x={1}
         y={STRIP_HEIGHT}
         width={WIDTH - 2}
         height={HEADER_HEIGHT - STRIP_HEIGHT}
         fill="transparent" 
      />

      {/* Table Name */}
      <text
        x={12}
        y={STRIP_HEIGHT + 20}
        fill="var(--foreground)"
        fontWeight="600"
        fontSize={14}
        style={{ pointerEvents: "none", userSelect: "none", fontFamily: "sans-serif" }}
      >
        {table.name}
      </text>

      {/* Divider between Header and Body */}
      <line
        x1={0}
        y1={HEADER_HEIGHT}
        x2={WIDTH}
        y2={HEADER_HEIGHT}
        stroke="var(--border)"
        strokeWidth={1}
      />

      {/* Columns List */}
      {table.columns.map((col, i) => {
        const rowY = HEADER_HEIGHT + i * ROW_HEIGHT;
        
        return (
          <g key={col.name} transform={`translate(0, ${rowY})`}>
            {/* Row Hover Zone (invisible rect for events) */}
            <rect
              x={1}
              y={0}
              width={WIDTH - 2}
              height={ROW_HEIGHT}
              fill="transparent"
              className="hover:fill-muted/50 transition-colors"
            />

            {/* PK Indicator */}
            {col.isPrimaryKey && (
               <path
                 d="M3.5 10c0-1.7 1.3-3 3-3s3 1.3 3 3c0 1.3-0.8 2.4-2 2.8V15h2v2h-2v1h-2v-1H4.5v-2h1.5v-2.2C4.3 12.4 3.5 11.3 3.5 10"
                 transform="translate(10, 4) scale(0.6)"
                 fill="var(--primary)"
               />
            )}

            {/* Column Name */}
            <text
              x={col.isPrimaryKey ? 28 : 12}
              y={20}
              fill="var(--foreground)"
              fontSize={13}
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              {col.name}
            </text>

            {/* Column Type */}
            <text
              x={WIDTH - 12}
              y={20}
              textAnchor="end"
              fill="var(--muted-foreground)"
              fontSize={11}
              style={{ pointerEvents: "none", userSelect: "none", fontFamily: "monospace" }}
            >
              {col.type}
            </text>

            {/* Connection Grips */}
            {/* Left Grip (Target) */}
            <circle
               cx={0} 
               cy={ROW_HEIGHT / 2} 
               r={4} 
               fill="var(--primary)" 
               stroke="var(--background)"
               strokeWidth={1.5}
               className="cursor-crosshair transition-all hover:r-5"
               data-table-id={table.id}
               data-col-id={col.id}
               data-is-source="false"
               onPointerDown={(e) => {
                 if (onColumnPointerDown) {
                   onColumnPointerDown(e, col.id, false);
                 }
               }}
            />
            {/* Right Grip (Source) */}
            <circle
               cx={WIDTH} 
               cy={ROW_HEIGHT / 2} 
               r={4} 
               fill="var(--primary)" 
               stroke="var(--background)"
               strokeWidth={1.5}
               className="cursor-crosshair transition-all hover:r-5"
               data-table-id={table.id}
               data-col-id={col.id}
               data-is-source="true"
               onPointerDown={(e) => {
                 if (onColumnPointerDown) {
                   onColumnPointerDown(e, col.id, true);
                 }
               }}
            />
          </g>
        );
      })}
    </g>
  );
}
