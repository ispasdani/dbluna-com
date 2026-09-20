"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { Eye, Moon, Square, StickyNote, Sun, Table } from "lucide-react";
import { useCanvasStore } from "@/store/useCanvasStore";
import { usePlatformPalette } from "@/themeProviders/platformPaletteProvider";
import { ArrangeMenu } from "./arrange-menu";
import { ZoomMenu } from "./zoom-menu";
import { useCapabilities } from "./capabilities-context";
import styles from "./canvas-floating-toolbar.module.scss";

interface CanvasFloatingToolbarProps {
  readOnly?: boolean;
}

const ADD_ITEMS = [
  { id: "table", label: "Table", title: "Add a table", icon: Table, color: "#6366f1" },
  { id: "note", label: "Note", title: "Add a note", icon: StickyNote, color: "#f59e0b" },
  { id: "area", label: "Area", title: "Add an area", icon: Square, color: "#8b5cf6" },
] as const;

/** Light / dark as two icons; renders nothing until the palette is known. */
function ThemeSwitch() {
  const { palette, setPalette, mounted } = usePlatformPalette();
  if (!mounted) return null;

  return (
    <span className={styles.theme} role="group" aria-label="Theme">
      <button type="button" aria-pressed={palette === "default"} onClick={() => setPalette("default")} title="Light">
        <Sun className="size-3.5" />
        <span className="sr-only">Light</span>
      </button>
      <button type="button" aria-pressed={palette === "dark"} onClick={() => setPalette("dark")} title="Dark">
        <Moon className="size-3.5" />
        <span className="sr-only">Dark</span>
      </button>
    </span>
  );
}

export function CanvasFloatingToolbar({ readOnly = false }: CanvasFloatingToolbarProps) {
  const addTable = useCanvasStore((s) => s.addTable);
  const addNote = useCanvasStore((s) => s.addNote);
  const addArea = useCanvasStore((s) => s.addArea);
  const actions = { table: addTable, note: addNote, area: addArea };
  // Read-only is either the Free plan or the anonymous share-link viewer
  // (/d/view, which has no plan and gets the fully-capable default). Only the
  // first can upgrade.
  const { isPro } = useCapabilities();

  return (
    <div className={styles.bar}>
      {readOnly ? (
        <span className={styles.viewOnly}>
          <Eye className="size-3.5" />
          <b>View-only</b>
          {!isPro && (
            <>
              on Free ·<Link href="/pricing">Upgrade to edit</Link>
            </>
          )}
        </span>
      ) : (
        <>
          {ADD_ITEMS.map(({ id, label, title, icon: Icon, color }) => (
            <button
              key={id}
              type="button"
              className={styles.add}
              style={{ "--tc": color } as CSSProperties}
              onClick={actions[id]}
              title={title}
            >
              <Icon className="size-4" />
              <span>{label}</span>
            </button>
          ))}
          <ArrangeMenu />
        </>
      )}

      <span className={styles.sep} />
      <ZoomMenu />
      <span className={styles.sep} />
      <ThemeSwitch />
    </div>
  );
}
