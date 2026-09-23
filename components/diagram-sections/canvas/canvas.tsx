"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { getHiddenSchemas, useEditorStore, useHiddenSchemas } from "@/store/useEditorStore";
import { useCanvasStore, type Area } from "@/store/useCanvasStore";
import { useDockStore, type TabId, type DockSide } from "@/store/useDockStore";
import {
  WorldBackground,
  backgroundPositionFor,
} from "@/components/diagram-general/canvas-world-background";
import { Minimap } from "./minimap";
import { CanvasShortcutsHelp } from "./canvas-shortcuts-help";
import { CanvasFloatingToolbar } from "@/components/diagram-general/canvas-floating-toolbar";
import { TableNode } from "./table-node";
import { NoteNode } from "./note-node";
import { AreaNode } from "./area-node";
import { useStoreHydration } from "@/hooks/use-store-hydration";
import { useCanvasStyle } from "@/store/useCanvasStyleStore";
import { getCanvasFontFamily, measureTextWidth } from "@/lib/svg-text";
import {
  TABLE_GEOMETRY,
  pickSides,
  routeRelationship,
  rowCenterY,
  tableHeight,
  tableLodForZoom,
  type CanvasStyle,
  type TableLod,
  type PortPoint,
  type RoutedPath,
  type Side,
} from "./canvas-style";
import { RelationshipEnd, cardinalityShort, relationshipRoles } from "./relationship-ends";
import {
  applyHighlight,
  computeHighlight,
  createHoverStore,
  affordableDim,
  computeFocus,
  MAX_ANIMATED_LIT,
  type HoverStore,
} from "./hover-highlight";
import { cn } from "@/lib/utils";
import {
  buildCrossSchemaStubs,
  buildSchemaIndex,
  crossSchemaStubLabel,
  filterVisibleTables,
  type CrossSchemaStub,
} from "@/lib/schema-visibility";
import { revealTablesOnCanvas } from "@/components/diagram-general/use-diagram-issues";
import { dlog, mark, logMount } from "@/lib/debug-selection";
import { countRender } from "@/lib/debug-profiler";
import type { Relationship, Table } from "@/store/useCanvasStore";

// Resting colour for "quiet" lines — mixed against the canvas so it stays opaque.
const QUIET_LINE = "color-mix(in oklab, var(--muted-foreground) 50%, var(--canvas-bg))";

/** The column on the "many" side of a relationship (the foreign key). */
function foreignKeyEnd(rel: Relationship): { tableId: string; columnId: string } {
  return rel.cardinality === "One to many"
    ? { tableId: rel.targetTableId, columnId: rel.targetColumnId }
    : { tableId: rel.sourceTableId, columnId: rel.sourceColumnId };
}

/** A relationship with both endpoints resolved and its path already routed. */
interface RoutedRelationship {
  rel: Relationship;
  source: Table;
  target: Table;
  start: PortPoint;
  end: PortPoint;
  path: RoutedPath;
}

const pushTo = (map: Map<string, string[]>, key: string, value: string) => {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
};
import styles from "./canvas.module.scss";



function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** Travelling dots for the "expressive" style, on the lit relationships only. */
function LitPulses({
  store,
  routed,
  endColor,
  selectedTableIds,
  selectedRelationshipId,
}: {
  store: HoverStore;
  routed: RoutedRelationship[];
  endColor: (source: Table, table: Table) => string;
  selectedTableIds: string[];
  selectedRelationshipId: string | null;
}) {
  const hover = useSyncExternalStore(store.subscribe, store.get, store.get);
  const { litRels } = computeHighlight(
    hover,
    routed.map((r) => r.rel),
    selectedTableIds,
    selectedRelationshipId,
    false
  );
  // `<animateMotion>` repaints like the dashes do, so it lives under the same
  // ceiling — a hub table would otherwise put a hundred SMIL timers on screen.
  if (litRels.size === 0 || litRels.size > MAX_ANIMATED_LIT) return null;

  return (
    <>
      {routed
        .filter(({ rel }) => litRels.has(rel.id))
        .map(({ rel, source, target, path }) => {
          const roles = relationshipRoles(rel.cardinality);
          const oneToMany = roles.source === "one" && roles.target === "many";
          return (
            <circle key={rel.id} r={3.2} fill={endColor(source, target)} className={styles.relPulse}>
              <animateMotion
                dur="1.8s"
                repeatCount="indefinite"
                path={path.d}
                keyPoints={oneToMany ? "1;0" : "0;1"}
                keyTimes="0;1"
                calcMode="linear"
              />
            </circle>
          );
        })}
    </>
  );
}

/**
 * The little "1:N users.id → orders.user_id" chip that follows the line you are
 * pointing at. It subscribes to the hover store itself rather than taking the
 * hovered id as a prop, so showing and hiding it re-renders a single label
 * instead of the entire stage.
 */
function HoveredRelationshipLabel({ store, routed }: { store: HoverStore; routed: RoutedRelationship[] }) {
  const hover = useSyncExternalStore(store.subscribe, store.get, store.get);
  const hovered = hover.relId ? routed.find((r) => r.rel.id === hover.relId) : undefined;
  if (!hovered) return null;

  const { rel, source, target, path } = hovered;
  const { mid } = path;
  const family = getCanvasFontFamily();
  const card = cardinalityShort(rel.cardinality);
  const srcCol = source.columns.find((c) => c.id === rel.sourceColumnId)?.name ?? "";
  const tgtCol = target.columns.find((c) => c.id === rel.targetColumnId)?.name ?? "";
  const main = rel.name || `${source.name}.${srcCol} → ${target.name}.${tgtCol}`;
  const cardW = measureTextWidth(card, "600 11px monospace");
  const mainW = measureTextWidth(main, `500 11px ${family}`);
  const w = cardW + 8 + mainW;

  return (
    <g transform={`translate(${mid.x}, ${mid.y})`} pointerEvents="none" className={styles.relLabel}>
      <rect x={-w / 2 - 10} y={-12} width={w + 20} height={24} rx={8} fill="var(--popover)" stroke="var(--border)" />
      <text x={-w / 2} y={0} dominantBaseline="central" fontSize={11} style={{ userSelect: "none" }}>
        <tspan fontFamily="var(--font-mono)" fontWeight={600} fill="var(--primary)">{card}</tspan>
        <tspan dx={8} fontWeight={500} fill="var(--popover-foreground)">{main}</tspan>
      </text>
    </g>
  );
}

interface CanvasStageProps {
  diagramId: string;
  // When true, drag/resize/delete/connection-creation are disabled. Pan,
  // zoom, and selection stay fully functional. Used by the anonymous
  // share-link viewer (/d/view) — see release-1-0/share-via-url-plan.md.
  readOnly?: boolean;
}

// How far (in screen px) a pan may drift from the camera in the store before
// we push it back in. Keeps viewport culling and the minimap from going stale
// mid-gesture; stays well inside CULL_MARGIN at every allowed zoom level.
/** Shared so an already-idle drag reset keeps its object identity. */
const DRAG_IDLE = { dx: 0, dy: 0, active: false };

const PAN_COMMIT_PX = 120;
// Trailing commit for pan sources with no natural "end" event (wheel).
const PAN_IDLE_MS = 100;
// How far outside the viewport, in screen pixels, content is still drawn. Must
// stay comfortably above PAN_COMMIT_PX so a gesture can't outrun the cull set.
const CULL_MARGIN_PX = 300;

/** Length of a cross-schema stub, in world units, out from the column's edge. */
const CROSS_STUB_LEN = 34;
const NO_STUBS: CrossSchemaStub[] = [];

/**
 * Every relationship line on the canvas.
 *
 * Split out and memoised because selecting a *table* used to rebuild all of
 * them. Measured on a 428-table / 672-relationship diagram with 39 cards on
 * screen: 195 line groups survived culling and were re-created on every click,
 * ~8 SVG children each — 180-200ms of React work per selection, for lines that
 * do not change when a table is selected. Which lines light up is written to
 * the DOM as `data-lit` by applyHighlight (see hover-highlight.ts), not here.
 *
 * Neither `selectedTableIds` nor focus mode is a prop: the only selection this
 * layer draws is `selectedRelationshipId` (a thicker stroke). Focus dimming is
 * a `data-focus-out` attribute written by applyHighlight.
 */
interface RelationshipLayerProps {
  routedRelationships: RoutedRelationship[];
  canvasStyle: CanvasStyle;
  lod: TableLod;
  isExporting: boolean;
  selectedRelationshipId: string | null;
  newRelationshipIds: string[];
  vLeft: number;
  vRight: number;
  vTop: number;
  vBottom: number;
  spaceDown: boolean;
  readOnly: boolean;
  hoverStore: HoverStore;
  endColor: (source: Table, table: Table) => string;
  setSelectedRelationshipId: (id: string | null) => void;
  openTab: (tabId: TabId, side?: DockSide) => void;
}

