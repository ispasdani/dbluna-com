"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  animate,
  AnimatePresence,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "motion/react";
import {
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileText,
  Focus,
  HardDrive,
  History,
  Layers,
  Minus,
  Moon,
  Palette,
  PanelsTopLeft,
  Plus,
  Scan,
  Share2,
  Square,
  StickyNote,
  Sun,
  Table2,
  Upload,
  UserPlus,
  WandSparkles,
  X,
} from "lucide-react";

import { DbLunaFuturistic } from "@/components/uiJsxAssets/dbluna-logo";
import { cn } from "@/lib/utils";
import {
  LINKS,
  SCHEMA_NAMES,
  TABLES,
  TABLE_W,
  HEAD,
  ROW,
  TYPED_COL,
  buildDbml,
  colTokens,
  endPoint,
  heroStubs,
  lineLength,
  route,
  rowY,
  schemaGraph,
  schemaTables,
  tableH,
  type CodeLine,
  type HeroLinkDef,
  type HeroTable,
  type TokenKind,
} from "./scene-data";

/* ─────────────────────────────────────────────────────────────────────────────
   The hero's picture of the editor: top navbar, tab bar, Code dock and canvas,
   drawn at a fixed 1440 × 810 and scaled to fit. On a loop it lights up
   relationships (with the matching DBML line), drags a table, types a new
   column that appears on the canvas, then opens the Schemas tab, hides two
   schemas (one from the tab, one from the toolbar's Schemas menu) — leaving
   dashed stubs where their relationships went — and shows them again.
   Pure markup — no stores, no Convex.
   Keep it roughly in step with app/(diagram)/d/[id]/page.tsx.
───────────────────────────────────────────────────────────────────────────── */

const W = 1440;
const H = 810;
const TOP = 104; // navbar (56) + tab bar (48)
const CANVAS_H = H - TOP;
const DOCK_W = 360;
const LINE_H = 19;
const CODE_AREA_H = CANVAS_H - 40 - 38 - 28; // dock tabs, format row, status bar
const VISIBLE_LINES = Math.floor(CODE_AREA_H / LINE_H);
const ACCENT = "#6366f1";
const INTRO_DELAY = 1.1; // the hero wrapper fades in after 1s
const DRAG_DY = 80;
const TYPED_FULL = lineLength(colTokens(TYPED_COL));

type StepId =
  | "l1"
  | "l3"
  | "dragDown"
  | "l8"
  | "type"
  | "dragUp"
  | "l4"
  | "schemasTab"
  | "hideAuth"
  | "hideCatalog"
  | "showAll";
const STEPS: { id: StepId; ms: number }[] = [
  { id: "l1", ms: 2600 },
  { id: "l3", ms: 2600 },
  { id: "dragDown", ms: 2800 },
  { id: "l8", ms: 2600 },
  { id: "type", ms: 3400 },
  { id: "dragUp", ms: 2800 },
  { id: "l4", ms: 2600 },
  { id: "schemasTab", ms: 2200 },
  { id: "hideAuth", ms: 2800 },
  { id: "hideCatalog", ms: 3800 },
  { id: "showAll", ms: 3200 },
];
// Steps whose pointer targets are measured from the DOM (their controls sit in
// laid-out HTML — the dock and the centred toolbar — not at fixed coordinates).
const AIMED: StepId[] = ["schemasTab", "hideAuth", "hideCatalog", "showAll"];
const INTRO_MS = 4200;

type Pt = { x: number; y: number };
// Where the pointer rests for each step, in editor coordinates.
const CURSOR_AT: Record<string, Pt> = {
  intro: { x: 1080, y: 760 },
  l1: { x: 646, y: 246 },
  l3: { x: 918, y: 244 },
  l8: { x: 1040, y: 598 },
  l2: { x: 628, y: 336 },
  l4: { x: 940, y: 326 },
  type: { x: 318, y: 520 },
  dragTop: { x: 1318, y: TOP + 110 + HEAD / 2 },
  dragBottom: { x: 1318, y: TOP + 110 + DRAG_DY + HEAD / 2 },
};

type SaveState = "idle" | "saving" | "saved";
type DockTab = "code" | "schemas";

