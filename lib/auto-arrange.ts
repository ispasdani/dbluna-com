import dagre from "@dagrejs/dagre";

import { groupTablesBySchema } from "@/lib/schema-namespace";
import type { Relationship, Table } from "@/store/useCanvasStore";

/**
 * Canvas-wide auto-arrange.
 *
 * Three placement strategies exist in this codebase and none of them can be
 * re-run once tables are on the canvas: the import dialog lays new tables out
 * with dagre (`layoutTables` in import-schema-dialog.tsx), the Code tab stacks
 * them on a 40px diagonal (`parsedTablesToCanvasTables` in dsl-parser.ts) and
 * the AI drops single tables into the nearest free slot (lib/ai/placement.ts).
 * This module is the one that runs *after the fact*, over everything already
 * placed, and it is what the canvas toolbar's Auto arrange button calls.
 *
 * Deliberately store-free — it imports `Table`/`Relationship` as types only and
 * takes table sizes through `measure`. The caller resolves those from the
 * active canvas style (see `arrangeMoves` in canvas-arrange.ts), which keeps
 * this file testable under vitest's `node` environment where importing the
 * zustand persist stores would touch IndexedDB.
 */

export type ArrangeMode = "relationships" | "schema";

/** A position update, shaped for `useCanvasStore.moveTables`. */
export interface TableMove {
  id: string;
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface ArrangeOptions {
  tables: Table[];
  relationships: Relationship[];
  mode: ArrangeMode;
  /** Rendered size of a table, from the active canvas style. */
  measure: (table: Table) => Size;
}

// Dagre spacing. `ranksep` is the gap *between* ranks — horizontal under
// rankdir LR — so it carries the relationship edges and needs the most room;
// `nodesep` separates siblings within a rank (vertical here). Both are tighter
// than the import dialog's 220/80 because that runs on a fresh canvas where
// sprawl costs nothing, whereas this one routinely runs over 400+ tables.
const RANK_SEP = 180;
const NODE_SEP = 50;

/** Gap between schema blocks, and between rows of them. */
const GROUP_GAP = 160;

/**
 * Empty strip reserved above every schema block. Nothing draws in it yet — it
 * is where a per-schema Area header would sit, and it doubles as the visual
 * separation that makes the blocks read as groups rather than one field of
 * tables.
 */
const GROUP_HEADER = 56;

/** Gap between isolated tables in the trailing grid. */
const ISOLATED_GAP = 60;

/** Minimum columns in the isolated-table grid, so a handful don't form a line. */
const MIN_ISOLATED_COLUMNS = 6;

/** Roughly 16:10 — the shape the packed schema blocks are steered towards. */
const TARGET_ASPECT = 1.6;

interface Placed {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Block {
  placed: Placed[];
  width: number;
  height: number;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const EMPTY_BLOCK: Block = { placed: [], width: 0, height: 0 };

/**
 * Lays one set of tables out into a block whose top-left is the origin.
 *
 * Tables with at least one relationship to another table *in the same set* go
 * through dagre left-to-right, so a chain of foreign keys reads as a chain.
 * Everything else is packed into a wrapped grid underneath: dagre files
 * disconnected nodes into a single rank, which at this scale produces a column
 * hundreds of thousands of pixels tall.
 *
 * Self-referencing relationships are skipped — they connect a table to itself
 * and would otherwise mark it "connected" while contributing no structure.
 */
function layoutBlock(
  tables: Table[],
  relationships: Relationship[],
  measure: (table: Table) => Size
): Block {
  if (tables.length === 0) return EMPTY_BLOCK;

  const ids = new Set(tables.map((t) => t.id));
  const edges = relationships.filter(
    (r) =>
      r.sourceTableId !== r.targetTableId &&
      ids.has(r.sourceTableId) &&
      ids.has(r.targetTableId)
  );

  const connectedIds = new Set<string>();
  for (const edge of edges) {
    connectedIds.add(edge.sourceTableId);
    connectedIds.add(edge.targetTableId);
  }

  // Sorted so the same diagram arranges the same way every time: dagre's output
  // depends on node insertion order, and `tables` arrives in whatever order the
  // parser or the user's edits left it in.
  const ordered = [...tables].sort((a, b) => a.name.localeCompare(b.name));
  const connected = ordered.filter((t) => connectedIds.has(t.id));
  const isolated = ordered.filter((t) => !connectedIds.has(t.id));

  const placed: Placed[] = [];

  if (connected.length > 0) {
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: "LR", ranksep: RANK_SEP, nodesep: NODE_SEP });
    g.setDefaultEdgeLabel(() => ({}));

    for (const table of connected) {
      g.setNode(table.id, measure(table));
    }
    for (const edge of edges) {
      g.setEdge(edge.sourceTableId, edge.targetTableId);
    }

    dagre.layout(g);

    for (const table of connected) {
      // dagre reports node centres; the canvas stores top-left corners.
      const node = g.node(table.id);
      placed.push({
        id: table.id,
        x: node.x - node.width / 2,
        y: node.y - node.height / 2,
        width: node.width,
        height: node.height,
      });
    }
  }

  const connectedBounds = boundsOf(placed);