const RelationshipLayer = React.memo(function RelationshipLayer({
  routedRelationships,
  canvasStyle,
  lod,
  isExporting,
  selectedRelationshipId,
  newRelationshipIds,
  vLeft,
  vRight,
  vTop,
  vBottom,
  spaceDown,
  readOnly,
  hoverStore,
  endColor,
  setSelectedRelationshipId,
  openTab,
}: RelationshipLayerProps) {
  countRender("RelationshipLayer body"); // TEMP diagnostics
  return (
    <>
            {routedRelationships.map(({ rel, source, target, start, end, path }) => {
              const minX = Math.min(start.x, end.x) - 40;
              const maxX = Math.max(start.x, end.x) + 40;
              const minY = Math.min(start.y, end.y);
              const maxY = Math.max(start.y, end.y);

              if (maxX < vLeft || minX > vRight || maxY < vTop || minY > vBottom) {
                countRender("relationship CULLED"); // TEMP diagnostics
                return null;
              }
              countRender("relationship DRAWN"); // TEMP diagnostics

              const { d } = path;
              const isSelected = selectedRelationshipId === rel.id;
              const isNew = newRelationshipIds.includes(rel.id);
              const roles = relationshipRoles(rel.cardinality);
              const oneToMany = roles.source === "one" && roles.target === "many";
              const startColor = endColor(source, source);
              const endColorValue = endColor(source, target);

              // Ring on the "one" end when the foreign key is nullable.
              const fk = foreignKeyEnd(rel);
              const fkTable = fk.tableId === source.id ? source : target;
              const optional = !fkTable.columns.find((c) => c.id === fk.columnId)?.isNotNull;

              const gradientId = `rel-grad-${rel.id}`;
              const stroke = canvasStyle.color === "gradient" ? `url(#${gradientId})` : startColor;

              return (
                <g
                  key={rel.id}
                  data-rel-id={rel.id}
                  onPointerEnter={() => hoverStore.setRelationship(rel.id)}
                  onPointerLeave={() => hoverStore.setRelationship(null)}
                  // Select on pointerdown, not click: letting pointerdown bubble
                  // starts a marquee on the world layer, which captures the
                  // pointer and retargets the click away from this line.
                  // Pan gestures (middle button, Space+drag) still bubble.
                  onPointerDown={(e) => {
                    if (e.button !== 0 || spaceDown) return;
                    e.stopPropagation();
                    setSelectedRelationshipId(rel.id);
                    if (!readOnly) openTab("relationships", "left");
                  }}
                  className={cn("cursor-pointer", styles.rel, isNew && styles.relNew)}
                  data-motion={canvasStyle.motion}
                  // Motion runs from the foreign key toward the key it references.
                  data-reverse={oneToMany || undefined}
                >
                  {canvasStyle.color === "gradient" && (
                    <defs>
                      <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={start.x} y1={start.y} x2={end.x} y2={end.y}>
                        <stop offset="0" stopColor={source.color} />
                        <stop offset="1" stopColor={target.color} />
                      </linearGradient>
                    </defs>
                  )}
                  {/* Invisible hit area for easier hovering */}
                  <path
                    d={d}
                    fill="none"
                    strokeWidth={14}
                    className={styles["relationship-hit-area"]}
                    style={{ pointerEvents: "auto" }}
                  />
                  {/* Hidden by CSS until the line is lit, so lighting one up costs
                      no render. Skipped where it could never be seen: an export has
                      no hover, and at `block` zoom it's a few pixels of glow. */}
                  {!isExporting && lod !== "block" && (
                    <path d={d} fill="none" stroke={stroke} strokeWidth={9} strokeLinecap="round" className={styles.relHalo} />
                  )}
                  <path
                    d={d}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={isSelected ? 2.4 : 1.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    pathLength={isNew ? 1 : undefined}
                    className={styles.relLine}
                  />
                  {/* Crow's feet and 1/N badges are a couple of pixels wide at
                      `block` zoom — six SVG nodes per line that nobody can read. */}
                  {lod !== "block" && (
                    <>
                      <RelationshipEnd
                        ends={canvasStyle.ends}
                        point={start}
                        role={roles.source}
                        optional={roles.source === "one" && roles.target === "many" && optional}
                        color={startColor}
                      />
                      <RelationshipEnd
                        ends={canvasStyle.ends}
                        point={end}
                        role={roles.target}
                        optional={roles.target === "one" && roles.source === "many" && optional}
                        color={endColorValue}
                      />
                    </>
                  )}
                </g>
              );
            })}
    </>
  );
});
export function CanvasStage({ diagramId, readOnly = false }: CanvasStageProps) {
  // TEMP diagnostics — see lib/debug-selection.ts.
  useEffect(() => logMount("CanvasStage"), []);
  countRender("CanvasStage body");

  const rootRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<SVGGElement>(null);
  const backgroundRef = useRef<HTMLDivElement>(null);

  const background = useCanvasStore((s) => s.background);
  const tables = useCanvasStore((s) => s.tables);
  const selectedTableIds = useCanvasStore((s) => s.selectedTableIds);
  const setSelectedTableIds = useCanvasStore((s) => s.setSelectedTableIds);
  const notes = useCanvasStore((s) => s.notes);
  const selectedNoteIds = useCanvasStore((s) => s.selectedNoteIds);
  const setSelectedNoteIds = useCanvasStore((s) => s.setSelectedNoteIds);
  const selectedRelationshipId = useCanvasStore((s) => s.selectedRelationshipId);
  const setSelectedRelationshipId = useCanvasStore((s) => s.setSelectedRelationshipId);
  const moveTables = useCanvasStore((s) => s.moveTables);
  const deleteTables = useCanvasStore((s) => s.deleteTables);
  const moveNotes = useCanvasStore((s) => s.moveNotes);
  const deleteNote = useCanvasStore((s) => s.deleteNote);
  const areas = useCanvasStore((s) => s.areas);
  const selectedAreaIds = useCanvasStore((s) => s.selectedAreaIds);
  const setSelectedAreaIds = useCanvasStore((s) => s.setSelectedAreaIds);
  const moveAreas = useCanvasStore((s) => s.moveAreas);
  const isFocusModeEnabled = useCanvasStore((s) => s.isFocusModeEnabled);
  const hiddenSchemas = useHiddenSchemas();
  const anyHidden = hiddenSchemas.length > 0;

  // Which schema each table belongs to — only built while something is hidden,
  // and then memoised on a NAME signature, never on `tables`: `moveTables`
  // replaces `tables` on every pointermove, and `splitSchemaName` runs a regex.
  // x/y are deliberately excluded, so a drag never rebuilds the index. See
  // release-1-0/schemas-tab-and-visibility-plan.md §7.
  const nameSignature = useMemo(
    () => (anyHidden ? tables.map((t) => `${t.id} ${t.name}`).join("|") : ""),
    [tables, anyHidden]
  );
  const schemaIndex = useMemo(
    () => (anyHidden ? buildSchemaIndex(tables) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nameSignature, anyHidden]
  );

  // The tables this canvas draws. `tables` itself, by identity, when nothing is
  // hidden — so every memo downstream behaves exactly as it did before schemas
  // could be hidden. A fresh array here would rebuild every line per drag frame.
  const visibleTables = useMemo(
    () => filterVisibleTables(tables, hiddenSchemas, schemaIndex),
    [tables, hiddenSchemas, schemaIndex]
  );

  const openTab = useDockStore((s) => s.openTab);

  const camera = useEditorStore((s) => s.camera);
  const panBy = useEditorStore((s) => s.panBy);
  const zoomAt = useEditorStore((s) => s.zoomAt);
  const isExporting = useEditorStore((s) => s.isExporting);

  const setViewportStore = useEditorStore((s) => s.setViewport);
  const setCameraXY = useEditorStore((s) => s.setCameraXY);

  const [viewport, setViewport] = useState({ w: 1, h: 1 });
  // Hover lives outside React entirely — see hover-highlight.ts. Putting it in
  // state re-rendered every table and every line on each pointer move.
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverStore] = useState<HoverStore>(createHoverStore);
  // Relationships created by drag-to-connect in this session play a draw-in once.
  const [newRelationshipIds, setNewRelationshipIds] = useState<string[]>([]);

  const canvasStyle = useCanvasStyle();
  const geo = TABLE_GEOMETRY[canvasStyle.table];

  // Stable across renders so the memoised TableNodes never see a new function.
  const handleTableHover = useCallback(
    (tableId: string, colId: string | null | undefined) => hoverStore.setTable(tableId, colId),
    [hoverStore]
  );

  // Selection Rect State (in world coordinates)
  const [selectionRect, setSelectionRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null);

  const [dragOffset, setDragOffset] = useState(DRAG_IDLE);

  /**
   * End a drag without allocating when there was nothing to end.
   *
   * Every pointer-up ran `setDragOffset({ dx: 0, dy: 0, active: false })`, and a
   * plain click is a pointer-up too. The fresh object re-ran the
   * `getLiveTablePosition` callback, which re-ran the `routedRelationships`
   * memo, which defeated RelationshipLayer's memo — so clicking a table rebuilt
   * every line on the canvas for a drag that never happened. Returning the
   * previous state when already idle makes React bail out of the update.
   */
  const endDragOffset = useCallback(
    () => setDragOffset((prev) => (prev.active ? DRAG_IDLE : prev)),
    []
  );

  // Inform stores which diagram we are working on
  const setDiagramId = useCanvasStore((s) => s.setDiagramId);
  const setEditorDiagramId = useEditorStore((s) => s.setEditorDiagramId);
  const hasHydrated = useStoreHydration();

  useEffect(() => {
    // Wait for IndexedDB rehydration — switching diagrams against pre-hydration
    // empty state would read/write the wrong (stale default) data.
    if (!hasHydrated) return;
    setDiagramId(diagramId);
    setEditorDiagramId(diagramId);
  }, [diagramId, hasHydrated, setDiagramId, setEditorDiagramId]);

  // Mirror the readOnly prop into the store itself so every mutating action
  // (not just this component's pointer handlers) is blocked centrally —
  // covers the toolbar, dock panels, and code editor too. Reset on unmount so
  // leaving a read-only view never leaves a later normal session locked.
  const setStoreReadOnly = useCanvasStore((s) => s.setReadOnly);
  useEffect(() => {
    setStoreReadOnly(readOnly);
    return () => setStoreReadOnly(false);
  }, [readOnly, setStoreReadOnly]);



  // Measure viewport (so minimap + zoomAt math is correct) + inform store (for clamping)
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const update = () => {
      const r = el.getBoundingClientRect();
      setViewport({ w: r.width, h: r.height });
      setViewportStore(r.width, r.height);
    };

    const ro = new ResizeObserver(update);
    ro.observe(el);

    update();

    return () => ro.disconnect();
  }, [setViewportStore]);

  // Space-to-pan
  const [spaceDown, setSpaceDown] = useState(false);
  // Whether the pointer is over the canvas — Space only means "pan" while it is,
  // so keyboard users can still activate focused buttons with Space elsewhere.
  const pointerOverCanvas = useRef(false);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;

      const t = e.target as HTMLElement | null;
      const isTyping =
        t?.tagName === "INPUT" ||
        t?.tagName === "TEXTAREA" ||
        t?.isContentEditable;

      if (isTyping) return;

      // A toolbar/navbar trigger (e.g. View, Tabs) keeps focus after its menu
      // closes, and Radix toggles the menu on every Space keydown — including
      // auto-repeats while Space is held. When panning over the canvas, drop
      // that focus and stop the event before it reaches React's handlers.
      if (pointerOverCanvas.current && t && !rootRef.current?.contains(t)) {
        e.stopPropagation();
        if (t instanceof HTMLElement && t !== document.body) t.blur();
      }

      e.preventDefault();
      setSpaceDown(true);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setSpaceDown(false);
      }
      if (!readOnly && (e.code === "Delete" || e.code === "Backspace") && selectedTableIds.length > 0) {
        // Prevent deleting if typing in input !!
        // We already check "isTyping" in onKeyDown but not here.
        // We should check here too or move logic.
        const t = e.target as HTMLElement | null;
        const isTyping = t?.tagName === "INPUT" || t?.tagName === "TEXTAREA" || t?.isContentEditable;
        if (!isTyping) {
          // Hiding is a view, not a deletion: a selection can outlive a hide,
          // but Delete only ever removes tables you can see.
          const hidden = getHiddenSchemas();
          const ids = hidden.length === 0
            ? selectedTableIds
            : (() => {
                const visible = new Set(filterVisibleTables(useCanvasStore.getState().tables, hidden).map((t) => t.id));
                return selectedTableIds.filter((id) => visible.has(id));
              })();
          if (ids.length > 0) deleteTables(ids);
          if (selectedNoteIds.length > 0) selectedNoteIds.forEach(id => deleteNote(id));
        }
      }
    };

    // Capture phase: runs before React's root listener, so stopPropagation above
    // actually keeps the Space press away from the focused trigger.
    window.addEventListener("keydown", onKeyDown, { capture: true, passive: false });
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [selectedTableIds, deleteTables, readOnly]);

  // Pointer panning
  const drag = useRef<{
    active: boolean;
    lastX: number;
    lastY: number;
    pointerId: number | null;
  }>({ active: false, lastX: 0, lastY: 0, pointerId: null });

  // ─── Pan pipeline ──────────────────────────────────────────────────────────
  // Panning used to call panBy() straight from pointermove/wheel. Every one of
  // those store writes re-rendered the whole stage (all relationship paths, all
  // node wrappers, the minimap) — ~4.5ms each, and a mouse reporting at 500Hz+
  // fires several per frame, so the work piled up and the pan visibly stuttered.
  //
  // Instead the gesture is accumulated in a ref, flushed to the DOM once per
  // animation frame (a transform + a background-position, no React), and only
  // pushed into the store every PAN_COMMIT_PX or when the gesture goes idle.
  // React still owns the camera — it just hears about it a few times per
  // gesture instead of a few times per frame.
  const pan = useRef({ dx: 0, dy: 0, raf: 0, idleTimer: 0 });

  const commitPan = useCallback(() => {
    if (pan.current.idleTimer) {
      clearTimeout(pan.current.idleTimer);
      pan.current.idleTimer = 0;
    }
    const { dx, dy } = pan.current;
    if (dx === 0 && dy === 0) return;
    // Zero *before* panBy: the DOM already shows camera+dx, so once the store
    // catches up React's render writes the identical transform — no jump.
    pan.current.dx = 0;
    pan.current.dy = 0;
    panBy(dx, dy);
  }, [panBy]);

  // Writes the camera as it should look *right now* straight to the DOM.
  const syncWorldToDom = useCallback(() => {
    const { camera: committed } = useEditorStore.getState();
    const x = committed.x + pan.current.dx;
    const y = committed.y + pan.current.dy;

    if (worldRef.current) {
      worldRef.current.style.transform = `translate(${x}px, ${y}px) scale(${committed.zoom})`;
    }
    if (backgroundRef.current) {
      backgroundRef.current.style.backgroundPosition = backgroundPositionFor(background, x, y);
    }
  }, [background]);

  const flushPanToDom = useCallback(() => {
    pan.current.raf = 0;
    syncWorldToDom();

    if (Math.abs(pan.current.dx) >= PAN_COMMIT_PX || Math.abs(pan.current.dy) >= PAN_COMMIT_PX) {
      commitPan();
    }
  }, [syncWorldToDom, commitPan]);

  // React renders the *committed* camera, but the DOM is already showing
  // committed + whatever the in-flight gesture hasn't handed over yet. At a few
  // dozen tables that render lands inside a frame and the gap is sub-pixel; at a
  // few hundred it lands frames late, and writing the stale transform snaps the
  // world backwards before the next rAF drags it forward again. Re-assert the
  // live camera after every commit so a slow render can't jitter the view.
  useLayoutEffect(() => {
    if (pan.current.dx !== 0 || pan.current.dy !== 0) syncWorldToDom();
  });

  // The camera as it is actually on screen right now — the store's value plus
  // whatever the in-flight gesture hasn't committed yet. Anything converting
  // screen coordinates to world coordinates must use this, not the `camera`
  // from render, which can trail by up to PAN_COMMIT_PX mid-gesture.
  const getLiveCamera = useCallback(() => {
    const { camera: committed } = useEditorStore.getState();
    return {
      x: committed.x + pan.current.dx,
      y: committed.y + pan.current.dy,
      zoom: committed.zoom,
    };
  }, []);

  const queuePan = useCallback((dx: number, dy: number) => {
    pan.current.dx += dx;
    pan.current.dy += dy;
    if (!pan.current.raf) pan.current.raf = requestAnimationFrame(flushPanToDom);
    if (pan.current.idleTimer) clearTimeout(pan.current.idleTimer);
    pan.current.idleTimer = window.setTimeout(commitPan, PAN_IDLE_MS);
  }, [flushPanToDom, commitPan]);

  // ─── Drag/resize frame gate ────────────────────────────────────────────────
  // Node drags and resizes have the same problem panning did: they wrote to
  // React (setDragOffset) or to the store (updateNote/updateArea) once per
  // pointermove, and each write re-renders the whole stage. A mouse reporting
  // faster than the display then queues several of those per frame.
  //
  // The pointer handlers still do their (cheap) delta math eagerly, but the
  // state write is deferred to the next animation frame, latest-wins — so the
  // stage re-renders at most once per frame no matter the pointer event rate.
  const gestureFrame = useRef<{ raf: number; work: (() => void) | null }>({ raf: 0, work: null });

  const scheduleGestureFrame = useCallback((work: () => void) => {
    gestureFrame.current.work = work;
    if (gestureFrame.current.raf) return;
    gestureFrame.current.raf = requestAnimationFrame(() => {
      gestureFrame.current.raf = 0;
      const pending = gestureFrame.current.work;
      gestureFrame.current.work = null;
      pending?.();
    });
  }, []);

  // Run any deferred work now rather than dropping it — the last few pixels of
  // a gesture live in that pending frame when the pointer comes up.
  const flushGestureFrame = useCallback(() => {
    if (gestureFrame.current.raf) {
      cancelAnimationFrame(gestureFrame.current.raf);
      gestureFrame.current.raf = 0;
    }
    const pending = gestureFrame.current.work;
    gestureFrame.current.work = null;
    pending?.();
  }, []);

  // Never leave an in-flight gesture uncommitted (unmount, diagram switch).
  useEffect(() => {
    const panRef = pan.current;
    const frameRef = gestureFrame.current;
    return () => {
      if (panRef.raf) cancelAnimationFrame(panRef.raf);
      if (panRef.idleTimer) clearTimeout(panRef.idleTimer);
      if (frameRef.raf) cancelAnimationFrame(frameRef.raf);
    };
  }, []);

  // Table dragging
  const dragTable = useRef<{
    active: boolean;
    initialMouseX: number;
    initialMouseY: number;
    // Map of table ID to its initial position {x, y}
    initialPositions: Map<string, { x: number, y: number }>;
    pointerId: number | null;
  }>({ active: false, initialMouseX: 0, initialMouseY: 0, initialPositions: new Map(), pointerId: null });

  // Note dragging
  const dragNote = useRef<{
    active: boolean;
    initialMouseX: number;
    initialMouseY: number;
    initialPositions: Map<string, { x: number, y: number }>;
    pointerId: number | null;
  }>({ active: false, initialMouseX: 0, initialMouseY: 0, initialPositions: new Map(), pointerId: null });

  // Note Resizing
  const resizeNote = useRef<{
    active: boolean;
    noteId: string;
    direction: "left" | "right";
    initialMouseX: number;
    initialX: number;
    initialWidth: number;
    pointerId: number | null;
  }>({ active: false, noteId: "", direction: "right", initialMouseX: 0, initialX: 0, initialWidth: 0, pointerId: null });

  // Area Dragging
  const dragArea = useRef<{
    active: boolean;
    initialMouseX: number;
    initialMouseY: number;
    initialPositions: Map<string, { x: number, y: number }>;
    childTables: string[]; // IDs of tables being dragged with area
    childNotes: string[];  // IDs of notes being dragged with area
    // We need original positions of children too to avoid drift
    childInitPositions: Map<string, { x: number, y: number }>;
    pointerId: number | null;
  }>({
    active: false,
    initialMouseX: 0,
    initialMouseY: 0,
    initialPositions: new Map(),
    childTables: [],
    childNotes: [],
    childInitPositions: new Map(),
    pointerId: null
  });

  // Area Resizing
  const resizeArea = useRef<{
    active: boolean;
    areaId: string;
    direction: "tl" | "tr" | "bl" | "br"; // corners
    initialMouseX: number;
    initialMouseY: number;
    initialX: number;
    initialY: number;
    initialWidth: number;
    initialHeight: number;
    pointerId: number | null;
  }>({
    active: false,
    areaId: "",
    direction: "br",
    initialMouseX: 0,
    initialMouseY: 0,
    initialX: 0,
    initialY: 0,
    initialWidth: 0,
    initialHeight: 0,
    pointerId: null
  });

  // Marquee Selection dragging
  const dragSelection = useRef<{
    active: boolean;
    startX: number; // World coordinates
    startY: number;
    currentX: number;
    currentY: number;
    pointerId: number | null;
  }>({ active: false, startX: 0, startY: 0, currentX: 0, currentY: 0, pointerId: null });

  // Actions
  const relationships = useCanvasStore((s) => s.relationships);
  // Hovering dims every line that is not lit. On a large schema that repaints
  // the canvas on every hover, so past a point the dim is dropped — see
  // MAX_DIMMED_RELS.
  const dim = affordableDim(canvasStyle.dim, relationships.length);
  const addRelationship = useCanvasStore((s) => s.addRelationship);

  const snapToGrid = useCanvasStore((s) => s.snapToGrid);

  // Where relationships cross into a hidden schema — drawn as short dashed
  // stubs so a filtered view never looks self-contained when it isn't.
  // Built from ids and names only, on the name signature: it runs when a
  // schema is hidden or shown, a table renamed or a relationship edited —
  // never during a drag. Nothing at all when nothing is hidden.
  const crossStubs = useMemo(
    () => (anyHidden ? buildCrossSchemaStubs(tables, relationships, hiddenSchemas) : NO_STUBS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [relationships, hiddenSchemas, nameSignature, anyHidden]
  );

  // Positions of the hidden tables the stubs point at — only which way a stub
  // leaves the card depends on them. Empty (and free) with no stubs.
  const stubTargetX = useMemo(() => {
    if (crossStubs.length === 0) return null;
    const wanted = new Set(crossStubs.flatMap((s) => s.targets.map((t) => t.tableId)));
    const out = new Map<string, number>();
    for (const t of tables) if (wanted.has(t.id)) out.set(t.id, t.x);
    return out;
  }, [crossStubs, tables]);

  // Connection dragging
  const dragConnection = useRef<{
    active: boolean;
    sourceTableId: string;
    sourceColumnId: string;
    sourceSide: Side;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    /** Row under the pointer in another table — the line snaps to it. */
    dropTableId: string | null;
    dropColumnId: string | null;
    pointerId: number | null;
  }>({
    active: false, sourceTableId: "", sourceColumnId: "", sourceSide: 1,
    startX: 0, startY: 0, currentX: 0, currentY: 0,
    dropTableId: null, dropColumnId: null, pointerId: null,
  });

  const [, setTick] = useState(0);

  // Focus mode (1st and 2nd degree). Computed here, but applied to the DOM by
  // applyHighlight rather than passed down as props — see computeFocus.
  const focus = useMemo(
    () => computeFocus(relationships, selectedTableIds, isFocusModeEnabled),
    [relationships, selectedTableIds, isFocusModeEnabled]
  );

  // Every relationship endpoint resolves a table by id on every render; with a
  // linear find that is O(relationships × tables) per frame during a drag.
  //
  // Built from the *visible* tables, which is how a hidden schema's lines
  // disappear: `routedRelationships` skips any relationship with an endpoint it
  // can't resolve, so an edge touching a hidden table drops out of routing, the
  // DOM, the ports and the highlight sets without a second filter.
  const tablesById = useMemo(() => new Map(visibleTables.map((t) => [t.id, t])), [visibleTables]);

  const minimapTables = useMemo(
    () => visibleTables.map((t) => ({ id: t.id, x: t.x, y: t.y, width: geo.width, height: tableHeight(geo, t.columns.length) })),
    [visibleTables, geo]
  );

  // Where a table is drawn right now — its stored position plus any live drag
  // offset (and grid snap), so lines follow the card mid-gesture.
  const getLiveTablePosition = useCallback((tableId: string) => {
    const table = tablesById.get(tableId);
    if (!table) return null;

    let x = table.x;
    let y = table.y;

    if (dragOffset.active) {
      const moving =
        (dragTable.current.active && dragTable.current.initialPositions.has(tableId)) ||
        (dragArea.current.active && dragArea.current.childTables.includes(tableId));
      if (moving) {
        x += dragOffset.dx;
        y += dragOffset.dy;
        if (snapToGrid) {
          x = Math.round(x / 24) * 24;
          y = Math.round(y / 24) * 24;
        }
      }
    }
    return { table, x, y };
  }, [tablesById, dragOffset, snapToGrid]);

  // World position of a column's handle on the given edge (1 = right, -1 = left).
  const getColumnPosition = useCallback((tableId: string, columnId: string, side: Side): PortPoint | null => {
    const live = getLiveTablePosition(tableId);
    if (!live) return null;
    const colIndex = live.table.columns.findIndex(c => c.id === columnId);
    if (colIndex === -1) return null;
    return {
      x: live.x + (side === 1 ? geo.width : 0),
      y: live.y + rowCenterY(geo, colIndex),
      d: side,
    };
  }, [getLiveTablePosition, geo]);

  // The memoised TableNodes keep whichever callback they first saw, so route
  // through a ref to always reach the current closure (positions, geometry).
  const columnPointerDownRef = useRef<(e: React.PointerEvent, tableId: string, columnId: string, side: Side) => void>(() => {});
  const onColumnPointerDown = (e: React.PointerEvent, tableId: string, columnId: string, side: Side) => {
    if (readOnly) return; // no creating relationships in a read-only viewer

    e.stopPropagation();
    e.preventDefault();

    const pos = getColumnPosition(tableId, columnId, side);
    if (!pos) return;

    const target = e.currentTarget as Element;
    target.setPointerCapture(e.pointerId);

    dragConnection.current = {
      active: true,
      sourceTableId: tableId,
      sourceColumnId: columnId,
      sourceSide: side,
      startX: pos.x,
      startY: pos.y,
      currentX: pos.x,
      currentY: pos.y,
      dropTableId: null,
      dropColumnId: null,
      pointerId: e.pointerId
    };
    setTick(t => t + 1);
  };
  useLayoutEffect(() => {
    columnPointerDownRef.current = onColumnPointerDown;
  });
  const handleColumnPointerDown = useCallback(
    (e: React.PointerEvent, tableId: string, columnId: string, side: Side) =>
      columnPointerDownRef.current(e, tableId, columnId, side),
    []
  );

  const onPointerDown = (e: React.PointerEvent) => {
    // If dragging a table, don't pan
    if (dragTable.current.active) return;

    // Middle mouse or Space+Left = Pan
    const shouldPan = e.button === 1 || (e.button === 0 && spaceDown);

    if (shouldPan) {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      drag.current = {
        active: true,
        lastX: e.clientX,
        lastY: e.clientY,
        pointerId: e.pointerId,
      };
      return;
    }

    // Left click on background -> Marquee Selection
    if (e.button === 0) {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const live = getLiveCamera();
      const worldX = (e.clientX - rect.left - live.x) / live.zoom;
      const worldY = (e.clientY - rect.top - live.y) / live.zoom;

      dragSelection.current = {
        active: true,
        startX: worldX,
        startY: worldY,
        currentX: worldX,
        currentY: worldY,
        pointerId: e.pointerId
      };
      // Clear selection unless shift is held (DrawDB behavior usually clears)
      // Let's clear for now to be simple
      if (!e.shiftKey) {
        setSelectedTableIds([]);
      }
      setSelectionRect({ x: worldX, y: worldY, w: 0, h: 0 });
    }
  };

  const onTablePointerDown = (e: React.PointerEvent, tableId: string) => {
    if (spaceDown) return; // If panning mode, ignore table drag

    e.stopPropagation();
    e.preventDefault();

    // TEMP diagnostics — resets the debug clock so each click reads from 0ms.
    mark(`click table ${tableId}`);
    dlog("click", "onTablePointerDown", {
      tablesOnScreen: rootRef.current?.querySelectorAll("[data-table-card]").length,
      totalTables: tables.length,
      totalRelationships: relationships.length,
    });

    const table = tables.find(t => t.id === tableId);
    if (!table) return;

    // If table is locked, just select it (single) and return
    if (table.isLocked) {
      setSelectedTableIds([tableId]);
      if (!readOnly) openTab("tables", "left");
      return;
    }

    const target = e.currentTarget as Element;
    if (!readOnly) target.setPointerCapture(e.pointerId);

    // Selection Logic:
    // If clicking an unselected table, select it (exclusive) unless Shift
    // If clicking a selected table, keep selection (to allow group drag)
    let newSelectedIds = [...selectedTableIds];
    if (!selectedTableIds.includes(tableId)) {
      if (e.shiftKey) {
        newSelectedIds.push(tableId);
      } else {
        newSelectedIds = [tableId];
      }
      setSelectedTableIds(newSelectedIds);
      openTab("tables", "left");
      // Force update local variable for initPositions
    }
    // If shift clicking an already selected table, deselect it? 
    // Standard behavior: 
    // - Click selected: Start drag
    // - Shift+Click selected: Deselect (and don't drag typically, or drag remaining)
    else if (e.shiftKey) {
      newSelectedIds = newSelectedIds.filter(id => id !== tableId);
      setSelectedTableIds(newSelectedIds);
      return; // Don't drag if we just deselected it
    }

    if (readOnly) return; // selection only — no drag in a read-only viewer

    // Prepare group drag
    const initialPositions = new Map<string, { x: number, y: number }>();
    // Through `tablesById`, so a selected table in a hidden schema stays put.
    newSelectedIds.forEach(id => {
      const t = tablesById.get(id);
      if (t) initialPositions.set(id, { x: t.x, y: t.y });
    });

    dragTable.current = {
      active: true,
      initialMouseX: e.clientX,
      initialMouseY: e.clientY,
      initialPositions,
      pointerId: e.pointerId
    };
  };

  const onNotePointerDown = (e: React.PointerEvent, noteId: string) => {
    if (spaceDown) return;
    e.stopPropagation();
    e.preventDefault();

    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    const target = e.target as Element;
    const resizeDir = target.getAttribute("data-note-resize");

    // Handle Resizing
    if (!readOnly && resizeDir && (resizeDir === "left" || resizeDir === "right") && !note.isLocked) {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      resizeNote.current = {
        active: true,
        noteId,
        direction: resizeDir,
        initialMouseX: e.clientX,
        initialX: note.x,
        initialWidth: note.width,
        pointerId: e.pointerId
      };
      return;
    }

    // If locked, just select
    if (note.isLocked) {
      setSelectedNoteIds([noteId]);
      if (!readOnly) openTab("notes", "left");
      return;
    }

    if (!readOnly) (e.currentTarget as Element).setPointerCapture(e.pointerId);

    // Selection Logic (similar to tables)
    let newSelectedIds = [...selectedNoteIds];
    if (!selectedNoteIds.includes(noteId)) {
      if (e.shiftKey) {
        newSelectedIds.push(noteId);
      } else {
        newSelectedIds = [noteId];
      }
      setSelectedNoteIds(newSelectedIds);
      openTab("notes", "left");
    } else if (e.shiftKey) {
      newSelectedIds = newSelectedIds.filter(id => id !== noteId);
      setSelectedNoteIds(newSelectedIds);
      return;
    }

    if (readOnly) return; // selection only — no drag in a read-only viewer

    // Group Drag Init
    const initialPositions = new Map<string, { x: number, y: number }>();
    newSelectedIds.forEach(id => {
      const n = notes.find(n => n.id === id);
      if (n) initialPositions.set(id, { x: n.x, y: n.y });
    });

    dragNote.current = {
      active: true,
      initialMouseX: e.clientX,
      initialMouseY: e.clientY,
      initialPositions,
      pointerId: e.pointerId
    };
  };

  const onAreaPointerDown = (e: React.PointerEvent, areaId: string) => {
    if (spaceDown) return;
    e.stopPropagation();
    e.preventDefault();

    const area = areas.find(a => a.id === areaId);
    if (!area) return;

    const target = e.target as Element;
    const resizeDir = target.getAttribute("data-area-resize") as "tl" | "tr" | "bl" | "br" | null;

    // Handle Resizing
    if (!readOnly && resizeDir && !area.isLocked) {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      resizeArea.current = {
        active: true,
        areaId,
        direction: resizeDir,
        initialMouseX: e.clientX,
        initialMouseY: e.clientY,
        initialX: area.x,
        initialY: area.y,
        initialWidth: area.width,
        initialHeight: area.height,
        pointerId: e.pointerId
      };
      return;
    }

    // If locked, select only
    if (area.isLocked) {
      setSelectedAreaIds([areaId]);
      if (!readOnly) openTab("areas", "left");
      return;
    }

    if (!readOnly) (e.currentTarget as Element).setPointerCapture(e.pointerId);

    // Selection Logic
    let newSelectedIds = [...selectedAreaIds];
    if (!selectedAreaIds.includes(areaId)) {
      if (e.shiftKey) {
        newSelectedIds.push(areaId);
      } else {
        newSelectedIds = [areaId];
      }
      setSelectedAreaIds(newSelectedIds);
      if (!readOnly) openTab("areas", "left");
    } else if (e.shiftKey) {
      newSelectedIds = newSelectedIds.filter(id => id !== areaId);
      setSelectedAreaIds(newSelectedIds);
      return;
    }

    if (readOnly) return; // selection only — no drag in a read-only viewer

    // DRAG LOGIC FOR AREA + CHILDREN
    const initialPositions = new Map();
    newSelectedIds.forEach(id => {
      const a = areas.find(a => a.id === id);
      if (a) initialPositions.set(id, { x: a.x, y: a.y });
    });

    // Find children ONLY if dragging a SINGLE area (for simplicity first, or all selected areas?)
    // Let's implement for single area drag first or union of children. 
    // DrawDB behavior: when moving a group (area), everything inside moves.

    const childTables: string[] = [];
    const childNotes: string[] = [];
    const childInitPositions = new Map();

    // Only check children if we are dragging actual areas (not just selection)
    // Check intersection for "this" area or ALL selected areas? 
    // Usually dragging multiple areas moves their respective children.

    const relevantAreas = newSelectedIds.map(id => areas.find(a => a.id === id)).filter(Boolean) as Area[];

    relevantAreas.forEach(a => {
      const rect = { l: a.x, r: a.x + a.width, t: a.y, b: a.y + a.height };

      // Find Tables inside
      tables.forEach(t => {
        // Rough center checks or full containment? Center is best feel.
        const tW = geo.width; const tH = tableHeight(geo, t.columns.length);
        const tCx = t.x + tW / 2;
        const tCy = t.y + tH / 2;
        if (tCx > rect.l && tCx < rect.r && tCy > rect.t && tCy < rect.b) {
          if (!childTables.includes(t.id)) {
            childTables.push(t.id);
            childInitPositions.set(`t:${t.id}`, { x: t.x, y: t.y });
          }
        }
      });

      // Find Notes inside
      notes.forEach(n => {
        const nCx = n.x + n.width / 2;
        const nCy = n.y + n.height / 2;
        if (nCx > rect.l && nCx < rect.r && nCy > rect.t && nCy < rect.b) {
          if (!childNotes.includes(n.id)) {
            childNotes.push(n.id);
            childInitPositions.set(`n:${n.id}`, { x: n.x, y: n.y });
          }
        }
      });
    });

    dragArea.current = {
      active: true,
      initialMouseX: e.clientX,
      initialMouseY: e.clientY,
      initialPositions,
      childTables,
      childNotes,
      childInitPositions,
      pointerId: e.pointerId
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    // 1. Handle Table Drag
    if (dragTable.current.active) {
      e.preventDefault();
      const dx = (e.clientX - dragTable.current.initialMouseX) / camera.zoom;
      const dy = (e.clientY - dragTable.current.initialMouseY) / camera.zoom;
      scheduleGestureFrame(() => setDragOffset({ dx, dy, active: true }));
      return;
    }

    // 1.5 Handle Note Drag & Resize
    if (dragNote.current.active) {
      e.preventDefault();
      const dx = (e.clientX - dragNote.current.initialMouseX) / camera.zoom;
      const dy = (e.clientY - dragNote.current.initialMouseY) / camera.zoom;
      scheduleGestureFrame(() => setDragOffset({ dx, dy, active: true }));
      return;
    }

    if (resizeNote.current.active) {
      e.preventDefault();
      const dx = (e.clientX - resizeNote.current.initialMouseX) / camera.zoom;
      const { initialWidth, initialX, direction, noteId } = resizeNote.current;

      scheduleGestureFrame(() => {
        const updateNote = useCanvasStore.getState().updateNote;
        if (direction === "right") {
          const newWidth = Math.max(100, initialWidth + dx); // Min width 100
          updateNote(noteId, { width: newWidth });
        } else {
          const newWidth = Math.max(100, initialWidth - dx);
          const newX = initialX + (initialWidth - newWidth); // Shift X to keep right side fixed
          updateNote(noteId, { width: newWidth, x: newX });
        }
      });
      return;
    }



    // 1.8 Handle Area Drag & Resize
    if (dragArea.current.active) {
      e.preventDefault();
      const dx = (e.clientX - dragArea.current.initialMouseX) / camera.zoom;
      const dy = (e.clientY - dragArea.current.initialMouseY) / camera.zoom;
      scheduleGestureFrame(() => setDragOffset({ dx, dy, active: true }));
      return;
    }

    if (resizeArea.current.active) {
      e.preventDefault();
      const dx = (e.clientX - resizeArea.current.initialMouseX) / camera.zoom;
      const dy = (e.clientY - resizeArea.current.initialMouseY) / camera.zoom;
      const { initialWidth, initialHeight, initialX, initialY, direction, areaId } = resizeArea.current;

      scheduleGestureFrame(() => {
        const updateArea = useCanvasStore.getState().updateArea;

        let newX = initialX;
        let newY = initialY;
        let newW = initialWidth;
        let newH = initialHeight;

        if (direction.includes("r")) {
          newW = Math.max(100, initialWidth + dx);
        }
        if (direction.includes("b")) {
          newH = Math.max(100, initialHeight + dy);
        }
        if (direction.includes("l")) {
          const proposedW = initialWidth - dx;
          if (proposedW >= 100) {
            newX = initialX + dx;
            newW = proposedW;
          }
        }
        if (direction.includes("t")) {
          const proposedH = initialHeight - dy;
          if (proposedH >= 100) {
            newY = initialY + dy;
            newH = proposedH;
          }
        }

        updateArea(areaId, { x: newX, y: newY, width: newW, height: newH });
      });
      return;
    }

    // 2. Handle Connection Drag
    if (dragConnection.current.active) {
      e.preventDefault();
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;

      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      const live = getLiveCamera();
      const worldX = (clientX - live.x) / live.zoom;
      const worldY = (clientY - live.y) / live.zoom;

      dragConnection.current.currentX = worldX;
      dragConnection.current.currentY = worldY;

      // The source handle holds pointer capture, so rows never see enter
      // events — hit-test instead to find the row the line should snap to.
      const hitRow = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest<SVGElement>("[data-col-id]");
      const hitTableId = hitRow?.getAttribute("data-table-id") ?? null;
      const valid = !!hitTableId && hitTableId !== dragConnection.current.sourceTableId;
      dragConnection.current.dropTableId = valid ? hitTableId : null;
      dragConnection.current.dropColumnId = valid ? hitRow!.getAttribute("data-col-id") : null;
      // The ref already holds the newest point; only the repaint is deferred.
      scheduleGestureFrame(() => setTick(t => t + 1));
      return;
    }

    // 3. Handle Marquee Selection
    if (dragSelection.current.active) {
      e.preventDefault();
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;

      const live = getLiveCamera();
      const worldX = (e.clientX - rect.left - live.x) / live.zoom;
      const worldY = (e.clientY - rect.top - live.y) / live.zoom;

      dragSelection.current.currentX = worldX;
      dragSelection.current.currentY = worldY;

      // Calculate normalized rect
      const x = Math.min(dragSelection.current.startX, worldX);
      const y = Math.min(dragSelection.current.startY, worldY);
      const w = Math.abs(worldX - dragSelection.current.startX);
      const h = Math.abs(worldY - dragSelection.current.startY);

      scheduleGestureFrame(() => setSelectionRect({ x, y, w, h }));
      return;
    }

    // 4. Handle Canvas Pan
    if (!drag.current.active) return;
    const dx = e.clientX - drag.current.lastX;
    const dy = e.clientY - drag.current.lastY;
    drag.current.lastX = e.clientX;
    drag.current.lastY = e.clientY;
    queuePan(dx, dy);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const target = e.currentTarget as Element;

    // Land the frame the gesture had queued before reading final positions,
    // otherwise the last pointermove's worth of movement is dropped.
    flushGestureFrame();

    // Handle Table Drop
    if (dragTable.current.active && dragTable.current.pointerId === e.pointerId) {
      const finalDx = (e.clientX - dragTable.current.initialMouseX) / camera.zoom;
      const finalDy = (e.clientY - dragTable.current.initialMouseY) / camera.zoom;
      const moves: { id: string, x: number, y: number }[] = [];
      const SNAP = 24;

      dragTable.current.initialPositions.forEach((initPos, id) => {
        let newX = initPos.x + finalDx;
        let newY = initPos.y + finalDy;
        if (snapToGrid) {
           newX = Math.round(newX / SNAP) * SNAP;
           newY = Math.round(newY / SNAP) * SNAP;
        }
        if (newX !== initPos.x || newY !== initPos.y) moves.push({ id, x: newX, y: newY });
      });

      if (moves.length > 0) moveTables(moves);
      endDragOffset();

      dragTable.current.active = false;
      dragTable.current.pointerId = null;
      dragTable.current.initialPositions.clear();
      if (target.hasPointerCapture(e.pointerId)) {
        target.releasePointerCapture(e.pointerId);
      }
      return;
    }

    // Handle Note Drop
    if (dragNote.current.active && dragNote.current.pointerId === e.pointerId) {
      const finalDx = (e.clientX - dragNote.current.initialMouseX) / camera.zoom;
      const finalDy = (e.clientY - dragNote.current.initialMouseY) / camera.zoom;
      const moves: { id: string, x: number, y: number }[] = [];
      const SNAP = 24;

      dragNote.current.initialPositions.forEach((initPos, id) => {
        let newX = initPos.x + finalDx;
        let newY = initPos.y + finalDy;
        if (snapToGrid) {
           newX = Math.round(newX / SNAP) * SNAP;
           newY = Math.round(newY / SNAP) * SNAP;
        }
        if (newX !== initPos.x || newY !== initPos.y) moves.push({ id, x: newX, y: newY });
      });

      if (moves.length > 0) moveNotes(moves);
      endDragOffset();

      dragNote.current.active = false;
      dragNote.current.pointerId = null;
      dragNote.current.initialPositions.clear();
      if (target.hasPointerCapture(e.pointerId)) {
        target.releasePointerCapture(e.pointerId);
      }
      return;
    }

    if (resizeNote.current.active && resizeNote.current.pointerId === e.pointerId) {
      resizeNote.current.active = false;
      resizeNote.current.pointerId = null;
      if (target.hasPointerCapture(e.pointerId)) {
        target.releasePointerCapture(e.pointerId);
      }
      return;
    }

    if (dragArea.current.active && dragArea.current.pointerId === e.pointerId) {
      const finalDx = (e.clientX - dragArea.current.initialMouseX) / camera.zoom;
      const finalDy = (e.clientY - dragArea.current.initialMouseY) / camera.zoom;
      const SNAP = 24;

      const moves: { id: string, x: number, y: number }[] = [];
      dragArea.current.initialPositions.forEach((initPos, id) => {
        let newX = initPos.x + finalDx;
        let newY = initPos.y + finalDy;
        if (snapToGrid) {
           newX = Math.round(newX / SNAP) * SNAP;
           newY = Math.round(newY / SNAP) * SNAP;
        }
        if (newX !== initPos.x || newY !== initPos.y) moves.push({ id, x: newX, y: newY });
      });
      if (moves.length > 0) moveAreas(moves);

      const tableMoves: { id: string, x: number, y: number }[] = [];
      dragArea.current.childTables.forEach(tId => {
        const init = dragArea.current.childInitPositions.get(`t:${tId}`);
        if (init) {
          let newX = init.x + finalDx;
          let newY = init.y + finalDy;
          if (snapToGrid) {
            newX = Math.round(newX / SNAP) * SNAP;
            newY = Math.round(newY / SNAP) * SNAP;
          }
          if (newX !== init.x || newY !== init.y) tableMoves.push({ id: tId, x: newX, y: newY });
        }
      });
      if (tableMoves.length > 0) moveTables(tableMoves);

      const noteMoves: { id: string, x: number, y: number }[] = [];
      dragArea.current.childNotes.forEach(nId => {
        const init = dragArea.current.childInitPositions.get(`n:${nId}`);
        if (init) {
          let newX = init.x + finalDx;
          let newY = init.y + finalDy;
          if (snapToGrid) {
            newX = Math.round(newX / SNAP) * SNAP;
            newY = Math.round(newY / SNAP) * SNAP;
          }
          if (newX !== init.x || newY !== init.y) noteMoves.push({ id: nId, x: newX, y: newY });
        }
      });
      if (noteMoves.length > 0) moveNotes(noteMoves);

      endDragOffset();

      dragArea.current.active = false;
      dragArea.current.pointerId = null;
      dragArea.current.initialPositions.clear();
      dragArea.current.childInitPositions.clear();
      dragArea.current.childTables = [];
      dragArea.current.childNotes = [];
      if (target.hasPointerCapture(e.pointerId)) {
        target.releasePointerCapture(e.pointerId);
      }
      return;
    }

    if (resizeArea.current.active && resizeArea.current.pointerId === e.pointerId) {
      resizeArea.current.active = false;
      resizeArea.current.pointerId = null;
      if (target.hasPointerCapture(e.pointerId)) {
        target.releasePointerCapture(e.pointerId);
      }
      return;
    }

    // Handle Connection Drop
    if (dragConnection.current.active && dragConnection.current.pointerId === e.pointerId) {
      dragConnection.current.active = false;
      dragConnection.current.pointerId = null;
      if (target.hasPointerCapture(e.pointerId)) {
        target.releasePointerCapture(e.pointerId);
      }
      setTick(t => t + 1);

      // Dropped on any part of a row (not just its handle) in another table?
      const hitRow = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest<SVGElement>("[data-col-id]");
      const dropTableId = hitRow?.getAttribute("data-table-id");
      const dropColId = hitRow?.getAttribute("data-col-id");
      dragConnection.current.dropTableId = null;
      dragConnection.current.dropColumnId = null;

      if (dropTableId && dropColId && dropTableId !== dragConnection.current.sourceTableId) {
        const id = crypto.randomUUID();
        addRelationship({
          id,
          sourceTableId: dragConnection.current.sourceTableId,
          sourceColumnId: dragConnection.current.sourceColumnId,
          targetTableId: dropTableId,
          targetColumnId: dropColId
        });
        setNewRelationshipIds((ids) => [...ids, id]);
        window.setTimeout(() => setNewRelationshipIds((ids) => ids.filter((x) => x !== id)), 1600);
      }

      return;
    }

    // Handle Marquee Drop
    if (dragSelection.current.active && dragSelection.current.pointerId === e.pointerId) {
      dragSelection.current.active = false;
      dragSelection.current.pointerId = null;
      if (target.hasPointerCapture(e.pointerId)) {
        target.releasePointerCapture(e.pointerId);
      }

      // Sync Calculation using Ref (more reliable than state during rapid events)
      const { startX, startY, currentX, currentY } = dragSelection.current;

      // Normalize bounds
      const rX = Math.min(startX, currentX);
      const rY = Math.min(startY, currentY);
      const rR = Math.max(startX, currentX);
      const rB = Math.max(startY, currentY);

      // Only select if box has some size (avoid accidental clicks acting as tiny drags)
      if (Math.abs(currentX - startX) > 5 || Math.abs(currentY - startY) > 5) {
        const insideIds: string[] = [];

        // A marquee can't select what it can't see.
        visibleTables.forEach(t => {
          // Estimate Table Bounds
          const estWidth = geo.width;
          const estHeight = tableHeight(geo, t.columns?.length || 0);

          const tX = t.x;
          const tY = t.y;
          const tR = t.x + estWidth;
          const tB = t.y + estHeight;

          // AABB Intersection: Rect overlaps Table
          // Check if rectangles overlap
          const overlaps = (rX < tR && rR > tX && rY < tB && rB > tY);

          if (overlaps) {
            insideIds.push(t.id);
          }
        });

        if (insideIds.length > 0) {
          setSelectedTableIds(e.shiftKey ? [...selectedTableIds, ...insideIds] : insideIds);
        } else if (!e.shiftKey) {
          setSelectedTableIds([]);
        }
      }

      setSelectionRect(null);
      return;
    }

    if (drag.current.pointerId !== e.pointerId) return;
    drag.current.active = false;
    drag.current.pointerId = null;
    // Land the gesture in the store immediately rather than waiting out the
    // idle timer — the pending frame is redundant once React re-renders.
    if (pan.current.raf) {
      cancelAnimationFrame(pan.current.raf);
      pan.current.raf = 0;
    }
    commitPan();
  };

  /**
   * DrawDB-like wheel behavior:
   * - wheel => pan
   * - shift+wheel => horizontal pan
   * - ctrl/meta+wheel => zoom at cursor
   */
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      const isZoomGesture = e.ctrlKey || e.metaKey;

      if (isZoomGesture) {
        // Zoom changes the scale, culling and the grid spacing — it has to go
        // through React, so land any pan still buffered in the ref first.
        commitPan();
        const factor = Math.exp(-e.deltaY * 0.0015);
        const safeFactor = clamp(factor, 0.85, 1.15);
        zoomAt(safeFactor, sx, sy);
        return;
      }

      let dx = -e.deltaX;
      let dy = -e.deltaY;

      if (e.shiftKey) {
        dx = -e.deltaY;
        dy = 0;
      }

      dx = clamp(dx, -120, 120);
      dy = clamp(dy, -120, 120);

      queuePan(dx, dy);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [queuePan, commitPan, zoomAt]);

  // Runs after every render (so nodes that just mounted get their state) and on
  // every hover change (so a pointer move costs a few attribute writes instead
  // of a React pass over the whole stage). No dependency array on purpose: the
  // closure has to see this render's relationships and selection.
  useLayoutEffect(() => {
    const apply = () =>
      applyHighlight(
        svgRef.current,
        computeHighlight(hoverStore.get(), relationships, selectedTableIds, selectedRelationshipId, isExporting),
        dim,
        isExporting ? undefined : focus
      );
    apply();
    return hoverStore.subscribe(apply);
  });

  const worldTransform = useMemo(
    () => `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
    [camera.x, camera.y, camera.zoom]
  );

  // How much of each card is worth drawing at this zoom. Culling alone can't
  // save a 400-table schema: zoomed out to fit, every card genuinely is on
  // screen, so the only lever left is drawing less of each one. Exports always
  // get full detail — they aren't bound by a frame budget.
  const lod = isExporting ? "full" : tableLodForZoom(camera.zoom);

  // Viewport Culling Bounds.
  //
  // The margin is in *screen* pixels, converted to world units here — it used to
  // be a flat 1500 world units, which is 225px of off-screen paint at zoom 0.15
  // but 937px at zoom 0.6. That made the composited layer grow with zoom (~7x the
  // viewport at 0.6) and cost more than the culling saved: 32fps at working zoom
  // against 162fps once the off-screen cards were gone. In screen space the
  // painted area is the viewport plus a fixed border at every zoom level.
  //
  // It only has to outrun the gesture: culling is recomputed when the camera
  // commits, so it can trail the visible position by at most PAN_COMMIT_PX.
  //
  // Safe to read the committed camera here even mid-gesture: `commitPan` zeroes
  // the buffered delta before it writes, so at render time the two agree.
  // Disabled entirely while exporting to SVG so the export captures the
  // whole diagram, not just what's currently panned into view.
  const CULL_MARGIN = CULL_MARGIN_PX / camera.zoom;
  const vLeft = isExporting ? -Infinity : -camera.x / camera.zoom - CULL_MARGIN;
  const vTop = isExporting ? -Infinity : -camera.y / camera.zoom - CULL_MARGIN;
  const vRight = isExporting ? Infinity : (-camera.x + viewport.w) / camera.zoom + CULL_MARGIN;
  const vBottom = isExporting ? Infinity : (-camera.y + viewport.h) / camera.zoom + CULL_MARGIN;

  // Endpoints *and* the SVG path for every relationship. Memoised on what can
  // actually move them — not on the camera: panning re-renders the stage but
  // never changes a single one of these, and re-running `routeRelationship`
  // for a few hundred lines on every pan commit was pure waste.
  const routedRelationships = useMemo(() => {
    const out: RoutedRelationship[] = [];
    for (const rel of relationships) {
      const a = getLiveTablePosition(rel.sourceTableId);
      const b = getLiveTablePosition(rel.targetTableId);
      if (!a || !b) continue;
      const [sa, sb] = pickSides(a.x, b.x, geo.width);
      const start = getColumnPosition(rel.sourceTableId, rel.sourceColumnId, sa);
      const end = getColumnPosition(rel.targetTableId, rel.targetColumnId, sb);
      if (!start || !end) continue;
      out.push({ rel, source: a.table, target: b.table, start, end, path: routeRelationship(canvasStyle.routing, start, end) });
    }
    return out;
  }, [relationships, geo, canvasStyle.routing, getLiveTablePosition, getColumnPosition]);

  // Colour of the line where it meets `table`, at rest (gradient lines change
  // colour end to end). Lighting a line up is a CSS concern now — only the
  // `neutral` mode recolours on hover, and the stylesheet handles that.
  const endColor = useCallback((source: Table, table: Table) => {
    switch (canvasStyle.color) {
      case "neutral":
        return QUIET_LINE;
      case "primary":
        return "var(--primary)";
      case "source":
        return source.color;
      case "gradient":
        return table.color;
    }
  }, [canvasStyle.color]);

  // Per-table strings for the memoised TableNodes (cheap equality checks).
  // Hover-independent, so pointing at a card no longer invalidates every node.
  const portsByTable = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const { rel, source, target, start, end } of routedRelationships) {
      pushTo(map, source.id, `${rel.sourceColumnId}|${start.d === 1 ? "r" : "l"}|${endColor(source, source)}`);
      pushTo(map, target.id, `${rel.targetColumnId}|${end.d === 1 ? "r" : "l"}|${endColor(source, target)}`);
    }
    return map;
  }, [routedRelationships, endColor]);

  const foreignKeysByTable = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const rel of relationships) {
      const fk = foreignKeyEnd(rel);
      pushTo(map, fk.tableId, fk.columnId);
    }
    return map;
  }, [relationships]);

  const dc = dragConnection.current;

  return (
    <div
      ref={rootRef}
      className="relative h-full w-full overflow-hidden bg-canvas-bg"
      onPointerEnter={() => (pointerOverCanvas.current = true)}
      onPointerLeave={() => (pointerOverCanvas.current = false)}
    >
      {/* World */}
      <div
        className="absolute inset-0 touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{ cursor: spaceDown ? "grab" : "default" }}
      >
        <WorldBackground
          ref={backgroundRef}
          camera={camera}
          variant={background}
        />
        {/* The svg is viewport-sized and the camera rides an inner <g>.
            It used to be the other way round — a 1x1 `overflow: visible` svg
            inside the transformed element — which made the painted layer as big
            as the whole diagram. Chromium rasterises such a layer in tiles, and
            once a schema had a few hundred tables it could not finish a tile
            inside a frame, so panning showed the unpainted (blank) ones. Clipped
            to the viewport there is a bounded amount to paint at any zoom. */}
        <svg
          ref={svgRef}
          data-diagram-canvas-svg
          width="100%"
          height="100%"
          // `data-canvas-hover` is toggled imperatively; these two are static
          // per style and let the stylesheet scope the hover rules.
          data-canvas-dim={dim}
          data-canvas-color={canvasStyle.color}
          className="absolute inset-0 pointer-events-none"
        >
          <g
            ref={worldRef}
            data-diagram-world
            style={{
              transform: worldTransform,
              transformOrigin: "0 0",
              transformBox: "view-box",
              // Promote the group to its own compositor layer so a pan is a GPU
              // shift rather than a repaint — but only at `block` zoom, where
              // the canvas is plain rectangles. Measured at 428 tables:
              //
              //   zoom 0.17   145fps promoted   vs   18fps not
              //   zoom 0.60    29fps promoted   vs   51fps not
              //   zoom 1.02    48fps promoted   vs  126fps not
              //
              // Once cards draw text the trade inverts. The layer covers the
              // viewport plus the cull margin, and a long relationship line
              // stretches it further; rasterising that much text tile by tile as
              // the layer moves costs more than repainting the dirty region does.
              // With no text to raster, the promoted layer is close to free.
              willChange: lod === "block" ? "transform" : undefined,
            }}
          >
            {/* Existing Relationships */}
            <RelationshipLayer
              routedRelationships={routedRelationships}
              canvasStyle={canvasStyle}
              lod={lod}
              isExporting={isExporting}
              selectedRelationshipId={selectedRelationshipId}
              newRelationshipIds={newRelationshipIds}
              vLeft={vLeft}
              vRight={vRight}
              vTop={vTop}
              vBottom={vBottom}
              spaceDown={spaceDown}
              readOnly={readOnly}
              hoverStore={hoverStore}
              endColor={endColor}
              setSelectedRelationshipId={setSelectedRelationshipId}
              openTab={openTab}
            />

            {/* Cross-schema stubs: a hint, not a line — a short dashed run out of
                the visible column toward the hidden table, and at readable zoom
                its name. Click to show that schema. Left out of exports ("what
                you see" means the real diagram) and at `block` zoom, which stays
                text-free and cheap. Culled with the tables they hang off. */}
            {stubTargetX && lod !== "block" && !isExporting && (
              <g data-cross-stubs>
                {crossStubs.map((stub) => {
                  const live = getLiveTablePosition(stub.tableId);
                  if (!live) return null;
                  const h = tableHeight(geo, live.table.columns.length);
                  if (live.x + geo.width + 200 < vLeft || live.x - 200 > vRight || live.y + h < vTop || live.y > vBottom) {
                    return null;
                  }

                  // Leave from the edge facing the (first) hidden table.
                  const targetX = stubTargetX.get(stub.targets[0].tableId) ?? live.x;
                  const [side] = pickSides(live.x, targetX, geo.width);
                  const port = getColumnPosition(stub.tableId, stub.columnId, side);
                  if (!port) return null;

                  const endX = port.x + side * CROSS_STUB_LEN;
                  const names = stub.targets.map((t) => t.name);
                  const title = `Hidden: ${names.slice(0, 12).join(", ")}${names.length > 12 ? ` and ${names.length - 12} more` : ""}. Click to show.`;
                  const reveal = (e: React.PointerEvent) => {
                    if (e.button !== 0 || spaceDown) return;
                    // Keep the world layer from starting a marquee or a pan.
                    e.stopPropagation();
                    revealTablesOnCanvas(stub.targets.map((t) => t.tableId));
                  };

                  return (
                    <g key={`${stub.tableId}:${stub.columnId}`} className={styles.crossStub} onPointerDown={reveal}>
                      <title>{title}</title>
                      <path d={`M${port.x},${port.y} H${endX}`} className={styles.crossStubLine} />
                      <circle cx={endX} cy={port.y} r={3} className={styles.crossStubEnd} />
                      {lod === "full" && (
                        <text
                          x={endX + side * 7}
                          y={port.y}
                          dy="0.35em"
                          textAnchor={side === 1 ? "start" : "end"}
                          className={styles.crossStubLabel}
                        >
                          {crossSchemaStubLabel(stub)}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            )}

            {/* Travelling dots on the lit lines. Kept out of the groups above:
                an `<animateMotion>` per relationship would run for every line on
                the canvas, lit or not, and SMIL doesn't stop when hidden. */}
            {canvasStyle.motion === "pulse" && !isExporting && (
              <LitPulses
                store={hoverStore}
                routed={routedRelationships}
                endColor={endColor}
                selectedTableIds={selectedTableIds}
                selectedRelationshipId={selectedRelationshipId}
              />
            )}

            {/* Areas */}
            {areas.map((area) => {
              let adjustedX = area.x;
              let adjustedY = area.y;
              if (dragOffset.active && dragArea.current.active && dragArea.current.initialPositions.has(area.id)) {
                  adjustedX += dragOffset.dx;
                  adjustedY += dragOffset.dy;
                  if (snapToGrid) {
                      adjustedX = Math.round(adjustedX / 24) * 24;
                      adjustedY = Math.round(adjustedY / 24) * 24;
                  }
              }

              if (adjustedX > vRight || adjustedY > vBottom || adjustedX < vLeft || adjustedY < vTop) return null;

              return (
              <g
                key={area.id}
                className="pointer-events-auto cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => onAreaPointerDown(e, area.id)}
                transform={`translate(${adjustedX}, ${adjustedY})`}
              >
                <AreaNode
                  area={area}
                  selected={selectedAreaIds.includes(area.id)}
                  readOnly={readOnly}
                />
              </g>
            )})}

            {/* Notes */}
            {notes.map((note) => {
              let adjustedX = note.x;
              let adjustedY = note.y;
              if (dragOffset.active) {
                if (dragNote.current.active && dragNote.current.initialPositions.has(note.id)) {
                    adjustedX += dragOffset.dx;
                    adjustedY += dragOffset.dy;
                } else if (dragArea.current.active && dragArea.current.childNotes.includes(note.id)) {
                    adjustedX += dragOffset.dx;
                    adjustedY += dragOffset.dy;
                }
                if (snapToGrid && (dragNote.current.initialPositions.has(note.id) || dragArea.current.childNotes.includes(note.id))) {
                    adjustedX = Math.round(adjustedX / 24) * 24;
                    adjustedY = Math.round(adjustedY / 24) * 24;
                }
              }

              if (adjustedX > vRight || adjustedY > vBottom || adjustedX < vLeft || adjustedY < vTop) return null;

              return (
              <g
                key={note.id}
                className="pointer-events-auto cursor-pointer"
                onPointerDown={(e) => onNotePointerDown(e, note.id)}
                transform={`translate(${adjustedX}, ${adjustedY})`}
              >
                <NoteNode
                  note={note}
                  selected={selectedNoteIds.includes(note.id)}
                  readOnly={readOnly}
                />
              </g>
            )})}

            {/* Tables */}
            {visibleTables.map((table) => {
              let adjustedX = table.x;
              let adjustedY = table.y;
              if (dragOffset.active) {
                if (dragTable.current.active && dragTable.current.initialPositions.has(table.id)) {
                    adjustedX += dragOffset.dx;
                    adjustedY += dragOffset.dy;
                } else if (dragArea.current.active && dragArea.current.childTables.includes(table.id)) {
                    adjustedX += dragOffset.dx;
                    adjustedY += dragOffset.dy;
                }
                if (snapToGrid && (dragTable.current.initialPositions.has(table.id) || dragArea.current.childTables.includes(table.id))) {
                    adjustedX = Math.round(adjustedX / 24) * 24;
                    adjustedY = Math.round(adjustedY / 24) * 24;
                }
              }

              // Test the card's whole box, not just its origin — a tall table
              // scrolled half off the top still has rows on screen.
              if (
                adjustedX > vRight ||
                adjustedY > vBottom ||
                adjustedX + geo.width < vLeft ||
                adjustedY + tableHeight(geo, table.columns.length) < vTop
              ) return null;

              countRender("table DRAWN"); // TEMP diagnostics

              return (
              <g
                key={table.id}
                className="pointer-events-auto cursor-pointer"
                onPointerDown={(e) => onTablePointerDown(e, table.id)}
                transform={`translate(${adjustedX}, ${adjustedY})`}
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <TableNode
                  table={table}
                  selected={selectedTableIds.includes(table.id)}
                  readOnly={readOnly}
                  hidePorts={isExporting}
                  canvasStyle={canvasStyle}
                  connectedPorts={portsByTable.get(table.id)?.join(";")}
                  foreignKeys={foreignKeysByTable.get(table.id)?.join(";")}
                  dropColumnId={dc.active && dc.dropTableId === table.id ? dc.dropColumnId ?? undefined : undefined}
                  sourcePort={
                    dc.active && dc.sourceTableId === table.id
                      ? `${dc.sourceColumnId}|${dc.sourceSide === 1 ? "r" : "l"}`
                      : undefined
                  }
                  lod={lod}
                  onColumnPointerDown={handleColumnPointerDown}
                  onHoverChange={handleTableHover}
                />
              </g>
            )})}

            {/* Pending Connection — snaps to the row under the pointer */}
            {dc.active && (() => {
              const from: PortPoint = { x: dc.startX, y: dc.startY, d: dc.sourceSide };
              let to: PortPoint | null = null;
              if (dc.dropTableId && dc.dropColumnId) {
                const live = getLiveTablePosition(dc.dropTableId);
                const side: Side = live && from.x < live.x + geo.width / 2 ? -1 : 1;
                to = getColumnPosition(dc.dropTableId, dc.dropColumnId, side);
              }
              const snapped = !!to;
              const target: PortPoint = to ?? { x: dc.currentX, y: dc.currentY, d: dc.currentX >= from.x ? -1 : 1 };
              return (
                <g pointerEvents="none">
                  <path
                    d={routeRelationship(canvasStyle.routing, from, target).d}
                    stroke="var(--primary)"
                    strokeWidth={1.8}
                    fill="none"
                    className={styles.pending}
                  />
                  {!snapped && <circle cx={target.x} cy={target.y} r={3.5} fill="var(--primary)" />}
                </g>
              );
            })()}

            {/* Hovered relationship label — drawn above the tables. Its own
                subscriber, so showing it re-renders a label and nothing else. */}
            {!isExporting && <HoveredRelationshipLabel store={hoverStore} routed={routedRelationships} />}

            {/* Marquee Selection Rectangle */}
            {selectionRect && (
              <rect
                x={selectionRect.x}
                y={selectionRect.y}
                width={selectionRect.w}
                height={selectionRect.h}
                fill="rgba(59, 130, 246, 0.1)" // blue-500 with opacity
                stroke="rgba(59, 130, 246, 0.5)"
                strokeWidth={1}
                pointerEvents="none"
              />
            )}
          </g>
        </svg>
      </div>

      {/* Keyboard shortcuts / controls help */}
      <CanvasShortcutsHelp className="absolute bottom-4 left-4 z-20" />

      {/* Floating bottom toolbar */}
      <CanvasFloatingToolbar readOnly={readOnly} />

      {/* Minimap overlay */}
      <Minimap
        className="absolute bottom-4 right-4"
        viewport={viewport}
        camera={camera}
        tables={minimapTables}
        notes={notes}
        areas={areas}
        onRecenter={(worldX, worldY) => {
          // Drop any pan still buffered in the ref — the jump replaces it,
          // and committing it afterwards would drag the camera back off-target.
          pan.current.dx = 0;
          pan.current.dy = 0;

          const targetScreenX = viewport.w / 2;
          const targetScreenY = viewport.h / 2;

          const nextX = targetScreenX - worldX * camera.zoom;
          const nextY = targetScreenY - worldY * camera.zoom;

          // ✅ go through store action so clamping is applied
          setCameraXY(nextX, nextY);
        }}
      />
    </div>
  );
}
