import type { Relationship } from "@/store/useCanvasStore";
import type { HoverDim } from "./canvas-style";

/**
 * Hover highlighting, kept out of React.
 *
 * Pointing at a table lights up every relationship that touches it, dims the
 * rest, and tints the rows at both ends. That is a graph query, not something
 * CSS can answer on its own — but it used to live in `useState` on the stage,
 * so every mouse move across a card re-rendered all of it: every visible table
 * node, every relationship path, the routing maps. On a 400-table schema one
 * hover cost more than a whole pan gesture.
 *
 * Instead the hover lives in this tiny store, the *set* of lit ids is computed
 * here, and the result is written to the DOM as `data-` attributes that the
 * stylesheet reacts to. React renders the diagram; this decides what glows.
 */

export type HoveredTable = { tableId: string; colId: string | null } | null;

export interface HoverState {
  /** Table (and optionally row) under the pointer. */
  table: HoveredTable;
  /** Relationship line under the pointer. */
  relId: string | null;
}

const EMPTY: HoverState = { table: null, relId: null };

export interface HoverStore {
  get: () => HoverState;
  subscribe: (listener: () => void) => () => void;
  setTable: (tableId: string, colId: string | null | undefined) => void;
  setRelationship: (relId: string | null) => void;
  clear: () => void;
}

function same(a: HoverState, b: HoverState) {
  return (
    a.relId === b.relId &&
    a.table?.tableId === b.table?.tableId &&
    a.table?.colId === b.table?.colId &&
    !!a.table === !!b.table
  );
}

export function createHoverStore(): HoverStore {
  let state: HoverState = EMPTY;
  const listeners = new Set<() => void>();

  const commit = (next: HoverState) => {
    if (same(state, next)) return;
    state = next;
    for (const listener of listeners) listener();
  };

  return {
    get: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    // `undefined` = the pointer left this table; `null` = over the card but
    // not over a row. Matches the callback TableNode already speaks.
    setTable: (tableId, colId) => {
      if (colId === undefined) {
        if (state.table?.tableId === tableId) commit({ ...state, table: null });
        return;
      }
      commit({ ...state, table: { tableId, colId } });
    },
    setRelationship: (relId) => commit({ ...state, relId }),
    clear: () => commit(EMPTY),
  };
}

// ─── What the hover lights up ────────────────────────────────────────────────

/**
 * How many relationships may animate at once.
 *
 * Animating `stroke-dashoffset` cannot be composited: every frame repaints, and
 * because all relationships share one world-sized `<svg>`, that repaint
 * invalidates the whole canvas. On a 428-table schema a *single* animated line
 * took the canvas from 181fps to 59fps. Promoting the lit lines to their own
 * layers fixes the common case (3 lit lines: 57fps → 177fps) but degrades as
 * the layer count climbs (40 lit lines: 68fps), so past this many we stop
 * animating altogether rather than trade one stall for another.
 */
export const MAX_ANIMATED_LIT = 12;

/**
 * Past this many relationships, hovering stops dimming the others.
 *
 * The dim sets `opacity` on every line that is not lit — all ~190 of them on a
 * schema this size — and opacity on an SVG group is painted, not composited. So
 * each new hover costs a burst of repaints across the canvas: the flicker that
 * settles after a few hundred milliseconds and comes back on the next hover.
 * Measured at 189 lines, dropping the dim takes the worst frame of that burst
 * from 72ms to 5.7ms.
 *
 * A compositor layer per line would keep the effect *and* the frame rate, but
 * ~200 of them exhausts the compositor and the canvas renders blank — see the
 * `will-change` note in canvas.module.scss. So on a schema this big the dim is
 * the thing that gives. It reads as noise at that density anyway.
 */
export const MAX_DIMMED_RELS = 150;

/** The dim a diagram can actually afford, given how many lines it has. */
export function affordableDim(dim: HoverDim, relationshipCount: number): HoverDim {
  return relationshipCount > MAX_DIMMED_RELS ? "off" : dim;
}

export interface Highlight {
  /** Relationships drawn thick/animated — hovered, selected, or touching either. */
  litRels: Set<string>;
  /** Tables that keep full opacity while something else is hovered. */
  brightTables: Set<string>;
  /** `tableId|columnId` for every row at the end of a lit relationship. */
  linkedRows: Set<string>;
  /** True only while the *pointer* is over something — selection alone never dims. */
  hoverActive: boolean;
}

const EMPTY_HIGHLIGHT: Highlight = {
  litRels: new Set(),
  brightTables: new Set(),
  linkedRows: new Set(),
  hoverActive: false,
};

function touches(rel: Relationship, tableId: string, colId: string | null) {
  return (
    (rel.sourceTableId === tableId && (colId === null || rel.sourceColumnId === colId)) ||
    (rel.targetTableId === tableId && (colId === null || rel.targetColumnId === colId))
  );
}

