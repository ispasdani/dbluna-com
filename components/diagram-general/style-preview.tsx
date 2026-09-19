"use client";

import { useId } from "react";

import type { TableVariant } from "@/components/diagram-sections/canvas/canvas-style";
import styles from "./toolbar-menus.module.scss";

const C1 = "#6366f1";
const C2 = "#f59e0b";

function Card({ x, y, color, variant }: { x: number; y: number; color: string; variant: TableVariant }) {
  const r = variant === "dense" ? 2 : variant === "chips" ? 5 : 4;
  const h = variant === "dense" ? 24 : 28;
  const rowGap = variant === "dense" ? 4 : 5;
  return (
    <g>
      <rect x={x} y={y} width={30} height={h} rx={r} fill="var(--table-bg)" stroke="var(--border)" strokeWidth={0.8} />
      {variant === "header" ? (
        <>
          <rect x={x} y={y} width={30} height={8} rx={r} fill={color} />
          <rect x={x} y={y + 4} width={30} height={4} fill={color} />
        </>
      ) : (
        <>
          <rect
            x={x + 3}
            y={y + 2.5}
            width={variant === "chips" ? 5 : 3.5}
            height={variant === "chips" ? 5 : 3.5}
            rx={1}
            fill={color}
          />
          <line x1={x} y1={y + 8} x2={x + 30} y2={y + 8} stroke="var(--border)" />
        </>
      )}
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={x + 4}
          y={y + 11 + i * rowGap}
          width={14 - i * 2}
          height={2}
          rx={1}
          fill="var(--muted-foreground)"
          opacity={0.4}
        />
      ))}
    </g>
  );
}

/**
 * A thumbnail of one of the four looks: two table cards and the line between
 * them, drawn the way that style draws them. Used for both canvas styles and
 * panel styles, which share their names and character.
 */
export function StylePreview({ variant }: { variant: TableVariant }) {
  const gradientId = useId();
  const path = "M33 12H40Q44 12 44 16V26Q44 30 48 30H55";

  return (
    <span className={styles.preview} aria-hidden>
      <svg viewBox="0 0 88 44">
        {variant === "chips" ? (
          <>
            <defs>
              <linearGradient id={gradientId} x1="0" x2="1">
                <stop offset="0" stopColor={C1} />
                <stop offset="1" stopColor={C2} />
              </linearGradient>
            </defs>
            <path d="M33 12C45 12 43 30 55 30" fill="none" stroke={`url(#${gradientId})`} strokeWidth={1.4} />
          </>
        ) : variant === "dense" ? (
          <path d="M33 12H44V30H55" fill="none" stroke="var(--primary)" strokeWidth={1.2} />
        ) : variant === "header" ? (
          <path d={path} fill="none" stroke={C1} strokeWidth={1.4} />
        ) : (
          <path d={path} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.1} opacity={0.7} />
        )}
        <Card x={3} y={4} color={C1} variant={variant} />
        <Card x={55} y={14} color={C2} variant={variant} />
      </svg>
    </span>
  );
}