export function HeroEditor() {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const reduce = useReducedMotion();
  const inView = useInView(boxRef, { amount: 0.25 });
  const started = useInView(boxRef, { amount: 0.25, once: true });

  const [step, setStep] = useState(-1);
  const [loop, setLoop] = useState(0);
  const [typed, setTyped] = useState<number | null>(null);
  // Step key a drag has begun / is holding the mouse in (-1: none).
  const [dragStep, setDragStep] = useState(-1);
  const [pressStep, setPressStep] = useState(-1);
  const [save, setSave] = useState<SaveState>("idle");
  const saveTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const dragY = useMotionValue(0);

  // The Schemas segment: which dock tab shows, which schemas are hidden, the
  // toolbar menu, and where the pointer is aimed (measured from the DOM).
  const stageRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(0);
  const [dockTab, setDockTab] = useState<DockTab>("code");
  const [hidden, setHidden] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [aim, setAim] = useState<Pt | null>(null);
  const [clicking, setClicking] = useState(false);

  // Centre of a `data-hero` element, in editor coordinates.
  const aimAt = (target: string) => {
    const el = stageRef.current?.querySelector(`[data-hero="${target}"]`);
    const stage = stageRef.current?.getBoundingClientRect();
    const k = scaleRef.current;
    if (!el || !stage || !k) return;
    const r = el.getBoundingClientRect();
    setAim({ x: (r.left + r.width / 2 - stage.left) / k, y: (r.top + r.height / 2 - stage.top) / k });
  };

  // Saving chip: Saving… → Saved → Saved on this device.
  const flashSave = () => {
    saveTimers.current.forEach(clearTimeout);
    setSave("saving");
    saveTimers.current = [setTimeout(() => setSave("saved"), 700), setTimeout(() => setSave("idle"), 2200)];
  };
  useEffect(() => () => saveTimers.current.forEach(clearTimeout), []);

  // Fit the fixed-size editor to the column width.
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      scaleRef.current = e.contentRect.width / W;
      setScale(scaleRef.current);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Step clock: runs only while the hero is on screen.
  useEffect(() => {
    if (!inView || reduce) return;
    const id = setTimeout(
      () => {
        setStep((s) => {
          const next = (s + 1) % STEPS.length;
          if (s >= 0 && next === 0) setLoop((l) => l + 1);
          return next;
        });
      },
      step < 0 ? INTRO_MS : STEPS[step].ms,
    );
    return () => clearTimeout(id);
  }, [step, inView, reduce]);

  const stepId = step < 0 ? null : STEPS[step].id;
  const typingNow = stepId === "type" && loop === 0;
  const stepKey = loop * STEPS.length + step; // unique per pass through the loop

  // What each step does. The pointer's resting place is derived below.
  useEffect(() => {
    if (!stepId) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    const tap = (ms: number, fn: () => void) => {
      at(ms, () => {
        setClicking(true);
        fn();
      });
      at(ms + 160, () => setClicking(false));
    };
    let typing: ReturnType<typeof setInterval> | undefined;

    if (stepId === "l1") {
      // A new pass starts from the plain editor, whatever the last one left.
      setDockTab("code");
      setHidden([]);
      setMenuOpen(false);
    } else if (stepId === "schemasTab") {
      at(0, () => aimAt("tab-schemas"));
      tap(800, () => setDockTab("schemas"));
    } else if (stepId === "hideAuth") {
      at(100, () => aimAt("eye-auth"));
      tap(950, () => setHidden((h) => [...h, "auth"]));
    } else if (stepId === "hideCatalog") {
      at(0, () => aimAt("schemas-chip"));
      tap(800, () => setMenuOpen(true));
      at(1350, () => aimAt("menu-catalog"));
      tap(2150, () => setHidden((h) => [...h, "catalog"]));
      at(3100, () => setMenuOpen(false));
    } else if (stepId === "showAll") {
      at(0, () => aimAt("show-all"));
      tap(800, () => setHidden([]));
      at(1500, () => aimAt("tab-code"));
      tap(2300, () => setDockTab("code"));
    } else if (stepId === "dragDown" || stepId === "dragUp") {
      at(750, () => {
        setDragStep(stepKey);
        setPressStep(stepKey);
        animate(dragY, stepId === "dragDown" ? DRAG_DY : 0, { duration: 0.9, ease: "easeInOut" });
      });
      at(1750, () => {
        setPressStep(-1);
        flashSave();
      });
    } else if (typingNow) {
      at(700, () => {
        setTyped(0);
        typing = setInterval(() => {
          setTyped((n) => {
            const next = (n ?? 0) + 1;
            if (next >= TYPED_FULL) clearInterval(typing);
            return Math.min(next, TYPED_FULL);
          });
        }, 55);
      });
      at(700 + TYPED_FULL * 55 + 250, flashSave);
    }

    return () => {
      timers.forEach(clearTimeout);
      if (typing) clearInterval(typing);
      // Leaving a step early (hero scrolled away) must not strand it half-done.
      setPressStep(-1);
      setClicking(false);
      if (typingNow) setTyped(TYPED_FULL);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per step
  }, [stepId, typingNow]);

  const cursor = (() => {
    if (stepId && AIMED.includes(stepId)) return { ...(aim ?? CURSOR_AT.l4), dur: 0.7 };
    if (stepId === "dragDown" || stepId === "dragUp") {
      const down = stepId === "dragDown";
      const moving = dragStep === stepKey;
      const pt = down === moving ? CURSOR_AT.dragBottom : CURSOR_AT.dragTop;
      return { ...pt, dur: moving ? 0.9 : 0.7 };
    }
    if (stepId === "type") return { ...(typingNow ? CURSOR_AT.type : CURSOR_AT.l2), dur: 0.8 };
    return { ...CURSOR_AT[stepId ?? "intro"], dur: 0.7 };
  })();
  const pressed = (pressStep === stepKey && step >= 0) || clicking;

  const typedChars = reduce ? TYPED_FULL : typed;
  const typedDone = typedChars === TYPED_FULL;

  const litId = reduce
    ? "customer-orders"
    : stepId === "l1"
      ? "customer-orders"
      : stepId === "l3"
        ? "order-items"
        : stepId === "dragDown" || stepId === "dragUp"
          ? "category-products"
          : stepId === "l8"
            ? "invoice-payments"
            : stepId === "type" && !typingNow
              ? "customer-users"
              : stepId === "l4"
                ? "product-items"
                : null;
  const lit = LINKS.find((l) => l.id === litId) ?? null;

  const lines = useMemo(() => buildDbml(typedChars), [typedChars]);
  const focusLine = useMemo(() => {
    if (typingNow && typedChars !== null) return lines.findIndex((l) => l.typed);
    if (!lit) return -1;
    return lines.findIndex((l) => l.ref?.table === lit.to.table && l.ref.row === lit.to.row);
  }, [lines, lit, typingNow, typedChars]);

  const drawn = started || !!reduce;

  const hiddenSet = useMemo(() => new Set(hidden), [hidden]);
  const stubs = useMemo(() => heroStubs(hiddenSet), [hiddenSet]);
  const isHidden = (tableId: string) => hiddenSet.has(TABLES.find((t) => t.id === tableId)!.schema);

  return (
    <div
      ref={boxRef}
      role="img"
      aria-label="The DBLuna editor: DBML code and the Schemas tab on the left, the matching tables and relationships on the canvas, with schemas switched off and back on."
      className="relative w-full overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_40px_-12px_rgb(0_0_0/0.18)] dark:border-neutral-700 dark:bg-neutral-900"
      style={{ aspectRatio: `${W} / ${H}` }}
    >
      <div
        aria-hidden
        className="absolute top-0 left-0 origin-top-left text-neutral-800 select-none dark:text-neutral-200"
        ref={stageRef}
        style={{ width: W, height: H, transform: `scale(${scale})`, visibility: scale ? "visible" : "hidden" }}
      >
        <TopNavbar save={save} />
        <TabBar />

        {/* Canvas */}
        <div
          className="absolute inset-x-0 bottom-0 bg-neutral-50 bg-[radial-gradient(var(--hero-dot)_1px,transparent_1px)] bg-[size:22px_22px] [--hero-dot:#d4d4d8] dark:bg-neutral-950 dark:[--hero-dot:#3f3f46]"
          style={{ top: TOP }}
        >
          <svg width={W} height={CANVAS_H} viewBox={`0 0 ${W} ${CANVAS_H}`} className="absolute inset-0 overflow-visible">
            <style>{`@keyframes hero-flow{to{stroke-dashoffset:-11}}.hero-flow{stroke-dasharray:5 6;animation:hero-flow 1s linear infinite}@media (prefers-reduced-motion:reduce){.hero-flow{animation:none}}`}</style>
            {LINKS.map((l, i) => (
              <Relationship
                key={l.id}
                def={l}
                lit={l.id === litId}
                hidden={isHidden(l.from.table) || isHidden(l.to.table)}
                dragY={dragY}
                drawn={drawn}
                delay={reduce ? 0 : INTRO_DELAY + 0.8 + i * 0.07}
              />
            ))}
            {TABLES.map((t, i) => (
              <TableCard
                key={t.id}
                t={t}
                extraCol={t.id === "customers" && typedDone}
                litRows={[
                  ...(lit?.from.table === t.id ? [lit.from.row] : []),
                  ...(lit?.to.table === t.id ? [lit.to.row] : []),
                ]}
                offsetY={t.id === "categories" ? dragY : undefined}
                shown={drawn}
                hidden={hiddenSet.has(t.schema)}
                delay={reduce ? 0 : INTRO_DELAY + i * 0.07}
              />
            ))}
            <AnimatePresence>
              {stubs.map((st) => (
                <CrossSchemaStub key={`${st.table}:${st.row}`} stub={st} />
              ))}
            </AnimatePresence>
          </svg>

          <FloatingToolbar hidden={hiddenSet} menuOpen={menuOpen} />
          <Minimap dragY={dragY} hidden={hiddenSet} />
          <div className="absolute right-4 flex size-9 items-center justify-center rounded-lg bg-brand text-white shadow-md" style={{ top: 534 }}>
            <WandSparkles className="size-4" />
          </div>
        </div>

        <CodeDock
          tab={dockTab}
          hidden={hiddenSet}
          lines={lines}
          focusLine={focusLine}
          typing={typingNow && typedChars !== null && !typedDone}
        />

        {/* Pointer */}
        {!reduce && (
          <motion.div
            className="pointer-events-none absolute top-0 left-0 z-40"
            initial={false}
            animate={{ x: cursor.x, y: cursor.y, opacity: step < 0 ? 0 : 1, scale: pressed ? 0.88 : 1 }}
            transition={{
              x: { duration: cursor.dur, ease: "easeInOut" },
              y: { duration: cursor.dur, ease: "easeInOut" },
              opacity: { duration: 0.3 },
              scale: { duration: 0.15 },
            }}
          >
            <svg width="20" height="22" viewBox="0 0 20 22" style={{ filter: "drop-shadow(0 1px 2px rgb(0 0 0 / 0.3))" }}>
              <path d="M2 1.5v16.2l4.3-4.1 2.8 6.4 3-1.3-2.8-6.3h6.1z" fill="#111" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ─── Chrome ──────────────────────────────────────────────────────────────────

function Btn({
  variant = "ghost",
  className,
  children,
}: {
  variant?: "ghost" | "outlined";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-[7px] border px-2.5 text-[12px] font-medium whitespace-nowrap [&_svg]:size-3.5 [&_svg]:shrink-0",
        variant === "outlined"
          ? "border-neutral-200 text-neutral-800 dark:border-neutral-700 dark:text-neutral-200"
          : "border-transparent text-neutral-500 dark:text-neutral-400",
        className,
      )}
    >
      {children}
    </span>
  );
}

const Divider = () => <span className="mx-0.5 h-5 w-px bg-neutral-200 dark:bg-neutral-700" />;

function TopNavbar({ save }: { save: SaveState }) {
  const label = save === "saving" ? "Saving…" : save === "saved" ? "Saved" : "Saved on this device";
  return (
    <header className="absolute inset-x-0 top-0 flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center gap-3">
        <DbLunaFuturistic weight="bold" className="h-[15px] w-[110px] shrink-0 text-neutral-900 dark:text-neutral-100" />
        <Divider />
        <Btn variant="outlined">
          Commerce Platform
          <span className="size-2.5 rounded-full bg-[tomato]" />
        </Btn>
        <Btn>
          <FileText />
          DBML Docs
        </Btn>
        <span
          className={cn(
            "flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] font-medium transition-colors duration-300",
            save === "saving"
              ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300"
              : "border-neutral-200 bg-white text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300",
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              save === "saving" ? "animate-pulse bg-amber-500" : "bg-emerald-500",
            )}
          />
          <HardDrive className="size-3.5" />
          {label}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <Btn>
          <Share2 />
          Share
        </Btn>
        <Btn>
          <UserPlus />
          Invite
        </Btn>
        <Btn>
          <History />
          History
        </Btn>
        <Divider />
        <Btn variant="outlined">
          <Download />
          Export
          <ChevronDown className="!size-3 text-neutral-400" />
        </Btn>
        <Btn variant="outlined">
          <Upload />
          Import
          <ChevronDown className="!size-3 text-neutral-400" />
        </Btn>
        <Divider />
        <Btn className="px-1.5">
          <CircleHelp className="!size-4" />
        </Btn>
        <div className="flex items-center pl-1">
          <span className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 text-[10px] font-semibold text-white ring-2 ring-white dark:ring-neutral-900">
            MR
          </span>
          <span className="-ml-1.5 flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-rose-500 text-[10px] font-semibold text-white ring-2 ring-white dark:ring-neutral-900">
            AK
          </span>
        </div>
      </div>
    </header>
  );
}

function TabBar() {
  return (
    <div className="absolute inset-x-0 top-14 flex h-12 items-center gap-2 border-b border-neutral-200 bg-neutral-50/80 px-3 dark:border-neutral-800 dark:bg-neutral-900">
      <Btn variant="outlined">
        <Eye />
        View
        <ChevronDown className="!size-3 text-neutral-400" />
      </Btn>
      <Btn variant="outlined">
        <Palette />
        Style
        <span className="font-normal text-neutral-400">· Recommended</span>
        <ChevronDown className="!size-3 text-neutral-400" />
      </Btn>
      <Btn variant="outlined">
        <PanelsTopLeft />
        Tabs
        <span className="rounded bg-indigo-500/12 px-1 text-[10px] leading-4 text-indigo-600 dark:text-indigo-300">10</span>
        <ChevronDown className="!size-3 text-neutral-400" />
      </Btn>
    </div>
  );
}

function FloatingToolbar({ hidden, menuOpen }: { hidden: ReadonlySet<string>; menuOpen: boolean }) {
  const item = "flex h-7 items-center gap-1.5 rounded-md px-2 [&_svg]:size-3.5";
  const shown = SCHEMA_NAMES.length - hidden.size;
  return (
    <div
      className="absolute bottom-4 flex h-10 -translate-x-1/2 items-center gap-0.5 rounded-xl border border-neutral-200 bg-white px-1.5 text-[12px] font-medium text-neutral-700 shadow-[0_4px_16px_-4px_rgb(0_0_0/0.12)] dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
      style={{ left: (DOCK_W + W) / 2 }}
    >
      <span className={item}>
        <Table2 />
        Table
      </span>
      <span className={item}>
        <StickyNote />
        Note
      </span>
      <span className={item}>
        <Square />
        Area
      </span>
      <Divider />
      {/* The Schemas menu: switch schemas on and off without opening the dock. */}
      <span
        data-hero="schemas-chip"
        className={cn(item, "relative", (menuOpen || hidden.size > 0) && "text-teal-600 dark:text-teal-400")}
      >
        <Layers />
        Schemas
        <span className={cn("tabular-nums", hidden.size > 0 ? "font-semibold" : "text-neutral-400")}>
          {shown}/{SCHEMA_NAMES.length}
        </span>
        <AnimatePresence>
          {menuOpen && <SchemasMenu hidden={hidden} />}
        </AnimatePresence>
      </span>
      <Divider />
      <span className={cn(item, "text-neutral-500")}>
        <Minus />
      </span>
      <span className="w-10 text-center tabular-nums">92%</span>
      <span className={cn(item, "text-neutral-500")}>
        <Plus />
      </span>
      <span className={cn(item, "text-neutral-500")}>
        <Scan />
      </span>
      <Divider />
      <span className="flex items-center rounded-md bg-neutral-100 p-0.5 dark:bg-neutral-800">
        <span className="flex size-6 items-center justify-center rounded bg-white shadow-sm dark:bg-neutral-700">
          <Sun className="size-3.5" />
        </span>
        <span className="flex size-6 items-center justify-center text-neutral-400">
          <Moon className="size-3.5" />
        </span>
      </span>
    </div>
  );
}

function Minimap({ dragY, hidden }: { dragY: MotionValue<number>; hidden: ReadonlySet<string> }) {
  const mapW = 176;
  const mapH = 112;
  // Same framing as the canvas, plus a margin so the tables sit inside.
  const vx = DOCK_W - 20;
  const vw = W - vx + 40;
  const vh = CANVAS_H + 40;
  return (
    <div
      className="absolute right-4 bottom-4 overflow-hidden rounded-lg border border-neutral-200 bg-white/90 shadow-sm dark:border-neutral-700 dark:bg-neutral-900/90"
      style={{ width: mapW, height: mapH }}
    >
      <svg width={mapW} height={mapH} viewBox={`${vx} -20 ${vw} ${vh}`} preserveAspectRatio="xMidYMid meet">
        {TABLES.map((t) => (
          <motion.rect
            key={t.id}
            x={t.x}
            y={t.y}
            width={TABLE_W}
            height={tableH(t.cols.length)}
            rx={12}
            fill={t.color}
            initial={false}
            animate={{ fillOpacity: hidden.has(t.schema) ? 0 : 0.35 }}
            transition={{ duration: 0.35 }}
            style={t.id === "categories" ? { y: dragY } : undefined}
          />
        ))}
        <rect x={DOCK_W + 10} y={4} width={W - DOCK_W - 30} height={CANVAS_H - 12} rx={14} fill={ACCENT} fillOpacity={0.06} stroke={ACCENT} strokeWidth={8} />
      </svg>
    </div>
  );
}

// ─── Code dock ───────────────────────────────────────────────────────────────

const TOKEN_CLASS: Record<TokenKind, string> = {
  comment: "text-neutral-400 dark:text-neutral-500",
  keyword: "text-[#b42318] dark:text-[#f97066]",
  string: "text-[#b42318] dark:text-[#f97066]",
  type: "text-neutral-800 dark:text-neutral-200",
  setting: "text-[#6941c6] dark:text-[#b692f6]",
  punct: "text-neutral-600 dark:text-neutral-400",
  plain: "",
};

function CodeDock({
  tab,
  hidden,
  lines,
  focusLine,
  typing,
}: {
  tab: DockTab;
  hidden: ReadonlySet<string>;
  lines: CodeLine[];
  focusLine: number;
  typing: boolean;
}) {
  const maxScroll = Math.max(0, lines.length - VISIBLE_LINES);
  const scroll = focusLine < 0 ? 0 : Math.min(maxScroll, Math.max(0, focusLine - 9));
  const thumbH = (VISIBLE_LINES / lines.length) * CODE_AREA_H;
  const thumbTop = (scroll / lines.length) * CODE_AREA_H;
  const focus = focusLine < 0 ? null : lines[focusLine];
  const col = focus?.typed ? lineLength(focus.tokens) + 1 : 1;

  return (
    <aside
      className="absolute bottom-0 left-0 z-20 flex flex-col border-r border-neutral-200 bg-white/90 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/90"
      style={{ top: TOP, width: DOCK_W }}
    >
      {/* Tabs */}
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-neutral-200 px-2 text-[12px] dark:border-neutral-800">
        <DockTabLabel active={tab === "code"} target="tab-code">
          Code
        </DockTabLabel>
        <span className="px-2 text-neutral-500">Database</span>
        <DockTabLabel active={tab === "schemas"} target="tab-schemas">
          Schemas
        </DockTabLabel>
        <span className="flex items-center gap-1 px-2 text-neutral-500">
          Issues
          <span className="rounded bg-amber-500/15 px-1 text-[10px] leading-4 font-medium text-amber-600">2</span>
        </span>
        <ChevronRight className="ml-auto size-3.5 text-neutral-400" />
      </div>

      {tab === "schemas" ? (
        <SchemasPanel hidden={hidden} />
      ) : (
        <>
          {/* Format */}
          <div className="flex h-[38px] shrink-0 items-center justify-between px-2 text-[11.5px]">
            <span className="flex items-center rounded-md bg-neutral-100 p-0.5 dark:bg-neutral-800">
              <span className="rounded bg-white px-2 py-0.5 font-medium shadow-sm dark:bg-neutral-700">DBML</span>
              <span className="px-2 py-0.5 text-neutral-500">JSON</span>
              <span className="px-2 py-0.5 text-neutral-500">Mermaid</span>
            </span>
            <span className="flex items-center gap-3 pr-1.5 text-neutral-400">
              <Copy className="size-3.5" />
              <Download className="size-3.5" />
            </span>
          </div>

          {/* Editor */}
          <div className="relative min-h-0 flex-1 overflow-hidden border-t border-neutral-100 font-mono text-[11.5px] dark:border-neutral-800">
            <motion.div
              initial={false}
              animate={{ y: -scroll * LINE_H }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
              className="pt-1"
            >
              {lines.map((line, i) => {
                const active = i === focusLine;
                return (
                  <div
                    key={i}
                    className={cn("flex items-center transition-colors duration-300", active && "bg-indigo-500/[0.08]")}
                    style={{ height: LINE_H }}
                  >
                    <span
                      className={cn(
                        "w-10 shrink-0 pr-3 text-right tabular-nums",
                        active ? "text-neutral-700 dark:text-neutral-200" : "text-neutral-400 dark:text-neutral-600",
                      )}
                    >
                      {i + 1}
                    </span>
                    <span className="whitespace-pre">
                      {line.tokens.map((tok, j) => (
                        <span key={j} className={TOKEN_CLASS[tok.kind]}>
                          {tok.text}
                          {j === 0 && line.dot && (
                            <span className="mx-1 inline-block size-[7px] rounded-[2px] align-middle" style={{ background: line.dot }} />
                          )}
                        </span>
                      ))}
                      {line.typed && typing && (
                        <span className="ml-px inline-block h-[13px] w-px animate-pulse bg-neutral-800 align-middle dark:bg-neutral-200" />
                      )}
                    </span>
                  </div>
                );
              })}
            </motion.div>

            {/* Scrollbar */}
            <motion.span
              className="absolute right-1 w-1.5 rounded-full bg-neutral-300 dark:bg-neutral-700"
              initial={false}
              animate={{ top: thumbTop, height: thumbH }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
            />
          </div>

          {/* Status */}
          <div className="flex h-7 shrink-0 items-center gap-3 border-t border-neutral-200 px-2 text-[10.5px] text-neutral-500 dark:border-neutral-800">
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-700 dark:text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Synced with canvas
            </span>
            <span className="ml-auto">
              {TABLES.length} tables · {LINKS.length} refs
            </span>
            <span className="tabular-nums">
              Ln {focusLine < 0 ? 1 : focusLine + 1}, Col {col}
            </span>
            <span>DBML</span>
          </div>
        </>
      )}
    </aside>
  );
}

function DockTabLabel({ active, target, children }: { active: boolean; target: string; children: React.ReactNode }) {
  return (
    <span
      data-hero={target}
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-md border px-2.5",
        active
          ? "border-neutral-200 bg-white font-medium shadow-sm dark:border-neutral-700 dark:bg-neutral-800"
          : "border-transparent text-neutral-500",
      )}
    >
      {children}
      {active && <X className="size-3 text-neutral-400" />}
    </span>
  );
}

// ─── Canvas ──────────────────────────────────────────────────────────────────

function KeyGlyph({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g transform={`translate(${x},${y})`} fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round">
      <circle cx={3.6} cy={6} r={2.6} />
      <path d="M6.2 6H11.4M9.6 6V8.2M11.4 6V7.8" />
    </g>
  );
}

function TableCard({
  t,
  extraCol,
  litRows,
  offsetY,
  shown,
  hidden,
  delay,
}: {
  t: HeroTable;
  extraCol: boolean;
  litRows: number[];
  offsetY?: MotionValue<number>;
  shown: boolean;
  hidden: boolean;
  delay: number;
}) {
  const cols = extraCol ? [...t.cols, TYPED_COL] : t.cols;
  const newRow = t.cols.length;
  return (
    <motion.g
      style={offsetY ? { y: offsetY } : undefined}
      initial={false}
      animate={{ opacity: hidden ? 0 : 1 }}
      transition={{ duration: 0.35 }}
    >
      <motion.g
        initial={{ opacity: 0, y: -10 }}
        animate={shown ? { opacity: 1, y: 0 } : { opacity: 0, y: -10 }}
        transition={{ duration: 0.45, delay }}
      >
        <motion.rect
          x={t.x}
          y={t.y}
          width={TABLE_W}
          rx={10}
          initial={false}
          animate={{ height: tableH(cols.length) }}
          transition={{ duration: 0.3 }}
          className="fill-white stroke-neutral-200 dark:fill-neutral-900 dark:stroke-neutral-700"
          style={{ filter: "drop-shadow(0 1px 1.5px rgb(0 0 0 / 0.06)) drop-shadow(0 6px 16px rgb(0 0 0 / 0.07))" }}
        />
        <rect x={t.x + 12} y={t.y + HEAD / 2 - 5} width={10} height={10} rx={3} fill={t.color} />
        <text
          x={t.x + 30}
          y={t.y + HEAD / 2}
          dominantBaseline="central"
          fontSize={12}
          fontWeight={600}
          className="fill-neutral-800 dark:fill-neutral-100"
        >
          {t.schema}.{t.name}
        </text>
        <text
          x={t.x + TABLE_W - 12}
          y={t.y + HEAD / 2}
          dominantBaseline="central"
          textAnchor="end"
          fontSize={9.5}
          className="fill-neutral-400 dark:fill-neutral-500"
        >
          {cols.length} cols
        </text>
        <line x1={t.x} x2={t.x + TABLE_W} y1={t.y + HEAD} y2={t.y + HEAD} className="stroke-neutral-200 dark:stroke-neutral-700" />

        {litRows.map((r) => (
          <motion.rect
            key={r}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            x={t.x + 5}
            y={rowY(t.y, r) - ROW / 2 + 1}
            width={TABLE_W - 10}
            height={ROW - 2}
            rx={6}
            fill={ACCENT}
            fillOpacity={0.12}
          />
        ))}

        {cols.map((c, i) => {
          const cy = rowY(t.y, i);
          const isNew = extraCol && i === newRow;
          return (
            <motion.g
              key={c.name}
              initial={isNew ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: isNew ? 0.1 : 0 }}
            >
              {isNew && (
                <motion.rect
                  x={t.x + 5}
                  y={cy - ROW / 2 + 1}
                  width={TABLE_W - 10}
                  height={ROW - 2}
                  rx={6}
                  fill="#10b981"
                  initial={{ fillOpacity: 0.28 }}
                  animate={{ fillOpacity: 0 }}
                  transition={{ duration: 1.6, delay: 0.3 }}
                />
              )}
              {c.kind === "pk" && <KeyGlyph x={t.x + 12} y={cy - 6} color={t.color} />}
              <text
                x={t.x + 30}
                y={cy}
                dominantBaseline="central"
                fontSize={11}
                fontWeight={c.kind === "pk" ? 600 : 400}
                className="fill-neutral-700 dark:fill-neutral-200"
              >
                {c.name}
              </text>
              <text
                x={t.x + TABLE_W - 12}
                y={cy}
                dominantBaseline="central"
                textAnchor="end"
                fontSize={9}
                className="fill-neutral-400 dark:fill-neutral-500"
              >
                {c.type}
              </text>
            </motion.g>
          );
        })}
      </motion.g>
    </motion.g>
  );
}

function Relationship({
  def,
  lit,
  hidden,
  dragY,
  drawn,
  delay,
}: {
  def: HeroLinkDef;
  lit: boolean;
  hidden: boolean;
  dragY: MotionValue<number>;
  drawn: boolean;
  delay: number;
}) {
  const still = useMotionValue(0);
  const a = endPoint(def.from);
  const b = endPoint(def.to);
  const mvA = def.from.table === "categories" ? dragY : still;
  const mvB = def.to.table === "categories" ? dragY : still;
  const d = useTransform([mvA, mvB], ([ya, yb]: number[]) => route(a.x, a.y + ya, b.x, b.y + yb, def.mx));
  const dirA = def.from.side === "R" ? 1 : -1;
  const dirB = def.to.side === "R" ? 1 : -1;
  const quiet = "stroke-neutral-400/80 dark:stroke-neutral-600";
  const ends = lit ? { stroke: ACCENT } : { className: quiet };

  return (
    <motion.g initial={false} animate={{ opacity: hidden ? 0 : 1 }} transition={{ duration: 0.35 }}>
      <motion.path
        d={d}
        fill="none"
        strokeWidth={1.3}
        className={quiet}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: drawn ? 1 : 0 }}
        transition={{ duration: 0.6, delay, ease: "easeOut" }}
      />
      <motion.path
        d={d}
        fill="none"
        stroke={ACCENT}
        strokeWidth={1.8}
        className="hero-flow"
        initial={false}
        animate={{ opacity: lit ? 1 : 0 }}
        transition={{ duration: 0.3 }}
      />
      <motion.g
        initial={{ opacity: 0 }}
        animate={{ opacity: drawn ? 1 : 0 }}
        transition={{ duration: 0.3, delay: delay + 0.5 }}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <motion.line style={{ y: mvA }} x1={a.x + dirA * 8} x2={a.x + dirA * 8} y1={a.y - 5} y2={a.y + 5} {...ends} />
        <motion.path style={{ y: mvB }} d={`M${b.x} ${b.y - 5}L${b.x + dirB * 10} ${b.y}L${b.x} ${b.y + 5}`} {...ends} />
      </motion.g>
    </motion.g>
  );
}