  if (isolated.length > 0) {
    // Isolated tables wrap at the width the connected block already occupies,
    // so the two halves line up instead of the grid jutting out sideways.
    const widest = Math.max(...isolated.map((t) => measure(t).width));
    const rowWidth = Math.max(
      connectedBounds.width,
      MIN_ISOLATED_COLUMNS * (widest + ISOLATED_GAP)
    );

    let x = connectedBounds.x;
    let y = placed.length > 0 ? connectedBounds.y + connectedBounds.height + RANK_SEP : 0;
    let rowHeight = 0;

    for (const table of isolated) {
      const { width, height } = measure(table);
      if (x > connectedBounds.x && x + width > connectedBounds.x + rowWidth) {
        x = connectedBounds.x;
        y += rowHeight + ISOLATED_GAP;
        rowHeight = 0;
      }
      placed.push({ id: table.id, x, y, width, height });
      x += width + ISOLATED_GAP;
      rowHeight = Math.max(rowHeight, height);
    }
  }

  // dagre lays out from its own origin and the isolated grid hangs off that, so
  // normalise the whole block to (0, 0) before the caller positions it.
  const bounds = boundsOf(placed);
  for (const p of placed) {
    p.x -= bounds.x;
    p.y -= bounds.y;
  }

  return { placed, width: bounds.width, height: bounds.height };
}

function boundsOf(placed: Placed[]): Rect {
  if (placed.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of placed) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + p.width);
    maxY = Math.max(maxY, p.y + p.height);
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Lays each schema out independently, then shelf-packs the resulting blocks
 * left-to-right, wrapping onto a new row once the target width is reached.
 *
 * The packing pass is the whole point. ChartDB's equivalent (`perSchema` mode
 * in its `adjustTablePositionsWithoutAreas`) restarts every schema at the same
 * origin with a per-schema overlap map, so its schema blocks land on top of one
 * another; laying each group out is only half the job.
 *
 * Group order comes from `groupTablesBySchema` — named schemas alphabetically,
 * unqualified tables last — matching the Schemas tab and Docs sidebar, so the
 * canvas reads in the same order as the panels beside it.
 */
function layoutBySchema(
  tables: Table[],
  relationships: Relationship[],
  measure: (table: Table) => Size
): Placed[] {
  const blocks = groupTablesBySchema(tables)
    .map((group) => layoutBlock(group.tables, relationships, measure))
    .filter((block) => block.placed.length > 0);

  if (blocks.length === 0) return [];

  // Steer the packed result towards a readable aspect rather than one very long
  // row: the area the blocks need, reshaped to TARGET_ASPECT, but never
  // narrower than the widest single block (which cannot be split).
  const totalArea = blocks.reduce(
    (sum, b) => sum + (b.width + GROUP_GAP) * (b.height + GROUP_HEADER + GROUP_GAP),
    0
  );
  const widest = Math.max(...blocks.map((b) => b.width));
  const targetWidth = Math.max(widest, Math.sqrt(totalArea * TARGET_ASPECT));

  const result: Placed[] = [];
  let x = 0;
  let y = 0;
  let rowHeight = 0;

  for (const block of blocks) {
    if (x > 0 && x + block.width > targetWidth) {
      x = 0;
      y += rowHeight + GROUP_GAP;
      rowHeight = 0;
    }

    for (const p of block.placed) {
      result.push({ ...p, x: p.x + x, y: p.y + y + GROUP_HEADER });
    }

    x += block.width + GROUP_GAP;
    rowHeight = Math.max(rowHeight, block.height + GROUP_HEADER);
  }

  return result;
}

/**
 * Arranges every unlocked table and returns the moves to apply.
 *
 * Locked tables are never moved and never overlapped: the arranged block is
 * offset to start below them. drawDB's auto-arrange drops locked tables from
 * the graph and lets the result land on top of them, which quietly buries the
 * one table the user cared enough about to pin.
 *
 * The result is anchored at the current diagram's top-left so an arrange keeps
 * the diagram roughly where it was on the canvas instead of teleporting it to
 * the origin.
 */
export function autoArrange({
  tables,
  relationships,
  mode,
  measure,
}: ArrangeOptions): TableMove[] {
  const movable = tables.filter((t) => !t.isLocked);
  if (movable.length === 0) return [];

  const placed =
    mode === "schema"
      ? layoutBySchema(movable, relationships, measure)
      : layoutBlock(movable, relationships, measure).placed;

  if (placed.length === 0) return [];

  // Anchor on where the diagram already is, so the camera doesn't have to jump
  // across the canvas to find it afterwards.
  const current = boundsOf(
    tables.map((t) => ({ id: t.id, x: t.x, y: t.y, ...measure(t) }))
  );
  let originX = current.x;
  let originY = current.y;

  const locked = tables.filter((t) => t.isLocked);
  if (locked.length > 0) {
    const lockedBounds = boundsOf(
      locked.map((t) => ({ id: t.id, x: t.x, y: t.y, ...measure(t) }))
    );
    originX = lockedBounds.x;
    originY = lockedBounds.y + lockedBounds.height + GROUP_GAP;
  }

  return placed.map((p) => ({
    id: p.id,
    x: Math.round(originX + p.x),
    y: Math.round(originY + p.y),
  }));
}
