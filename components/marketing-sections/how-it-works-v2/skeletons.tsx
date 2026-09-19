"use client";

import { cn } from "@/lib/utils";
import { motion, useMotionValue } from "motion/react";
import { useEffect, useMemo, useRef } from "react";
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Info,
  Maximize,
  Minus,
  Plus,
  Search,
  Square,
  StickyNote,
  Table as TableIcon,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────────────────────
   These scenes mirror the editor as it looks today: table cards and lines in
   the Recommended canvas style, the floating canvas toolbar, the Issues tab
   cards. Keep them in step when the editor's look changes.
───────────────────────────────────────────────────────────────────────────── */

const INDIGO = "#6366f1";
const AMBER = "#f59e0b";
const EMERALD = "#10b981";
const PINK = "#ec4899";

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

/* ─────────────────────────────────────────────────────────────────────────────
   Tab 1 — Design visually or with code: a mini canvas
───────────────────────────────────────────────────────────────────────────── */

type Col = { name: string; type: string; kind?: "pk" | "fk" | "uq" };
type SceneTable = { name: string; color: string; x: number; y: number; cols: Col[] };

const W = 164; // table width
const HEAD = 32; // header height
const ROW = 22; // row height
const PAD_TOP = 4;

const SCENE: SceneTable[] = [
  {
    name: "users",
    color: INDIGO,
    x: 40,
    y: 36,
    cols: [
      { name: "id", type: "int", kind: "pk" },
      { name: "email", type: "varchar", kind: "uq" },
      { name: "created_at", type: "timestamp" },
    ],
  },
  {
    name: "orders",
    color: AMBER,
    x: 236,
    y: 112,
    cols: [
      { name: "id", type: "int", kind: "pk" },
      { name: "user_id", type: "int", kind: "fk" },
      { name: "status", type: "varchar" },
      { name: "total", type: "decimal" },
    ],
  },
  {
    name: "products",
    color: EMERALD,
    x: 440,
    y: 22,
    cols: [
      { name: "id", type: "int", kind: "pk" },
      { name: "sku", type: "varchar", kind: "uq" },
      { name: "name", type: "varchar" },
    ],
  },
  {
    name: "order_items",
    color: PINK,
    x: 440,
    y: 176,
    cols: [
      { name: "id", type: "int", kind: "pk" },
      { name: "order_id", type: "int", kind: "fk" },
      { name: "product_id", type: "int", kind: "fk" },
    ],
  },
];

const rowY = (t: SceneTable, i: number) => t.y + HEAD + PAD_TOP + i * ROW + ROW / 2;
const tableH = (t: SceneTable) => HEAD + PAD_TOP + t.cols.length * ROW + 5;

/** Rounded orthogonal path from (x1,y1) to (x2,y2) turning at `mx`. */
function route(x1: number, y1: number, x2: number, y2: number, mx: number) {
  const r = 8;
  const dy = y2 > y1 ? 1 : -1;
  const d1 = mx > x1 ? 1 : -1;
  const d2 = x2 > mx ? 1 : -1;
  return `M${x1} ${y1}H${mx - d1 * r}Q${mx} ${y1} ${mx} ${y1 + dy * r}V${y2 - dy * r}Q${mx} ${y2} ${mx + d2 * r} ${y2}H${x2}`;
}

// Each relationship: its path, where the "one" bar sits, and where the crow's foot sits.
const LINKS: { d: string; oneAt: [number, number]; manyAt: [number, number]; manyDir: 1 | -1 }[] = [
  {
    // users.id → orders.user_id
    d: route(SCENE[0].x + W, rowY(SCENE[0], 0), SCENE[1].x, rowY(SCENE[1], 1), 220),
    oneAt: [SCENE[0].x + W + 8, rowY(SCENE[0], 0)],
    manyAt: [SCENE[1].x, rowY(SCENE[1], 1)],
    manyDir: 1,
  },
  {
    // orders.id → order_items.order_id
    d: route(SCENE[1].x + W, rowY(SCENE[1], 0), SCENE[3].x, rowY(SCENE[3], 1), 420),
    oneAt: [SCENE[1].x + W + 8, rowY(SCENE[1], 0)],
    manyAt: [SCENE[3].x, rowY(SCENE[3], 1)],
    manyDir: 1,
  },
  {
    // products.id → order_items.product_id: both sit in the right column, so
    // the line runs down their right edges and never crosses the other two.
    d: `M${SCENE[2].x + W} ${rowY(SCENE[2], 0)}H${612}Q${620} ${rowY(SCENE[2], 0)} ${620} ${rowY(SCENE[2], 0) + 8}V${rowY(SCENE[3], 2) - 8}Q${620} ${rowY(SCENE[3], 2)} ${612} ${rowY(SCENE[3], 2)}H${SCENE[3].x + W}`,
    oneAt: [SCENE[2].x + W + 8, rowY(SCENE[2], 0)],
    manyAt: [SCENE[3].x + W, rowY(SCENE[3], 2)],
    manyDir: -1,
  },
];

