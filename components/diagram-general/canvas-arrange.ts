import { tableHeight } from "@/components/diagram-sections/canvas/canvas-style";
import { autoArrange, type ArrangeMode, type TableMove } from "@/lib/auto-arrange";
import { useCanvasStore } from "@/store/useCanvasStore";
import { getTableGeometry } from "@/store/useCanvasStyleStore";

/**
 * Store glue for `lib/auto-arrange.ts`.
 *
 * The layout module is deliberately store-free so it can be unit tested under
 * vitest's `node` environment; this is the half that reads live canvas state
 * and resolves table sizes from the active canvas style, the same way
 * `fitDiagramOnCanvas` and `lib/ai/placement.ts` do.
 */

/** Runs the layout against current canvas state. Applies nothing. */
export function arrangeMoves(mode: ArrangeMode): TableMove[] {
  const { tables, relationships } = useCanvasStore.getState();
  const geo = getTableGeometry();

  return autoArrange({
    tables,
    relationships,
    mode,
    measure: (table) => ({
      width: geo.width,
      height: tableHeight(geo, table.columns.length),
    }),
  });
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
