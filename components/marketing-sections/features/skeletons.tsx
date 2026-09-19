"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useState, useEffect } from "react";
import { Check, Copy, Download, KeyRound, Link2, Wand2 } from "lucide-react";
import { WindowIcon } from "@/components/uiJsxAssets/window-icon";
import { CodeIcon } from "@/components/uiJsxAssets/code-icon";
import { PhoneIcon } from "@/components/uiJsxAssets/phone-icon";
import { LogoSVG } from "@/components/uiJsxAssets/logo";
import { useTypewriter } from "@/hooks/use-typewriter";
import { cn } from "@/lib/utils";
import {
  SCENE_STYLE,
  SceneLink,
  SceneRowHighlight,
  SceneTableCard,
  TABLE_W,
  rowY,
  route,
  type SceneLinkDef,
  type SceneTable,
} from "@/components/marketing-general/canvas-scene";

/* ─────────────────────────────────────────────────────────────────────────────
   These mockups mirror the editor as it looks today: table cards in the
   Recommended canvas style (colour square, key / link icons, types on the
   right), the Code tab (format tabs, table colours, status bar) and the Luna AI
   panel. Keep them in step when the editor's look changes.
───────────────────────────────────────────────────────────────────────────── */

const TABLE_COLORS: Record<string, string> = {
  users: "#6366f1",
  orders: "#f59e0b",
  products: "#10b981",
  clients: "#0ea5e9",
  projects: "#8b5cf6",
  tasks: "#f97316",
  comments: "#ec4899",
  relations: "#14b8a6",
};

type MiniCol = { name: string; type: string; kind?: "pk" | "fk" };

const MINI_COLUMNS: Record<string, MiniCol[]> = {
  users: [
    { name: "id", type: "int", kind: "pk" },
    { name: "email", type: "text" },
    { name: "name", type: "text" },
  ],
  orders: [
    { name: "id", type: "int", kind: "pk" },
    { name: "user_id", type: "int", kind: "fk" },
    { name: "total", type: "numeric" },
  ],
  products: [
    { name: "id", type: "int", kind: "pk" },
    { name: "sku", type: "text" },
    { name: "price", type: "numeric" },
  ],
  clients: [
    { name: "id", type: "int", kind: "pk" },
    { name: "name", type: "varchar" },
    { name: "email", type: "varchar" },
    { name: "is_active", type: "bool" },
  ],
  relations: [
    { name: "id", type: "int", kind: "pk" },
    { name: "from_id", type: "int", kind: "fk" },
    { name: "to_id", type: "int", kind: "fk" },
  ],
};

const columnsFor = (label: string): MiniCol[] =>
  MINI_COLUMNS[label] ?? [
    { name: "id", type: "int", kind: "pk" },
    { name: "name", type: "text" },
    { name: "user_id", type: "int", kind: "fk" },
  ];