// ─── Schemas ─────────────────────────────────────────────────────────────────

/** A hidden table's hint: a short dashed run out of the visible column, and its name. */
function CrossSchemaStub({ stub }: { stub: ReturnType<typeof heroStubs>[number] }) {
  const t = TABLES.find((x) => x.id === stub.table)!;
  const dir = stub.side === "R" ? 1 : -1;
  const x = stub.side === "R" ? t.x + TABLE_W : t.x;
  const y = rowY(t.y, stub.row);
  const ex = x + dir * 34;
  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, delay: 0.15 }}
    >
      <path
        d={`M${x} ${y}H${ex}`}
        fill="none"
        strokeWidth={1.5}
        strokeDasharray="4 3"
        className="stroke-neutral-400 dark:stroke-neutral-500"
      />
      <circle
        cx={ex}
        cy={y}
        r={3}
        strokeWidth={1.5}
        className="fill-neutral-50 stroke-neutral-400 dark:fill-neutral-950 dark:stroke-neutral-500"
      />
      <text
        x={ex + dir * 7}
        y={y}
        dominantBaseline="central"
        textAnchor={dir === 1 ? "start" : "end"}
        fontSize={11.5}
        fontStyle="italic"
        paintOrder="stroke"
        strokeWidth={4}
        strokeLinejoin="round"
        className="fill-neutral-500 stroke-neutral-50 dark:fill-neutral-400 dark:stroke-neutral-950"
      >
        {stub.label}
      </text>
    </motion.g>
  );
}

function SchemaGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round">
      <path d="M1.2 3.2a1 1 0 0 1 1-1h2.4l1.2 1.3h4a1 1 0 0 1 1 1v4.8a1 1 0 0 1-1 1H2.2a1 1 0 0 1-1-1Z" />
    </svg>
  );
}

function Switch({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        "relative h-[18px] w-[30px] shrink-0 rounded-full transition-colors duration-200",
        on ? "bg-indigo-500" : "bg-neutral-300 dark:bg-neutral-700",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 size-3.5 rounded-full bg-white shadow-sm transition-transform duration-200",
          on && "translate-x-3",
        )}
      />
    </span>
  );
}

/** The toolbar's Schemas menu, opening upwards from the chip. */
function SchemasMenu({ hidden }: { hidden: ReadonlySet<string> }) {
  return (
    <motion.span
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.15 }}
      className="absolute bottom-full left-1/2 mb-3 flex w-[236px] -translate-x-1/2 flex-col rounded-xl border border-neutral-200 bg-white p-1.5 text-neutral-800 shadow-[0_12px_32px_rgb(0_0_0/0.12)] dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
    >
      <span className="flex items-center gap-2.5 px-2 pt-1.5 pb-1 text-[10px] font-semibold tracking-[0.06em] text-neutral-400 uppercase">
        <span className="flex-1">Show on the canvas</span>
        <span className="font-medium tracking-normal text-indigo-500 normal-case">Show all</span>
      </span>
      {SCHEMA_NAMES.map((schema) => {
        const on = !hidden.has(schema);
        return (
          <span key={schema} data-hero={`menu-${schema}`} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-md transition-colors duration-200",
                on ? "bg-indigo-500/12 text-indigo-500" : "bg-neutral-100 text-neutral-400 dark:bg-neutral-800",
              )}
            >
              <SchemaGlyph />
            </span>
            <span className="flex min-w-0 flex-1 flex-col text-[12.5px] leading-tight">
              {schema}
              <small className="text-[11px] text-neutral-400">{schemaTables(schema).length} tables</small>
            </span>
            <Switch on={on} />
          </span>
        );
      })}
    </motion.span>
  );
}

