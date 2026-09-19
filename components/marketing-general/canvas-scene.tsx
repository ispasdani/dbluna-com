"use client";

import { motion } from "motion/react";

/* ─────────────────────────────────────────────────────────────────────────────
   Marketing mini-canvas: table cards and relationship lines drawn the way the
   editor draws its Recommended canvas style. Used by the How it works and
   Features sections, so their scenes look like the same product. Keep in step
   with components/diagram-sections/canvas/table-node.tsx when that changes.
───────────────────────────────────────────────────────────────────────────── */

export const ACCENT = "#6366f1";

export type SceneCol = { name: string; type: string; kind?: "pk" | "fk" | "uq" };
export type SceneTable = { name: string; color: string; x: number; y: number; cols: SceneCol[] };
export type SceneLinkDef = {
  d: string;
  /** Where the "one" bar sits. */
  oneAt: [number, number];
  /** Where the crow's foot sits, and which way its toes point (1 = left). */
  manyAt: [number, number];
  manyDir: 1 | -1;
};

export const TABLE_W = 164;
const HEAD = 32;
const ROW = 22;
const PAD_TOP = 4;

/** Vertical centre of column `i` of table `t`. */
export const rowY = (t: SceneTable, i: number) => t.y + HEAD + PAD_TOP + i * ROW + ROW / 2;
export const tableH = (t: SceneTable) => HEAD + PAD_TOP + t.cols.length * ROW + 5;

/** Rounded orthogonal path from (x1,y1) to (x2,y2) with its vertical run at `mx`. */
export function route(x1: number, y1: number, x2: number, y2: number, mx: number) {
  const r = 8;
  const dy = y2 > y1 ? 1 : -1;
  const d1 = mx > x1 ? 1 : -1;
  const d2 = x2 > mx ? 1 : -1;
  return `M${x1} ${y1}H${mx - d1 * r}Q${mx} ${y1} ${mx} ${y1 + dy * r}V${y2 - dy * r}Q${mx} ${y2} ${mx + d2 * r} ${y2}H${x2}`;
}

/** Keyframes for the lit line's flowing dash; render once inside each scene's <svg>. */
export const SCENE_STYLE = `@keyframes scene-flow{to{stroke-dashoffset:-11}}.scene-flow{stroke-dasharray:5 6;animation:scene-flow 1s linear infinite}@media (prefers-reduced-motion:reduce){.scene-flow{animation:none}}`;

// 12×12 glyphs, same strokes as the canvas's TableNode.
function KeyGlyph({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g transform={`translate(${x},${y})`} fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round">
      <circle cx={3.6} cy={6} r={2.6} />
      <path d="M6.2 6H11.4M9.6 6V8.2M11.4 6V7.8" />
    </g>
  );
}

function LinkGlyph({ x, y }: { x: number; y: number }) {
  return (
    <g
      transform={`translate(${x},${y})`}
      fill="none"
      strokeWidth={1.4}
      strokeLinecap="round"
      className="stroke-gray-400 dark:stroke-neutral-500"
    >
      <path d="M4.6 7.4 7.4 4.6" />
      <path d="M6.2 3.2 7.3 2.1a2.3 2.3 0 0 1 3.3 3.3L9.5 6.5" />
      <path d="M5.8 8.8 4.7 9.9a2.3 2.3 0 0 1-3.3-3.3L2.5 5.5" />
    </g>
  );
}

function UniqueGlyph({ x, y }: { x: number; y: number }) {
  return (
    <path
      transform={`translate(${x},${y})`}
      d="M6 2.4 9.6 6 6 9.6 2.4 6Z"
      fill="none"
      strokeWidth={1.4}
      strokeLinejoin="round"
      className="stroke-gray-400 dark:stroke-neutral-500"
    />
  );
}

