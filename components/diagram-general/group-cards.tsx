"use client";

import { useState, type CSSProperties } from "react";
import { ChevronDown, Eye, EyeOff, Focus } from "lucide-react";

import { splitSchemaName } from "@/lib/schema-namespace";
import { cn } from "@/lib/utils";
import type { Table } from "@/store/useCanvasStore";
import { SchemaGlyph } from "./panel-glyphs";
import type { useSchemaVisibility } from "./use-schema-visibility";
import styles from "./schemas-panel.module.scss";

const ACCENT = { "--tc": "var(--primary)" } as CSSProperties;
const PREVIEW_TABLES = 5;

const onKey = (e: React.KeyboardEvent, fn: () => void) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fn();
  }
};

/**
 * The Schemas tab's list when grouping by DBML TableGroups or FK clusters:
 * the same cards and visibility controls as schemas, without the management
 * (add, rename, move) — TableGroups are authored in the Code tab, and clusters
 * are computed, so there is nothing here to edit.
 */
export function GroupCards({
  visibility,
  tableById,
  onShowTable,
}: {
  visibility: ReturnType<typeof useSchemaVisibility>;
  tableById: ReadonlyMap<string, Table>;
  onShowTable: (tableId: string) => void;
}) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const tint = (t: Table) => ({ "--tc": t.color }) as CSSProperties;

  return (
    <>
      {visibility.entries.map((entry) => {
        const isOpen = expandedKey === entry.key;
        const toggle = () => setExpandedKey(isOpen ? null : entry.key);
        const stop = (e: React.SyntheticEvent) => e.stopPropagation();
        const tables = entry.tableIds.map((id) => tableById.get(id)).filter((t): t is Table => t !== undefined);

        return (
          <div
            key={entry.key}
            className={cn(
              styles.tb,
              styles.card,
              !isOpen && styles.closed,
              isOpen && styles.cardOpen,
              entry.isHidden && styles.cardHidden
            )}
            style={ACCENT}
          >
            <div
              className={styles.tbHead}
              role="button"
              tabIndex={0}
              aria-expanded={isOpen}
              onClick={toggle}
              onKeyDown={(e) => onKey(e, toggle)}
            >
              <span className={styles.chev}>
                <ChevronDown className="w-3 h-3" />
              </span>
              <span className={styles.mk}>
                <SchemaGlyph />
              </span>
              <span className={cn(styles.tname, entry.isRemainder && styles.untitled)} title={entry.label}>
                {entry.label}
              </span>
              <span className={styles.meta}>
                {entry.tableCount} table{entry.tableCount === 1 ? "" : "s"}
              </span>
              <span className={styles.headActions} onClick={stop} onKeyDown={stop}>
                {visibility.total > 1 && (
                  <button
                    type="button"
                    className={styles.headBtn}
                    title={`Show only this ${visibility.info.noun} on the canvas`}
                    aria-label={`Show only ${entry.label}`}
                    onClick={() => visibility.showOnly(entry.key)}
                  >
                    <Focus className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  className={styles.headBtn}
                  title={entry.isHidden ? "Show on the canvas" : "Hide from the canvas"}
                  aria-label={`${entry.isHidden ? "Show" : "Hide"} ${entry.label}`}
                  aria-pressed={entry.isHidden}
                  onClick={() => visibility.toggle(entry.key)}
                >
                  {entry.isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </span>
            </div>

            {!isOpen && tables.length > 0 && (
              <div className={styles.closedBody} onClick={toggle}>
                <div className={styles.tableChips}>
                  {tables.slice(0, PREVIEW_TABLES).map((t) => (
                    <span key={t.id} className={styles.chip} style={tint(t)} title={t.name}>
                      <i />
                      <span className={styles.tname}>{t.name}</span>
                    </span>
                  ))}
                  {tables.length > PREVIEW_TABLES && (
                    <span className={styles.more}>+{tables.length - PREVIEW_TABLES}</span>
                  )}
                </div>
              </div>
            )}

            {isOpen && (
              <div className={styles.tbBody}>
                {tables.map((t) => {
                  const { schema, table } = splitSchemaName(t.name);
                  return (
                    <div key={t.id} className={cn(styles.row, styles.tableRow)} style={tint(t)}>
                      <i />
                      <button
                        type="button"
                        className={styles.tableLink}
                        title={`Open ${t.name} in the Tables tab`}
                        onClick={() => onShowTable(t.id)}
                      >
                        {table}
                      </button>
                      {schema && <span className={styles.rowSchema}>{schema}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