/** A canvas table card in the Recommended style. `sm` fits inside a TableBlock. */
function CanvasTableCard({
  label,
  size = "md",
  showCount = true,
}: {
  label: string;
  size?: "sm" | "md";
  /** The "N cols" label; off where cards sit three abreast. */
  showCount?: boolean;
}) {
  const color = TABLE_COLORS[label] ?? "#6366f1";
  const cols = columnsFor(label);
  const sm = size === "sm";
  return (
    <div
      className={cn(
        "flex w-full flex-col overflow-hidden border border-gray-200 bg-white shadow-[0_1px_1.5px_rgb(0_0_0/0.06),0_6px_16px_rgb(0_0_0/0.06)] dark:border-neutral-700 dark:bg-neutral-900",
        sm ? "rounded-md" : "rounded-[10px]"
      )}
    >
      <div
        className={cn(
          "flex items-center border-b border-gray-200 font-semibold text-charcoal-700 dark:border-neutral-700 dark:text-neutral-100",
          sm ? "gap-1 px-1.5 py-1 text-[8px]" : "gap-2 px-2.5 py-2 text-[11.5px]"
        )}
      >
        <span
          className={cn("shrink-0", sm ? "size-1.5 rounded-[2px]" : "size-2.5 rounded-[3px]")}
          style={{ background: color }}
        />
        <span className="truncate">{label}</span>
        {!sm && showCount && (
          <span className="ml-auto text-[9px] font-medium text-gray-400 dark:text-neutral-500">{cols.length} cols</span>
        )}
      </div>
      <div className={cn("flex flex-col", sm ? "px-0.5 py-0.5" : "px-1 py-1")}>
        {cols.map((c) => (
          <div
            key={c.name}
            className={cn("flex items-center rounded-[5px]", sm ? "gap-1 px-1 py-px text-[7px]" : "gap-1.5 px-1.5 py-1 text-[10.5px]")}
          >
            <span className={cn("grid shrink-0 place-items-center", sm ? "w-1.5" : "w-3")}>
              {c.kind === "pk" && <KeyRound className={sm ? "size-1.5" : "size-2.5"} style={{ color }} />}
              {c.kind === "fk" && (
                <Link2 className={cn("text-gray-400 dark:text-neutral-500", sm ? "size-1.5" : "size-2.5")} />
              )}
            </span>
            <span className={cn("truncate text-charcoal-700 dark:text-neutral-200", c.kind === "pk" && "font-semibold")}>
              {c.name}
            </span>
            <span className="ml-auto shrink-0 text-gray-400 dark:text-neutral-500">{c.type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// "AI Schema Generator" card — the Luna AI panel: describe your app, get tables.
export const AISchemaGeneratorSkeleton = () => {
  const PROMPT = "An e-commerce store with users, orders, and products";
  const [started, setStarted] = useState(false);
  const { displayText, isComplete } = useTypewriter(started ? PROMPT : "", 35);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setStarted(true), 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isComplete) return;
    const timer = setTimeout(() => setShowResult(true), 400);
    return () => clearTimeout(timer);
  }, [isComplete]);

  return (
    <motion.div className="relative mx-auto mt-8 flex h-full max-h-72 min-h-56 w-[88%] flex-col overflow-hidden rounded-[14px] border border-gray-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-900">
      <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-2.5 dark:border-neutral-700">
        <span className="grid size-6 place-items-center rounded-md bg-indigo-500/12 text-indigo-500">
          <Wand2 className="size-3.5" />
        </span>
        <span className="text-xs font-semibold text-charcoal-700 dark:text-neutral-100">Luna AI</span>
        <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-neutral-800 dark:text-neutral-400">
          Schema from a description
        </span>
      </div>

      <div className="flex flex-col gap-3 p-3">
        {/* The user's message, typed out */}
        <div className="ml-auto max-w-[85%] rounded-xl rounded-br-sm bg-indigo-500 px-3 py-2 text-xs text-white">
          {displayText || " "}
          {started && !isComplete && <span className="animate-pulse">|</span>}
        </div>

        <AnimatePresence>
          {showResult && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col gap-2"
            >
              <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-neutral-400">
                <span className="grid size-4 place-items-center rounded-full bg-emerald-500/15 text-emerald-600">
                  <Check className="size-2.5" strokeWidth={3} />
                </span>
                Added 3 tables and 2 relationships to your canvas
              </div>
              <div className="flex gap-2">
                {["users", "orders", "products"].map((label, index) => (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, y: 10, scale: 0.94 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.3, delay: index * 0.15 }}
                    className="w-1/3 min-w-0"
                  >
                    <CanvasTableCard label={label} showCount={false} />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

// "From Code to Canvas, Instantly" card — the Code tab next to the table it draws.
const DBML_LINES: { number: number; content: React.ReactNode }[] = [
  {
    number: 1,
    content: (
      <>
        <span className="font-medium text-indigo-500">Table</span>{" "}
        <span
          className="mr-1 inline-block size-2 rounded-[2.5px] align-[0.05em]"
          style={{ background: TABLE_COLORS.clients }}
        />
        <span className="font-semibold text-charcoal-700 dark:text-neutral-100">clients</span>{" "}
        <span className="text-gray-400 dark:text-neutral-500">{"{"}</span>
      </>
    ),
  },
  {
    number: 2,
    content: (
      <>
        {"  "}
        <span className="text-charcoal-700 dark:text-neutral-200">id</span>{" "}
        <span className="text-teal-600 dark:text-teal-400">int</span>{" "}
        <span className="text-purple-600 dark:text-purple-400">[pk, increment]</span>
      </>
    ),
  },
  {
    number: 3,
    content: (
      <>
        {"  "}
        <span className="text-charcoal-700 dark:text-neutral-200">name</span>{" "}
        <span className="text-teal-600 dark:text-teal-400">varchar</span>
      </>
    ),
  },
  {
    number: 4,
    content: (
      <>
        {"  "}
        <span className="text-charcoal-700 dark:text-neutral-200">email</span>{" "}
        <span className="text-teal-600 dark:text-teal-400">varchar</span>
      </>
    ),
  },
  {
    number: 5,
    content: (
      <>
        {"  "}
        <span className="text-charcoal-700 dark:text-neutral-200">is_active</span>{" "}
        <span className="text-teal-600 dark:text-teal-400">bool</span>
      </>
    ),
  },
  {
    number: 6,
    content: <span className="text-gray-400 dark:text-neutral-500">{"}"}</span>,
  },
];

export const TextToWorkflowBuilderSkeleton = () => {
  const previewDelay = 0.15 + DBML_LINES.length * 0.16 + 0.2;

  return (
    <motion.div className="relative mx-auto mt-6 flex h-full max-h-72 min-h-60 w-[94%] flex-col overflow-hidden rounded-[14px] border border-gray-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-900">
      {/* Code tab toolbar: format tabs, copy, download */}
      <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50/70 px-2.5 py-2 dark:border-neutral-700 dark:bg-neutral-800/40">
        <div className="flex gap-0.5 rounded-lg border border-gray-200 bg-gray-100 p-0.5 text-[10.5px] dark:border-neutral-700 dark:bg-neutral-800">
          {["DBML", "JSON", "Mermaid"].map((f, i) => (
            <span
              key={f}
              className={cn(
                "rounded-md px-2 py-0.5",
                i === 0
                  ? "bg-white font-medium text-charcoal-700 shadow-sm dark:bg-neutral-900 dark:text-neutral-100"
                  : "text-gray-500 dark:text-neutral-400"
              )}
            >
              {f}
            </span>
          ))}
        </div>
        <span className="ml-auto flex gap-2 text-gray-400 dark:text-neutral-500">
          <Copy className="size-3.5" />
          <Download className="size-3.5" />
        </span>
      </div>

      <div className="grid flex-1 grid-cols-2 divide-x divide-gray-200 dark:divide-neutral-700">
        <div className="py-2 text-[11px] leading-[19px]">
          {DBML_LINES.map((line, index) => (
            <motion.div
              key={line.number}
              initial={{ opacity: 0, x: -6 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: 0.15 + index * 0.16 }}
              className="flex gap-2.5"
            >
              <span className="w-6 shrink-0 text-right text-gray-300 tabular-nums select-none dark:text-neutral-600">
                {line.number}
              </span>
              <span className="whitespace-pre">{line.content}</span>
            </motion.div>
          ))}
        </div>

        {/* The canvas, drawing the same table */}
        <div className="relative flex items-center justify-center bg-[radial-gradient(rgb(17_24_39/0.12)_1px,transparent_1.2px)] [background-size:12px_12px] p-3 dark:bg-[radial-gradient(rgb(225_227_240/0.1)_1px,transparent_1.2px)]">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: previewDelay }}
            className="w-full max-w-44"
          >
            <CanvasTableCard label="clients" />
          </motion.div>
        </div>
      </div>

      {/* Status bar */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.3, delay: previewDelay + 0.4 }}
        className="flex items-center gap-2 border-t border-gray-200 bg-gray-50/70 px-2.5 py-1.5 text-[10px] text-gray-500 dark:border-neutral-700 dark:bg-neutral-800/40 dark:text-neutral-400"
      >
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/12 px-2 py-0.5 font-medium text-emerald-600 dark:text-emerald-400">
          <span className="size-1.5 rounded-full bg-current" />
          Synced with canvas
        </span>
        <span className="ml-auto">1 table · Ln 4, Col 18 · DBML</span>
      </motion.div>
    </motion.div>
  );
};

// Mini schema for the "Native Visual Schema Builder" card: four tables and
// the relationships between them. Coordinates are in the SVG's own units.
const MINI_SCENE: SceneTable[] = [
  {
    name: "users",
    color: TABLE_COLORS.users,
    x: 16,
    y: 26,
    cols: [
      { name: "id", type: "int", kind: "pk" },
      { name: "email", type: "text", kind: "uq" },
      { name: "name", type: "text" },
    ],
  },
  {
    name: "projects",
    color: TABLE_COLORS.projects,
    x: 256,
    y: 8,
    cols: [
      { name: "id", type: "int", kind: "pk" },
      { name: "name", type: "text" },
      { name: "owner_id", type: "int", kind: "fk" },
    ],
  },
  {
    name: "tasks",
    color: TABLE_COLORS.tasks,
    x: 256,
    y: 140,
    cols: [
      { name: "id", type: "int", kind: "pk" },
      { name: "project_id", type: "int", kind: "fk" },
      { name: "title", type: "text" },
    ],
  },
  {
    name: "comments",
    color: TABLE_COLORS.comments,
    x: 16,
    y: 154,
    cols: [
      { name: "id", type: "int", kind: "pk" },
      { name: "task_id", type: "int", kind: "fk" },
      { name: "user_id", type: "int", kind: "fk" },
    ],
  },
];

const [mUsers, mProjects, mTasks, mComments] = MINI_SCENE;
const LEFT_EDGE = mUsers.x + TABLE_W;
const RIGHT_EDGE = mProjects.x + TABLE_W;

const MINI_LINKS: SceneLinkDef[] = [
  {
    // users.id → projects.owner_id
    d: route(LEFT_EDGE, rowY(mUsers, 0), mProjects.x, rowY(mProjects, 2), 218),
    oneAt: [LEFT_EDGE + 8, rowY(mUsers, 0)],
    manyAt: [mProjects.x, rowY(mProjects, 2)],
    manyDir: 1,
  },
  {
    // projects.id → tasks.project_id, down the right edge of that column
    d: `M${RIGHT_EDGE} ${rowY(mProjects, 0)}H${RIGHT_EDGE + 8}Q${RIGHT_EDGE + 16} ${rowY(mProjects, 0)} ${RIGHT_EDGE + 16} ${rowY(mProjects, 0) + 8}V${rowY(mTasks, 1) - 8}Q${RIGHT_EDGE + 16} ${rowY(mTasks, 1)} ${RIGHT_EDGE + 8} ${rowY(mTasks, 1)}H${RIGHT_EDGE}`,
    oneAt: [RIGHT_EDGE + 8, rowY(mProjects, 0)],
    manyAt: [RIGHT_EDGE, rowY(mTasks, 1)],
    manyDir: -1,
  },
  {
    // tasks.id → comments.task_id
    d: route(mTasks.x, rowY(mTasks, 0), LEFT_EDGE, rowY(mComments, 1), 218),
    oneAt: [mTasks.x - 8, rowY(mTasks, 0)],
    manyAt: [LEFT_EDGE, rowY(mComments, 1)],
    manyDir: -1,
  },
  {
    // users.id → comments.user_id, down the left edge
    d: `M${mUsers.x} ${rowY(mUsers, 0)}H${mUsers.x - 4}Q${mUsers.x - 12} ${rowY(mUsers, 0)} ${mUsers.x - 12} ${rowY(mUsers, 0) + 8}V${rowY(mComments, 2) - 8}Q${mUsers.x - 12} ${rowY(mComments, 2)} ${mUsers.x - 4} ${rowY(mComments, 2)}H${mComments.x}`,
    oneAt: [mUsers.x - 6, rowY(mUsers, 0)],
    manyAt: [mComments.x, rowY(mComments, 2)],
    manyDir: 1,
  },
];

function MiniSchemaCanvas() {
  return (
    <div className="relative shrink-0 rounded-[14px] border border-gray-200 bg-white/60 bg-[radial-gradient(rgb(17_24_39/0.1)_1px,transparent_1.2px)] [background-size:12px_12px] p-2 shadow-sm dark:border-neutral-700 dark:bg-neutral-900/60 dark:bg-[radial-gradient(rgb(225_227_240/0.08)_1px,transparent_1.2px)]">
      <svg viewBox="0 0 440 272" className="block w-[360px] max-w-full font-sans xl:w-[400px]" aria-hidden>
        <style>{SCENE_STYLE}</style>
        {MINI_LINKS.map((l, i) => (
          <SceneLink key={i} link={l} lit={i === 0} delay={0.6 + i * 0.15} />
        ))}
        {MINI_SCENE.map((t, i) => (
          <SceneTableCard key={t.name} t={t} delay={0.1 + i * 0.12} />
        ))}
        <SceneRowHighlight t={mUsers} row={0} delay={1.1} />
        <SceneRowHighlight t={mProjects} row={2} delay={1.1} />
      </svg>
    </div>
  );
}

export const NativeToolsIntegrationSkeleton = () => {
  return (
    <>
      {/* Mobile / small screens illustration stays untouched */}
      <div className="relative mx-auto my-24 h-full w-full scale-[2] sm:scale-[1.5] md:scale-[1.2] lg:hidden">
        <Image
          src="/images/nativeVisualSchemaBuilder.png"
          alt="Native Visual Schema Builder"
          width={1200}
          height={1200}
          className="dark:invert dark:filter"
        />
      </div>

      {/* Desktop layout stays untouched, only inner icons swapped */}
      <motion.div className="relative mx-auto my-12 hidden h-full max-h-70 min-h-80 max-w-[67rem] grid-cols-2 p-4 lg:grid">
        <div className="hidden items-center justify-between md:flex">
          <div className="flex flex-col gap-10">
            <TextIconBlock icon={<WindowIcon />} text="Drag & Drop Tables">
              <TopSVG className="absolute top-2 -right-84" />
            </TextIconBlock>
            <TextIconBlock icon={<CodeIcon />} text="Define Columns">
              <MiddleSVG className="absolute top-2 -right-84" />
            </TextIconBlock>
            <TextIconBlock icon={<PhoneIcon />} text="Map Relationships">
              <BottomSVG className="absolute -right-84 bottom-2" />
            </TextIconBlock>
          </div>

          {/* Center "connection" node stays untouched */}
          <div className="relative h-16 w-16 overflow-hidden rounded-md bg-gray-200 p-px shadow-xl dark:bg-neutral-700">
            <div className="absolute inset-0 scale-[1.4] animate-spin rounded-full bg-conic [background-image:conic-gradient(at_center,transparent,var(--color-blue-500)_20%,transparent_30%)] [animation-duration:2s]"></div>
            <div className="absolute inset-0 scale-[1.4] animate-spin rounded-full [background-image:conic-gradient(at_center,transparent,var(--color-brand)_20%,transparent_30%)] [animation-delay:1s] [animation-duration:2s]"></div>
            <div className="relative z-20 flex h-full w-full items-center justify-center rounded-[5px] bg-white dark:bg-neutral-900">
              <LogoSVG className="text-black dark:text-white" />
            </div>
          </div>
        </div>

        {/* The link from the centre node, then the schema it builds: a small
            canvas drawn like the editor's, with the relationships between tables. */}
        <div className="relative flex h-full w-full min-w-0 items-center">
          <RightSideSVG className="min-w-6 flex-1" />

          <span className="relative z-20 flex shrink-0 items-center gap-1.5 rounded-full border border-indigo-500/40 bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
            <span className="size-1.5 rounded-full bg-current" />
            Connected
          </span>

          <RightSideSVG className="w-6 shrink-0" />

          <MiniSchemaCanvas />
        </div>
      </motion.div>
    </>
  );
};

const RightSideSVG = ({ className }: { className?: string }) => (
  <div className={cn("relative overflow-hidden", className)} style={{ height: 2 }} aria-hidden>
    <div
      className="absolute inset-0"
      style={{ background: "var(--color-line)" }}
    />
    <div
      className="line-sweep-h absolute top-0 left-0 h-full"
      style={{
        width: "30%",
        background:
          "linear-gradient(to right, transparent, var(--color-blue-500), transparent)",
      }}
    />
  </div>
);

const TopSVG = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      width="312"
      height="33"
      viewBox="0 0 312 33"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <line
        x1="0.5"
        y1="1"
        x2="311.5"
        y2="1"
        stroke="var(--color-line)"
        strokeLinecap="round"
      />
      <line
        x1="311.5"
        y1="1"
        x2="311.5"
        y2="32"
        stroke="var(--color-line)"
        strokeLinecap="round"
      />
    </svg>
  );
};

export const MiddleSVG = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      width="323"
      height="2"
      viewBox="0 0 323 2"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <line
        x1="0.5"
        y1="1"
        x2="322.5"
        y2="1"
        stroke="var(--color-line)"
        strokeLinecap="round"
      />
    </svg>
  );
};

export const BottomSVG = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      width="326"
      height="32"
      viewBox="0 0 326 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <line y1="31" x2="325" y2="31" stroke="var(--color-line)" />
      <line
        x1="325.5"
        y1="31"
        x2="325.5"
        y2="1"
        stroke="var(--color-line)"
        strokeLinecap="round"
      />
    </svg>
  );
};

const TextIconBlock = ({
  icon,
  text,
  children,
}: {
  icon: React.ReactNode;
  text: string;
  children?: React.ReactNode;
}) => {
  return (
    <div className="relative flex items-center gap-2">
      {icon}
      <span className="text-charcoal-700 text-sm font-medium dark:text-neutral-200">
        {text}
      </span>
      {children}
    </div>
  );
};