/** One table card: colour square, name, column count, then key/link/unique rows. */
export function SceneTableCard({ t, delay }: { t: SceneTable; delay: number }) {
  const h = tableH(t);
  const W = TABLE_W;
  return (
    <motion.g
      initial={{ opacity: 0, y: -10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, delay }}
    >
      <rect
        x={t.x}
        y={t.y}
        width={W}
        height={h}
        rx={10}
        className="fill-white stroke-gray-200 dark:fill-neutral-900 dark:stroke-neutral-700"
        style={{ filter: "drop-shadow(0 1px 1.5px rgb(0 0 0 / 0.06)) drop-shadow(0 6px 16px rgb(0 0 0 / 0.07))" }}
      />
      <rect x={t.x + 12} y={t.y + HEAD / 2 - 5.5} width={11} height={11} rx={3.2} fill={t.color} />
      <text
        x={t.x + 30}
        y={t.y + HEAD / 2}
        dominantBaseline="central"
        fontSize={12.5}
        fontWeight={600}
        className="fill-charcoal-700 dark:fill-neutral-100"
      >
        {t.name}
      </text>
      <text
        x={t.x + W - 12}
        y={t.y + HEAD / 2}
        dominantBaseline="central"
        textAnchor="end"
        fontSize={9.5}
        fontWeight={500}
        className="fill-gray-400 dark:fill-neutral-500"
      >
        {t.cols.length} cols
      </text>
      <line x1={t.x} x2={t.x + W} y1={t.y + HEAD} y2={t.y + HEAD} className="stroke-gray-200 dark:stroke-neutral-700" />
      {t.cols.map((c, i) => {
        const cy = rowY(t, i);
        return (
          <g key={c.name}>
            {c.kind === "pk" && <KeyGlyph x={t.x + 12} y={cy - 6} color={t.color} />}
            {c.kind === "fk" && <LinkGlyph x={t.x + 12} y={cy - 6} />}
            {c.kind === "uq" && <UniqueGlyph x={t.x + 12} y={cy - 6} />}
            <text
              x={t.x + 30}
              y={cy}
              dominantBaseline="central"
              fontSize={11.5}
              fontWeight={c.kind === "pk" ? 600 : 400}
              className="fill-charcoal-700 dark:fill-neutral-200"
            >
              {c.name}
            </text>
            <text
              x={t.x + W - 12}
              y={cy}
              dominantBaseline="central"
              textAnchor="end"
              fontSize={10}
              className="fill-gray-400 dark:fill-neutral-500"
            >
              {c.type}
            </text>
          </g>
        );
      })}
    </motion.g>
  );
}

/**
 * One relationship: the line, a bar at the "one" end and a crow's foot on the
 * foreign key. `lit` draws it the way the canvas shows a hovered line: in the
 * accent colour with a flowing dash.
 */
export function SceneLink({ link, lit, delay }: { link: SceneLinkDef; lit?: boolean; delay: number }) {
  const quiet = "stroke-gray-400/80 dark:stroke-neutral-500";
  const endProps = lit ? { stroke: ACCENT } : { className: quiet };
  const [mx, my] = link.manyAt;
  return (
    <motion.g
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay }}
    >
      <path d={link.d} fill="none" strokeWidth={1.3} className={quiet} />
      {lit && <path d={link.d} fill="none" stroke={ACCENT} strokeWidth={1.8} className="scene-flow" />}
      <line
        x1={link.oneAt[0]}
        x2={link.oneAt[0]}
        y1={link.oneAt[1] - 5}
        y2={link.oneAt[1] + 5}
        strokeWidth={1.5}
        strokeLinecap="round"
        {...endProps}
      />
      <path
        d={`M${mx} ${my - 5}L${mx - link.manyDir * 9} ${my}L${mx} ${my + 5}`}
        fill="none"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...endProps}
      />
    </motion.g>
  );
}

/** The "linked" row highlight the canvas draws on both ends of a hovered line. */
export function SceneRowHighlight({ t, row, delay }: { t: SceneTable; row: number; delay: number }) {
  return (
    <motion.rect
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.4 }}
      x={t.x + 5}
      y={rowY(t, row) - 10}
      width={TABLE_W - 10}
      height={20}
      rx={6}
      fill={ACCENT}
      fillOpacity={0.12}
    />
  );
}
