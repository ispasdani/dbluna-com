"use client";

import { useState, type CSSProperties } from "react";
import { DropdownMenu as Menu } from "radix-ui";
import { Layers } from "lucide-react";

import { cn } from "@/lib/utils";
import { SchemaGlyph } from "./panel-glyphs";
import { useSchemaVisibility } from "./use-schema-visibility";
import menu from "./toolbar-menus.module.scss";
import styles from "./canvas-floating-toolbar.module.scss";

/**
 * Which schemas are on the canvas, switchable from the floating toolbar.
 *
 * The Schemas tab manages schemas; this switches them while navigating, without
 * opening the dock. Both read the same state through `useSchemaVisibility`.
 * Hidden when there is nothing to switch — no schemas, or just one, as on a
 * MySQL import where the database is the schema.
 *
 * Available read-only too: visibility is a view of the diagram in this browser,
 * not an edit, so it never needs write access.
 */
export function SchemasMenu() {
  const visibility = useSchemaVisibility();
  const { entries, total, shownCount, hiddenCount } = visibility;
  // Controlled only so "Only" can close the menu: it stops its click from
  // reaching the item underneath, which also stops Radix closing it.
  const [open, setOpen] = useState(false);

  if (total < 2) return null;

  return (
    <>
      <span className={styles.sep} />

      <Menu.Root open={open} onOpenChange={setOpen}>
        <Menu.Trigger asChild>
          <button
            type="button"
            className={cn(styles.add, hiddenCount > 0 && styles.filtered)}
            style={{ "--tc": "#14b8a6" } as CSSProperties}
            title="Choose which schemas the canvas shows"
          >
            <Layers className="size-4" />
            <span>Schemas</span>
            <span className={styles.schemaCount}>
              {shownCount}/{total}
            </span>
          </button>
        </Menu.Trigger>

        <Menu.Portal>
          <Menu.Content side="top" align="center" sideOffset={10} className={cn(menu.menu, styles.schemasMenu)}>
            <div className={styles.schemasHead}>
              <Menu.Label className={menu.group}>Show on the canvas</Menu.Label>
              <button type="button" disabled={hiddenCount === 0} onClick={visibility.showAll}>
                Show all
              </button>
              <button type="button" disabled={shownCount === 0} onClick={visibility.hideAll}>
                Hide all
              </button>
            </div>

            <div className={styles.schemasList}>
              {entries.map((entry) => (
                <Menu.CheckboxItem
                  key={entry.key}
                  className={menu.item}
                  checked={!entry.isHidden}
                  onCheckedChange={() => visibility.toggle(entry.key)}
                  // Stay open: switching several schemas is the common case.
                  onSelect={(e) => e.preventDefault()}
                >
                  <span className={menu.icon}>
                    <SchemaGlyph />
                  </span>
                  <span className={menu.text}>
                    <span className={cn(entry.schema === null && styles.unqualified)}>{entry.label}</span>
                    <small>
                      {entry.tableCount} table{entry.tableCount === 1 ? "" : "s"}
                    </small>
                  </span>
                  {/* A button inside a menu item: stopping the click keeps the
                      item from toggling underneath it. Closes the menu so the
                      canvas can be seen fitting to the schema. */}
                  <button
                    type="button"
                    className={styles.onlyBtn}
                    title={`Show only ${entry.label}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(false);
                      visibility.showOnly(entry.key);
                    }}
                  >
                    Only
                  </button>
                  <span className={menu.switch} aria-hidden />
                </Menu.CheckboxItem>
              ))}
            </div>

            <Menu.Separator className={menu.sep} />
            <p className={menu.foot}>
              {hiddenCount === 0 ? `All ${total} schemas shown` : `${shownCount} of ${total} shown`}. Only this
              browser sees the change.
            </p>
          </Menu.Content>
        </Menu.Portal>
      </Menu.Root>
    </>
  );
}