/** The dock's Schemas tab: group-by switch, the schema graph, and a card per schema. */
function SchemasPanel({ hidden }: { hidden: ReadonlySet<string> }) {
  const shown = SCHEMA_NAMES.length - hidden.size;
  return (
    <div className="flex min-h-0 flex-1 flex-col text-[12px]">
      <div className="flex flex-col gap-2.5 border-b border-neutral-200 px-4 pt-3.5 pb-3 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-semibold">Schemas</span>
          <span className="rounded-md bg-neutral-100 px-1.5 text-[11px] text-neutral-500 dark:bg-neutral-800">
            {SCHEMA_NAMES.length}
          </span>
          <span className="ml-auto flex h-7 items-center gap-1 rounded-lg bg-indigo-500 px-2.5 text-[11.5px] font-medium text-white">
            <Plus className="size-3.5" />
            Add schema
          </span>
        </div>
        <span className="grid grid-cols-3 gap-0.5 rounded-lg bg-neutral-100 p-0.5 text-[11px] dark:bg-neutral-800">
          <span className="rounded-md bg-white py-1 text-center font-medium shadow-sm dark:bg-neutral-700">Schemas</span>
          <span className="py-1 text-center text-neutral-500">Table groups</span>
          <span className="py-1 text-center text-neutral-500">Relationships</span>
        </span>
        <span className="flex items-center gap-2.5 text-[11.5px] text-neutral-500">
          <span className="flex-1">
            {hidden.size === 0 ? "All schemas on the canvas" : `${shown} of ${SCHEMA_NAMES.length} on the canvas`}
          </span>
          <span
            data-hero="show-all"
            className={cn("font-medium", hidden.size ? "text-indigo-500" : "text-neutral-300 dark:text-neutral-600")}
          >
            Show all
          </span>
          <span className="font-medium text-indigo-500">Hide all</span>
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden p-3">
        <SchemaGraphMini hidden={hidden} />
        {SCHEMA_NAMES.map((schema) => {
          const off = hidden.has(schema);
          const tables = schemaTables(schema);
          return (
            <div
              key={schema}
              className="shrink-0 overflow-hidden rounded-[10px] border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900"
            >
              <div className="flex h-[34px] items-center gap-2 px-3">
                <ChevronDown className="size-3 -rotate-90 text-neutral-400" />
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-md bg-indigo-500/12 text-indigo-500 transition-opacity duration-300",
                    off && "opacity-50",
                  )}
                >
                  <SchemaGlyph />
                </span>
                <span className={cn("font-semibold transition-opacity duration-300", off && "opacity-50")}>{schema}</span>
                <span className="ml-auto text-[10.5px] font-medium text-neutral-400">{tables.length} tables</span>
                <span className="flex size-6 items-center justify-center text-neutral-400">
                  <Focus className="size-3.5" />
                </span>
                <span
                  data-hero={`eye-${schema}`}
                  className={cn(
                    "-mr-1.5 flex size-6 items-center justify-center rounded-md",
                    off ? "text-neutral-600 dark:text-neutral-300" : "text-neutral-400",
                  )}
                >
                  {off ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </span>
              </div>
              <div className={cn("flex flex-wrap gap-1.5 px-3 pb-2.5 transition-opacity duration-300", off && "opacity-50")}>
                {tables.map((t) => (
                  <span
                    key={t.id}
                    className="flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] dark:bg-neutral-800"
                  >
                    <i className="size-[7px] rounded-[2px]" style={{ background: t.color }} />
                    {t.name}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const GRAPH = schemaGraph();

/** Which schema talks to which: a ring of schemas, line width by relationship count. */
function SchemaGraphMini({ hidden }: { hidden: ReadonlySet<string> }) {
  const gw = 334;
  const gh = 150;
  const cx = gw / 2;
  const cy = gh / 2;
  const max = Math.max(...GRAPH.nodes.map((n) => n.tables));
  const pos = new Map(
    GRAPH.nodes.map((n, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / GRAPH.nodes.length;
      const r = 9 + 9 * Math.sqrt(n.tables / max);
      return [n.schema, { x: cx + 82 * Math.cos(a), y: cy + 46 * Math.sin(a), a, r }];
    }),
  );
  return (
    <div className="shrink-0 rounded-[10px] border border-neutral-200 bg-neutral-50 px-2 pt-1 pb-2 dark:border-neutral-700 dark:bg-neutral-800/50">
      <svg width="100%" viewBox={`0 0 ${gw} ${gh}`} className="block">
        {GRAPH.edges.map((e) => {
          const a = pos.get(e.a)!;
          const b = pos.get(e.b)!;
          const qx = (a.x + b.x) / 2 + (cx - (a.x + b.x) / 2) * 0.45;
          const qy = (a.y + b.y) / 2 + (cy - (a.y + b.y) / 2) * 0.45;
          const off = hidden.has(e.a) || hidden.has(e.b);
          return (
            <path
              key={`${e.a}|${e.b}`}
              d={`M${a.x} ${a.y}Q${qx} ${qy} ${b.x} ${b.y}`}
              fill="none"
              strokeWidth={e.count > 1 ? 1.75 : 1.2}
              strokeLinecap="round"
              className={cn("stroke-neutral-400 transition-opacity duration-300 dark:stroke-neutral-500", off && "opacity-30")}
            />
          );
        })}
        {GRAPH.nodes.map((n) => {
          const p = pos.get(n.schema)!;
          const off = hidden.has(n.schema);
          const cos = Math.cos(p.a);
          const sin = Math.sin(p.a);
          const anchor = cos > 0.35 ? "start" : cos < -0.35 ? "end" : "middle";
          return (
            <g key={n.schema} className={cn("transition-opacity duration-300", off && "opacity-40")}>
              <circle
                cx={p.x}
                cy={p.y}
                r={p.r}
                strokeWidth={1.5}
                strokeDasharray={off ? "3 2" : undefined}
                className={
                  off
                    ? "fill-white stroke-neutral-400 dark:fill-neutral-900"
                    : "fill-indigo-100 stroke-indigo-500 dark:fill-indigo-950"
                }
              />
              <text
                x={p.x}
                y={p.y}
                dominantBaseline="central"
                textAnchor="middle"
                fontSize={10}
                fontWeight={600}
                className="fill-neutral-800 dark:fill-neutral-100"
              >
                {n.tables}
              </text>
              <text
                x={p.x + (p.r + 6) * cos}
                y={p.y + (p.r + 6) * sin}
                dy={anchor !== "middle" ? "0.35em" : sin < 0 ? "-0.2em" : "0.9em"}
                textAnchor={anchor}
                fontSize={10.5}
                fontWeight={500}
                className="fill-neutral-700 dark:fill-neutral-200"
              >
                {n.schema}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="px-1 text-[10.5px] text-neutral-500">Click a schema to show only it, or a line to show a pair.</p>
    </div>
  );
}