function SceneTableCard({ t, delay }: { t: SceneTable; delay: number }) {
  const h = tableH(t);
  return (
    <motion.g
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
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

export const SchemaDesignSkeleton = () => {
  const lineClass = "stroke-gray-400/80 dark:stroke-neutral-500";

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <svg viewBox="0 0 640 330" className="-mt-8 h-full max-h-66 w-full max-w-128 font-sans" aria-hidden>
        <style>{`@keyframes hiw-flow{to{stroke-dashoffset:-11}}.hiw-flow{stroke-dasharray:5 6;animation:hiw-flow 1s linear infinite}@media (prefers-reduced-motion:reduce){.hiw-flow{animation:none}}`}</style>

        {LINKS.map((l, i) => (
          <motion.g
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.7 + i * 0.15 }}
          >
            <path d={l.d} fill="none" strokeWidth={1.3} className={lineClass} />
            {/* The first line is "hovered": lit in the accent with the flowing dash. */}
            {i === 0 && <path d={l.d} fill="none" stroke={INDIGO} strokeWidth={1.8} className="hiw-flow" />}
            {/* One end: a bar. Many end: a crow's foot on the foreign key. */}
            <line
              x1={l.oneAt[0]}
              x2={l.oneAt[0]}
              y1={l.oneAt[1] - 5}
              y2={l.oneAt[1] + 5}
              strokeWidth={1.5}
              strokeLinecap="round"
              className={i === 0 ? undefined : lineClass}
              stroke={i === 0 ? INDIGO : undefined}
            />
            <path
              d={`M${l.manyAt[0]} ${l.manyAt[1] - 5}L${l.manyAt[0] - l.manyDir * 9} ${l.manyAt[1]}L${l.manyAt[0]} ${l.manyAt[1] + 5}`}
              fill="none"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={i === 0 ? undefined : lineClass}
              stroke={i === 0 ? INDIGO : undefined}
            />
          </motion.g>
        ))}

        {SCENE.map((t, i) => (
          <SceneTableCard key={t.name} t={t} delay={0.1 + i * 0.12} />
        ))}

        {/* The hovered relationship's two rows, highlighted like on the canvas. */}
        <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1, duration: 0.4 }}>
          <rect x={SCENE[0].x + 5} y={rowY(SCENE[0], 0) - 10} width={W - 10} height={20} rx={6} fill={INDIGO} fillOpacity={0.12} />
          <rect x={SCENE[1].x + 5} y={rowY(SCENE[1], 1) - 10} width={W - 10} height={20} rx={6} fill={INDIGO} fillOpacity={0.12} />
        </motion.g>
      </svg>

      {/* The floating canvas toolbar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
        className="absolute bottom-7 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-[14px] border border-gray-200 bg-white/90 p-1 text-[11.5px] font-medium text-charcoal-700 shadow-lg backdrop-blur dark:border-neutral-700 dark:bg-neutral-900/90 dark:text-neutral-100"
      >
        {[
          { label: "Table", icon: TableIcon, color: "text-indigo-500" },
          { label: "Note", icon: StickyNote, color: "text-gray-400 dark:text-neutral-500" },
          { label: "Area", icon: Square, color: "text-gray-400 dark:text-neutral-500" },
        ].map(({ label, icon: Icon, color }, i) => (
          <span
            key={label}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-[9px] px-2.5",
              i === 0 && "bg-gray-100 dark:bg-neutral-800"
            )}
          >
            <Icon className={cn("size-3.5", color)} />
            {label}
          </span>
        ))}
        <span className="mx-1 h-4 w-px bg-gray-200 dark:bg-neutral-700" />
        <span className="flex items-center text-gray-400 dark:text-neutral-500">
          <Minus className="mx-1.5 size-3.5" />
          <span className="w-9 text-center text-charcoal-700 tabular-nums dark:text-neutral-100">100%</span>
          <Plus className="mx-1.5 size-3.5" />
          <Maximize className="mx-1.5 size-3.5" />
        </span>
      </motion.div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────────────────
   Tab 2 — Generate documentation instantly
───────────────────────────────────────────────────────────────────────────── */

export const DocsPreviewSkeleton = () => {
  const tables = [
    { name: "users", color: INDIGO },
    { name: "orders", color: AMBER },
    { name: "products", color: EMERALD },
    { name: "order_items", color: PINK },
  ];

  const columns: { name: string; type: string; badge?: "PK" | "FK"; note: string }[] = [
    { name: "id", type: "int", badge: "PK", note: "Auto increment" },
    { name: "user_id", type: "int", badge: "FK", note: "→ users.id" },
    { name: "status", type: "varchar", note: "Not null" },
    { name: "created_at", type: "timestamp", note: "Default now()" },
  ];

  return (
    <div className="flex h-full w-full items-center justify-center">
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="relative flex h-80 w-108 flex-col overflow-hidden rounded-[14px] border border-gray-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
      >
        {/* Docs top bar */}
        <div className="flex shrink-0 items-center gap-2 border-b border-gray-200 px-3.5 py-2.5 dark:border-neutral-700">
          <span className="grid size-6 place-items-center rounded-md bg-indigo-500/12 text-indigo-500">
            <BookOpen className="size-3.5" />
          </span>
          <span className="text-[11.5px] text-gray-400 dark:text-neutral-500">Docs</span>
          <span className="text-[11.5px] text-gray-300 dark:text-neutral-600">/</span>
          <span className="text-[11.5px] font-medium text-charcoal-700 dark:text-neutral-100">orders</span>
          <span className="ml-auto flex h-6 items-center gap-1.5 rounded-md border border-gray-200 px-2 text-[10.5px] text-gray-400 dark:border-neutral-700 dark:text-neutral-500">
            <Search className="size-3" />
            Search
          </span>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Sidebar: tables in their canvas colours */}
          <div className="flex w-32 shrink-0 flex-col gap-0.5 border-r border-gray-200 bg-gray-50/60 p-2 dark:border-neutral-700 dark:bg-neutral-800/30">
            <span className="px-1.5 pt-1 pb-1.5 text-[9.5px] font-semibold tracking-wider text-gray-400 uppercase dark:text-neutral-500">
              Tables · 4
            </span>
            {tables.map((t, index) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.2 + index * 0.1 }}
                className={cn(
                  "flex items-center gap-2 rounded-md px-1.5 py-1.5 text-[11px]",
                  t.name === "orders"
                    ? "bg-white font-medium text-charcoal-700 shadow-sm ring-1 ring-gray-200 dark:bg-neutral-900 dark:text-neutral-100 dark:ring-neutral-700"
                    : "text-gray-500 dark:text-neutral-400"
                )}
              >
                <span className="size-2 shrink-0 rounded-[3px]" style={{ background: t.color }} />
                <span className="truncate">{t.name}</span>
              </motion.div>
            ))}
          </div>

          {/* Page */}
          <div className="flex flex-1 flex-col overflow-hidden p-4">
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-[4px]" style={{ background: AMBER }} />
              <span className="text-[15px] font-semibold text-charcoal-700 dark:text-neutral-100">orders</span>
              <span className="ml-auto rounded-md bg-gray-100 px-1.5 py-0.5 text-[9.5px] font-medium text-gray-500 dark:bg-neutral-800 dark:text-neutral-400">
                4 columns
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-gray-500 dark:text-neutral-400">
              Orders placed by customers, linked to users and their items.
            </p>

            <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 dark:border-neutral-700">
              {columns.map((col, index) => (
                <motion.div
                  key={col.name}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.4 + index * 0.12 }}
                  className={cn(
                    "flex items-center gap-2 px-2.5 py-1.5 text-[11px]",
                    index > 0 && "border-t border-gray-100 dark:border-neutral-800"
                  )}
                >
                  <span
                    className={cn(
                      "w-6 shrink-0 rounded-[5px] py-px text-center text-[8.5px] font-semibold",
                      col.badge === "PK" && "bg-amber-500/15 text-amber-600",
                      col.badge === "FK" && "bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-neutral-400"
                    )}
                  >
                    {col.badge}
                  </span>
                  <span
                    className={cn(
                      "w-18 truncate text-charcoal-700 dark:text-neutral-200",
                      col.badge === "PK" && "font-semibold"
                    )}
                  >
                    {col.name}
                  </span>
                  <span className="w-15 truncate text-gray-400 dark:text-neutral-500">{col.type}</span>
                  <span
                    className={cn(
                      "ml-auto truncate",
                      col.badge === "FK" ? "font-medium text-indigo-500" : "text-gray-400 dark:text-neutral-500"
                    )}
                  >
                    {col.note}
                  </span>
                </motion.div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10.5px]">
              <span className="text-gray-400 dark:text-neutral-500">Related</span>
              {[
                { dir: "→", name: "users", color: INDIGO },
                { dir: "←", name: "order_items", color: PINK },
              ].map((r) => (
                <span
                  key={r.name}
                  className="flex items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5 text-charcoal-700 dark:bg-neutral-800 dark:text-neutral-200"
                >
                  <span className="text-gray-400">{r.dir}</span>
                  <span className="size-1.5 rounded-[2px]" style={{ background: r.color }} />
                  {r.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────────────────
   Tab 3 — Catch issues before you ship: the Issues tab, scrolling
───────────────────────────────────────────────────────────────────────────── */

type Severity = "error" | "warning" | "info";

const SEVERITY = {
  error: { icon: AlertCircle, text: "text-red-500", label: "Error" },
  warning: { icon: AlertTriangle, text: "text-amber-500", label: "Warning" },
  info: { icon: Info, text: "text-sky-500", label: "Suggestion" },
} as const;

export const IssuesFeedSkeleton = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  const issues = useMemo(
    () =>
      [
        {
          table: "customers",
          color: EMERALD,
          severity: "error" as Severity,
          message: "Duplicate table name",
          hint: "Also defined as clients. Rename one of them.",
        },
        {
          table: "audit_logs",
          color: "#8b5cf6",
          severity: "warning" as Severity,
          message: "No primary key",
          hint: "Add an id column so rows can be referenced.",
        },
        {
          table: "order",
          color: AMBER,
          severity: "error" as Severity,
          message: "Reserved word as a table name",
          hint: "Most databases need it quoted. Try orders.",
        },
        {
          table: "orders",
          color: AMBER,
          severity: "warning" as Severity,
          message: "Type mismatch on a relationship",
          hint: "orders.user_id is varchar, users.id is int.",
        },
        {
          table: "temp_migrations",
          color: "#0ea5e9",
          severity: "info" as Severity,
          message: "Table has no relationships",
          hint: "Nothing points to it and it points nowhere.",
        },
        {
          table: "sessions",
          color: PINK,
          severity: "error" as Severity,
          message: "No primary key",
          hint: "Add an id column so rows can be referenced.",
        },
      ] as const,
    []
  );

  const extendedIssues = useMemo(() => [...issues, ...issues, ...issues], [issues]);

  const itemHeight = 84 + 8;

  const y = useMotionValue(0);
  const totalHeight = extendedIssues.length * itemHeight;

  useEffect(() => {
    let animationFrame: number;
    let lastTime = performance.now();
    let isVisible = false;
    const speed = 20;

    function animateScroll(now: number) {
      if (!isVisible) return;
      const elapsed = (now - lastTime) / 1000;
      lastTime = now;
      let current = y.get();
      current -= speed * elapsed;
      if (Math.abs(current) >= totalHeight / 3) {
        current += totalHeight / 3;
      }
      y.set(current);
      animationFrame = requestAnimationFrame(animateScroll);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
        if (isVisible) {
          lastTime = performance.now();
          animationFrame = requestAnimationFrame(animateScroll);
        } else {
          cancelAnimationFrame(animationFrame);
        }
      },
      { threshold: 0 }
    );

    if (containerRef.current) observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(animationFrame);
    };
  }, [y, totalHeight]);

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      ref={containerRef}
      style={{
        maskImage: "linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)",
      }}
    >
      <motion.div className="absolute left-1/2 flex w-full -translate-x-1/2 flex-col items-center gap-2" style={{ y }}>
        {extendedIssues.map((issue, index) => (
          <IssueCard key={`${index}-${issue.message}-${issue.table}`} {...issue} />
        ))}
      </motion.div>
    </div>
  );
};

