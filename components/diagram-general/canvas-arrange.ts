import { tableHeight } from "@/components/diagram-sections/canvas/canvas-style";
import { arrangeLayout, type ArrangeMode, type TableMove } from "@/lib/auto-arrange";
import { schemaAreasAfterArrange } from "@/lib/schema-areas";
import { useCanvasStore, type Area } from "@/store/useCanvasStore";
import { getTableGeometry } from "@/store/useCanvasStyleStore";

/**
 * Store glue for `lib/auto-arrange.ts`.
 *
 * The layout module is deliberately store-free so it can be unit tested under
 * vitest's `node` environment; this is the half that reads live canvas state
 * and resolves table sizes from the active canvas style, the same way
 * `fitDiagramOnCanvas` and `lib/ai/placement.ts` do.
 */

/**
 * Runs the layout against current canvas state. Applies nothing.
 *
 * Returns the table moves and the areas as they should be afterwards: one per
 * schema for an arrange by schema (see lib/schema-areas.ts), and without the
 * old per-schema areas for any other arrange, since they would frame the wrong
 * tables.
 */
export function arrangeMoves(mode: ArrangeMode): { moves: TableMove[]; areas: Area[] } {
  const { tables, relationships, areas } = useCanvasStore.getState();
  const geo = getTableGeometry();

  const { moves, schemaBlocks } = arrangeLayout({
    tables,
    relationships,
    mode,
    measure: (table) => ({
      width: geo.width,
      height: tableHeight(geo, table.columns.length),
    }),
  });

  return { moves, areas: moves.length > 0 ? schemaAreasAfterArrange(schemaBlocks, areas) : areas };
}

/**
 * Current positions of every table, for the toolbar's one-step undo.
 *
 * The canvas has no undo stack (nothing in `useCanvasStore` keeps history), and
 * the History dialog only covers cloud diagrams, so an arrange over 400 tables
 * would otherwise be unrecoverable for a local diagram.
 */
export function positionSnapshot(): TableMove[] {
  return useCanvasStore.getState().tables.map((t) => ({ id: t.id, x: t.x, y: t.y }));
}

/** How many tables an arrange would move, for the confirm dialog's copy. */
export function movableTableCount(): number {
  return useCanvasStore.getState().tables.filter((t) => !t.isLocked).length;
}