export function computeHighlight(
  hover: HoverState,
  relationships: Relationship[],
  selectedTableIds: string[],
  selectedRelationshipId: string | null,
  isExporting: boolean
): Highlight {
  // An export is a still frame of the diagram, not of the pointer.
  if (isExporting) return EMPTY_HIGHLIGHT;

  const hoverActive = !!hover.table || !!hover.relId;
  const litRels = new Set<string>();
  const brightTables = new Set<string>();
  const linkedRows = new Set<string>();

  for (const rel of relationships) {
    const lit =
      rel.id === hover.relId ||
      rel.id === selectedRelationshipId ||
      (hover.table && touches(rel, hover.table.tableId, hover.table.colId)) ||
      selectedTableIds.some((id) => touches(rel, id, null));
    if (!lit) continue;

    litRels.add(rel.id);
    brightTables.add(rel.sourceTableId);
    brightTables.add(rel.targetTableId);
    linkedRows.add(`${rel.sourceTableId}|${rel.sourceColumnId}`);
    linkedRows.add(`${rel.targetTableId}|${rel.targetColumnId}`);
  }

  // The card under the pointer never fades, even with nothing connected to it.
  if (hover.table) brightTables.add(hover.table.tableId);

  return { litRels, brightTables, linkedRows, hoverActive };
}


// ─── Focus mode ──────────────────────────────────────────────────────────────

export interface Focus {
  /** Tables within two degrees of the selection; `null` = focus mode is off. */
  tables: Set<string> | null;
  /** Relationships within two degrees; `null` = focus mode is off. */
  rels: Set<string> | null;
}

export const NO_FOCUS: Focus = { tables: null, rels: null };

/**
 * Tables and relationships within two degrees of the selected table.
 *
 * Focus mode is on by default, so this runs on every selection. It used to live
 * in the stage as a `useMemo` whose result was threaded down as the `isDimmed`
 * prop on every table and an inline `opacity` on every line — which meant one
 * click re-rendered every visible card and every line that survived culling.
 * The sets are now stamped onto the DOM as `data-focus-out` instead, exactly
 * like the hover highlight above, so selecting a table costs no React render.
 *
 * The second-degree pass used `Array.prototype.includes` inside a loop over
 * every relationship — O(relationships x first-degree tables). Sets make it
 * linear, which matters on a hub table that touches a hundred others.
 */
export function computeFocus(
  relationships: Relationship[],
  selectedTableIds: string[],
  isFocusModeEnabled: boolean
): Focus {
  if (!isFocusModeEnabled || selectedTableIds.length !== 1) return NO_FOCUS;

  const selectedId = selectedTableIds[0];
  const tables = new Set<string>([selectedId]);
  const rels = new Set<string>();

  for (const rel of relationships) {
    if (rel.sourceTableId === selectedId) {
      tables.add(rel.targetTableId);
      rels.add(rel.id);
    } else if (rel.targetTableId === selectedId) {
      tables.add(rel.sourceTableId);
      rels.add(rel.id);
    }
  }

  const firstDegree = new Set(tables);
  for (const rel of relationships) {
    if (firstDegree.has(rel.sourceTableId) || firstDegree.has(rel.targetTableId)) {
      tables.add(rel.sourceTableId);
      tables.add(rel.targetTableId);
      rels.add(rel.id);
    }
  }

  return { tables, rels };
}

// ─── Writing it to the DOM ───────────────────────────────────────────────────

function toggle(el: Element, attr: string, on: boolean) {
  if (on) {
    if (!el.hasAttribute(attr)) el.setAttribute(attr, "");
  } else if (el.hasAttribute(attr)) {
    el.removeAttribute(attr);
  }
}

/**
 * Stamps a highlight onto the live canvas. Cheap enough to run on every pointer
 * move: a few hundred attribute reads over nodes the browser already has
 * indexed, versus a full React pass over every table and line.
 */
export function applyHighlight(
  svg: SVGSVGElement | null,
  h: Highlight,
  dim: HoverDim,
  focus: Focus = NO_FOCUS
) {
  if (!svg) return;

  toggle(svg, "data-canvas-hover", h.hoverActive);
  // Each lit line gets its own compositor layer (see canvas.module.scss) so its
  // dash animation stops repainting the world. Layers are not free, though, and
  // a hub table can light up a hundred lines at once — past this many, the
  // layers cost more than the motion is worth and the stylesheet drops it.
  toggle(svg, "data-lit-storm", h.litRels.size > MAX_ANIMATED_LIT);

  for (const g of svg.querySelectorAll<SVGGElement>("[data-rel-id]")) {
    const id = g.getAttribute("data-rel-id")!;
    toggle(g, "data-lit", h.litRels.has(id));
    toggle(g, "data-focus-out", focus.rels !== null && !focus.rels.has(id));
  }

  const fading = h.hoverActive && dim === "all";
  for (const g of svg.querySelectorAll<SVGGElement>("[data-table-card]")) {
    const id = g.getAttribute("data-table-card")!;
    toggle(g, "data-faded", fading && !h.brightTables.has(id));
    toggle(g, "data-focus-out", focus.tables !== null && !focus.tables.has(id));
  }

  for (const row of svg.querySelectorAll<SVGGElement>("[data-row]")) {
    const key = `${row.getAttribute("data-table-id")}|${row.getAttribute("data-col-id")}`;
    toggle(row, "data-linked", h.linkedRows.has(key));
  }
}