/** One Issues-tab group card: the table's header in its canvas colour, then the issue. */
const IssueCard = ({
  table,
  color,
  severity,
  message,
  hint,
}: {
  table: string;
  color: string;
  severity: Severity;
  message: string;
  hint: string;
}) => {
  const s = SEVERITY[severity];
  const Icon = s.icon;
  return (
    <div className="h-21 w-full max-w-sm shrink-0 overflow-hidden rounded-[10px] border border-gray-200 bg-white shadow-md dark:border-neutral-700 dark:bg-neutral-900">
      <div className="flex h-8 items-center gap-2 border-b border-gray-200 px-3 dark:border-neutral-700">
        <span className="size-2.5 rounded-[3px]" style={{ background: color }} />
        <span className="truncate text-[12px] font-semibold text-charcoal-700 dark:text-neutral-100">{table}</span>
        <span className={cn("ml-auto flex items-center gap-1 text-[10.5px] font-medium", s.text)}>
          <Icon className="size-3" />1
        </span>
      </div>
      <div className="flex items-start gap-2.5 px-3 py-2">
        <Icon className={cn("mt-0.5 size-3.5 shrink-0", s.text)} aria-label={s.label} />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[12.5px] text-charcoal-700 dark:text-neutral-200">{message}</span>
          <span className="truncate text-[11px] text-gray-500 dark:text-neutral-400">{hint}</span>
        </div>
      </div>
    </div>
  );
};
