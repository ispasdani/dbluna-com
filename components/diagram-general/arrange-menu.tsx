"use client";

import { useState, type CSSProperties } from "react";
import { DropdownMenu as Menu } from "radix-ui";
import { Layers, LayoutGrid, Loader2, Undo2, Workflow } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { ArrangeMode, TableMove } from "@/lib/auto-arrange";
import { useCanvasStore } from "@/store/useCanvasStore";

import { arrangeMoves, movableTableCount, positionSnapshot } from "./canvas-arrange";
import { fitDiagramOnCanvas } from "./use-diagram-issues";
import menu from "./toolbar-menus.module.scss";
import styles from "./canvas-floating-toolbar.module.scss";

const MODES: { id: ArrangeMode; label: string; hint: string; icon: typeof Workflow }[] = [
  {
    id: "schema",
    label: "By schema",
    hint: "One block per schema prefix",
    icon: Layers,
  },
  {
    id: "relationships",
    label: "By relationships",
    hint: "Follow foreign keys left to right",
    icon: Workflow,
  },
];

const MODE_LABEL: Record<ArrangeMode, string> = {
  schema: "by schema",
  relationships: "by relationships",
};

/**
 * Canvas-wide Auto arrange, in the floating toolbar next to the zoom stepper.
 *
 * Gated behind a confirm dialog, the way ChartDB and DBeaver gate theirs: it
 * rewrites every unlocked table's position at once and there is no undo stack
 * in `useCanvasStore` to fall back on — so this keeps its own one-step undo of
 * the positions it replaced.
 */
export function ArrangeMenu() {
  const moveTables = useCanvasStore((s) => s.moveTables);
  const tableCount = useCanvasStore((s) => s.tables.length);

  const [pendingMode, setPendingMode] = useState<ArrangeMode | null>(null);
  const [isArranging, setIsArranging] = useState(false);
  const [undoMoves, setUndoMoves] = useState<TableMove[] | null>(null);

  const movable = pendingMode ? movableTableCount() : 0;
  const lockedCount = pendingMode ? tableCount - movable : 0;

  const runArrange = (mode: ArrangeMode) => {
    setPendingMode(null);
    setIsArranging(true);

    // dagre over a few hundred nodes blocks for long enough to be visible, so
    // yield a frame first: the dialog gets to close and the spinner to paint
    // before the main thread is taken.
    requestAnimationFrame(() => {
      try {
        const before = positionSnapshot();
        const moves = arrangeMoves(mode);
        if (moves.length > 0) {
          moveTables(moves);
          setUndoMoves(before);
          fitDiagramOnCanvas();
        }
      } finally {
        setIsArranging(false);
      }
    });
  };

  const runUndo = () => {
    if (!undoMoves) return;
    // Tables deleted since the arrange have nothing to restore.
    const live = new Set(useCanvasStore.getState().tables.map((t) => t.id));
    moveTables(undoMoves.filter((m) => live.has(m.id)));
    setUndoMoves(null);
    fitDiagramOnCanvas();
  };

  // Nothing to arrange on an empty canvas; the separator goes with the button
  // so the toolbar doesn't keep a dangling divider.
  if (tableCount === 0) return null;

  return (
    <>
      <span className={styles.sep} />

      <Menu.Root>
        <Menu.Trigger asChild>
          <button
            type="button"
            className={styles.add}
            style={{ "--tc": "#0ea5e9" } as CSSProperties}
            title="Auto arrange the diagram"
            disabled={isArranging}
          >
            {isArranging ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <LayoutGrid className="size-4" />
            )}
            <span>Arrange</span>
          </button>
        </Menu.Trigger>

        <Menu.Portal>
          <Menu.Content
            side="top"
            align="center"
            sideOffset={10}
            className={cn(menu.menu, styles.arrangeMenu)}
          >
            <Menu.Label className={menu.group}>Auto arrange</Menu.Label>
            {MODES.map(({ id, label, hint, icon: Icon }) => (
              <Menu.Item key={id} className={menu.item} onSelect={() => setPendingMode(id)}>
                <span className={menu.icon}>
                  <Icon className="size-4" />
                </span>
                <span className={menu.text}>
                  {label}
                  <small>{hint}</small>
                </span>
              </Menu.Item>
            ))}

            {undoMoves && (
              <>
                <Menu.Separator className={menu.sep} />
                <Menu.Item className={menu.item} onSelect={runUndo}>
                  <span className={menu.icon}>
                    <Undo2 className="size-4" />
                  </span>
                  <span className={menu.text}>
                    Undo arrange
                    <small>Put every table back where it was</small>
                  </span>
                </Menu.Item>
              </>
            )}
          </Menu.Content>
        </Menu.Portal>
      </Menu.Root>

      <AlertDialog open={pendingMode !== null} onOpenChange={(open) => !open && setPendingMode(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Arrange {movable} table{movable === 1 ? "" : "s"} {MODE_LABEL[pendingMode ?? "schema"]}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Every unlocked table moves to a new position.
              {lockedCount > 0 && ` ${lockedCount} locked table${lockedCount === 1 ? " stays" : "s stay"} put.`}{" "}
              You can put them back with Undo arrange, until you reload the page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingMode && runArrange(pendingMode)}>
              Arrange
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
