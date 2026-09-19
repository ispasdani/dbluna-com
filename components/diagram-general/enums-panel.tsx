"use client";

import { Fragment, useMemo, useState, type CSSProperties } from "react";
import { ChevronDown, ChevronUp, ChevronsDownUp, ListOrdered, Plus, Search, Trash2 } from "lucide-react";

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
import { useCanvasStore, type CanvasEnum, type EnumValue } from "@/store/useCanvasStore";
import { useDockStore } from "@/store/useDockStore";
import { usePanelStyle } from "@/store/usePanelStyleStore";
import { buildEnumUsageIndex, tablesStructureSignature, type EnumUsageSite } from "@/lib/enum-usage";
import { splitSchemaName } from "@/lib/schema-namespace";
import { cn } from "@/lib/utils";
import { CommittedInput } from "./committed-input";
import { EnumGlyph } from "./panel-glyphs";
import styles from "./enums-panel.module.scss";

/** Enums have no canvas colour; they take the accent. */
const ENUM_TINT = { "--tc": "var(--primary)" } as CSSProperties;
/** Values listed on a closed card before the rest collapse into "+N". */
const PREVIEW_VALUES = 5;

/** Unique-ifies a proposed name against the existing ones. */
function uniqueName(base: string, taken: string[]): string {
  const lower = new Set(taken.map((n) => n.toLowerCase()));
  if (!lower.has(base.toLowerCase())) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base}_${i}`;
    if (!lower.has(candidate.toLowerCase())) return candidate;
  }
}

export function EnumsPanel() {
  const enums = useCanvasStore((s) => s.enums);
  const tables = useCanvasStore((s) => s.tables);
  const setSelectedTableIds = useCanvasStore((s) => s.setSelectedTableIds);
  const openTab = useDockStore((s) => s.openTab);
  const { variant } = usePanelStyle("enums");

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [openValue, setOpenValue] = useState<number | null>(null);
  const [focusValue, setFocusValue] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CanvasEnum | null>(null);
  const [query, setQuery] = useState("");

  // `tables` is replaced on every pointermove of a canvas drag. Keying the
  // usage scan on a structural fingerprint instead of the array identity keeps
  // it off the drag path entirely.
  const signature = useMemo(() => tablesStructureSignature(tables), [tables]);
  const usageIndex = useMemo(
    () => buildEnumUsageIndex(tables, enums),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature, enums]
  );
  const tableColor = useMemo(() => new Map(tables.map((t) => [t.id, t.color])), [tables]);

  // Every mutation reads `enums` fresh from the store rather than from the
  // render closure. A field committing on blur writes the store during the
  // mousedown that precedes a button's click, so a closure captured at render
  // time can already be one edit stale by the time the click handler runs.
  const mutate = (next: (current: CanvasEnum[]) => CanvasEnum[]) => {
    const store = useCanvasStore.getState();
    store.setEnums(next(store.enums));
  };

  const patchEnum = (id: string, patch: Partial<CanvasEnum>) =>
    mutate((current) => current.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const patchValues = (id: string, updater: (prev: EnumValue[]) => EnumValue[]) =>
    mutate((current) => current.map((e) => (e.id === id ? { ...e, values: updater(e.values) } : e)));

  const toggleEnum = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
    setOpenValue(null);
  };

  const addEnum = () => {
    const created: CanvasEnum = {
      id: crypto.randomUUID(),
      name: uniqueName("new_enum", useCanvasStore.getState().enums.map((e) => e.name)),
      values: [{ name: "value" }],
    };
    mutate((current) => [...current, created]);
    setExpandedId(created.id);
    setOpenValue(null);
  };

  const addValue = (id: string) => {
    const current = useCanvasStore.getState().enums.find((e) => e.id === id);
    if (!current) return;
    const index = current.values.length;
    patchValues(id, (prev) => [...prev, { name: uniqueName("value", prev.map((v) => v.name)) }]);
    setOpenValue(index);
    setFocusValue(index);
  };

  const moveValue = (id: string, idx: number, delta: number) => {
    patchValues(id, (prev) => {
      const target = idx + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
    setOpenValue(idx + delta);
  };

  const requestDelete = (target: CanvasEnum) => {
    if ((usageIndex.get(target.id) ?? []).length === 0) {
      mutate((current) => current.filter((e) => e.id !== target.id));
      return;
    }
    setPendingDelete(target);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    mutate((current) => current.filter((e) => e.id !== pendingDelete.id));
    setPendingDelete(null);
  };

  const showTable = (tableId: string) => {
    openTab("tables");
    setSelectedTableIds([tableId]);
  };

  const onKey = (e: React.KeyboardEvent, fn: () => void) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  };

  const needle = query.trim().toLowerCase();
  const visible = enums.filter(
    (e) =>
      !needle ||
      needle
        .split(/\s+/)
        .every((w) => `${e.name} ${e.values.map((v) => v.name).join(" ")}`.toLowerCase().includes(w))
  );
  const pendingUsage = pendingDelete ? (usageIndex.get(pendingDelete.id) ?? []) : [];

  const renderValue = (e: CanvasEnum, value: EnumValue, idx: number) => {
    const isOpen = openValue === idx;
    const toggle = () => setOpenValue(isOpen ? null : idx);
    return (
      <Fragment key={idx}>
        <div
          className={cn(styles.row, styles.valueRow, isOpen && styles.valueOpen)}
          role="button"
          tabIndex={0}
          aria-expanded={isOpen}
          onClick={toggle}
          onKeyDown={(ev) => onKey(ev, toggle)}
        >
          <span className={cn(styles.ic, styles.index)}>{idx + 1}</span>
          <span className={styles.cn} title={value.name}>
            {value.name}
          </span>
          {value.note && (
            <span className={styles.valueNote} title={value.note}>
              {value.note}
            </span>
          )}
        </div>

        {isOpen && (
          <div className={cn(styles.detail, styles.valueEditor)} onClick={(ev) => ev.stopPropagation()}>
            <div className={styles.twoCol}>
              <label className={styles.field}>
                Value
                <CommittedInput
                  value={value.name}
                  onCommit={(name) =>
                    name.trim() &&
                    patchValues(e.id, (prev) => prev.map((v, i) => (i === idx ? { ...v, name: name.trim() } : v)))
                  }
                  className={styles.input}
                  autoFocus={focusValue === idx}
                  onFocus={(ev) => {
                    if (focusValue === idx) {
                      ev.currentTarget.select();
                      setFocusValue(null);
                    }
                  }}
                />
              </label>
              <label className={styles.field}>
                Note
                <CommittedInput
                  value={value.note ?? ""}
                  onCommit={(note) =>
                    patchValues(e.id, (prev) =>
                      prev.map((v, i) => (i === idx ? { ...v, note: note.trim() || undefined } : v))
                    )
                  }
                  placeholder="Optional"
                  className={styles.input}
                />
              </label>
            </div>
            <div className={styles.editorFoot}>
              <button
                type="button"
                className={styles.btn}
                disabled={idx === 0}
                onClick={() => moveValue(e.id, idx, -1)}
                title="Move up"
              >
                <ChevronUp className="w-3.5 h-3.5" />
                Up
              </button>
              <button
                type="button"
                className={styles.btn}
                disabled={idx === e.values.length - 1}
                onClick={() => moveValue(e.id, idx, 1)}
                title="Move down"
              >
                <ChevronDown className="w-3.5 h-3.5" />
                Down
              </button>
              <button
                type="button"
                className={styles.linkDanger}
                onClick={() => {
                  patchValues(e.id, (prev) => prev.filter((_, i) => i !== idx));
                  setOpenValue(null);
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove value
              </button>
            </div>
          </div>
        )}
      </Fragment>
    );
  };

  const renderUsage = (usage: EnumUsageSite[]) => (
    <div className={styles.usage}>
      {usage.map((site) => (
        <button
          key={site.columnId}
          type="button"
          style={{ "--tc": tableColor.get(site.tableId) } as CSSProperties}
          title={`Open ${site.tableName} in the Tables tab`}
          onClick={() => showTable(site.tableId)}
        >
          <i />
          <span className={styles.tname}>
            {splitSchemaName(site.tableName).table}
            <span className={styles.col}>.{site.columnName}</span>
          </span>
        </button>
      ))}
    </div>
  );

  const renderEnum = (e: CanvasEnum) => {
    const isOpen = expandedId === e.id;
    const usage = usageIndex.get(e.id) ?? [];

    return (
      <div key={e.id} className={cn(styles.tb, styles.card, !isOpen && styles.closed, isOpen && styles.cardOpen)} style={ENUM_TINT}>
        <div
          className={styles.tbHead}
          role="button"
          tabIndex={0}
          aria-expanded={isOpen}
          onClick={() => toggleEnum(e.id)}
          onKeyDown={(ev) => onKey(ev, () => toggleEnum(e.id))}
        >
          <span className={styles.chev}>
            <ChevronDown className="w-3 h-3" />
          </span>
          <span className={styles.mk}>
            <EnumGlyph />
          </span>
          <span className={styles.tname} title={e.name}>
            {e.name}
          </span>
          <span className={styles.meta}>
            <span className={cn(usage.length === 0 && styles.unused)}>
              {usage.length > 0 ? `${usage.length} use${usage.length === 1 ? "" : "s"}` : "unused"}
            </span>
            <span>
              {e.values.length} value{e.values.length === 1 ? "" : "s"}
            </span>
          </span>
        </div>

        {/* Closed cards preview the values; the compact style stays one line. */}
        {!isOpen && variant !== "dense" && e.values.length > 0 && (
          <div className={styles.preview} onClick={() => toggleEnum(e.id)}>
            {e.values.slice(0, PREVIEW_VALUES).map((v, i) => (
              <span key={i} className={styles.valueChip}>
                {v.name}
              </span>
            ))}
            {e.values.length > PREVIEW_VALUES && (
              <span className={styles.more}>+{e.values.length - PREVIEW_VALUES}</span>
            )}
          </div>
        )}

        {isOpen && (
          <>
            <div className={styles.tbBody}>
              {e.values.length === 0 ? (
                <p className={styles.emptyValues}>
                  No values yet. An enum with no values is left out of the generated DBML.
                </p>
              ) : (
                e.values.map((v, i) => renderValue(e, v, i))
              )}
              <button type="button" className={styles.addRow} onClick={() => addValue(e.id)}>
                <Plus className="w-3 h-3" />
                Add value
              </button>
            </div>

            <div className={styles.settings}>
              <label className={styles.field}>
                Name
                <CommittedInput
                  value={e.name}
                  onCommit={(name) => name.trim() && patchEnum(e.id, { name: name.trim() })}
                  placeholder="enum_name"
                  className={styles.input}
                />
              </label>
              <label className={styles.field}>
                Note
                <CommittedInput
                  value={e.note ?? ""}
                  onCommit={(note) => patchEnum(e.id, { note: note.trim() || undefined })}
                  placeholder="What these values mean"
                  className={styles.input}
                />
              </label>

              <div className={styles.sec}>
                <h4>Used by</h4>
                {usage.length > 0 ? (
                  renderUsage(usage)
                ) : (
                  <p className={styles.hint}>
                    Not used yet. Pick it as a column type in the{" "}
                    <button type="button" className={styles.inlineLink} onClick={() => openTab("tables")}>
                      Tables tab
                    </button>
                    .
                  </p>
                )}
              </div>

              <div className={styles.actions}>
                <button type="button" className={cn(styles.btn, styles.btnDanger)} onClick={() => requestDelete(e)}>
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete enum
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className={styles.panel} data-v={variant}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h3>Enums</h3>
          <span className={styles.count}>{needle ? `${visible.length} / ${enums.length}` : enums.length}</span>
          <span className={styles.spacer} />
          {expandedId && (
            <button
              type="button"
              className={styles.iconBtn}
              title="Close the open enum"
              aria-label="Close the open enum"
              onClick={() => toggleEnum(expandedId)}
            >
              <ChevronsDownUp className="w-3.5 h-3.5" />
            </button>
          )}
          <button type="button" className={styles.addBtn} onClick={addEnum}>
            <Plus className="w-3.5 h-3.5" />
            Add enum
          </button>
        </div>
        {enums.length > 0 && (
          <label className={styles.search}>
            <Search className="w-3.5 h-3.5 shrink-0" />
            <input
              type="search"
              value={query}
              onChange={(ev) => setQuery(ev.target.value)}
              placeholder="Filter enums or values"
              aria-label="Filter enums"
            />
          </label>
        )}
      </div>

      <div className={styles.body}>
        {enums.length === 0 ? (
          <div className={styles.emptyState}>
            <ListOrdered className="w-8 h-8" />
            <p>Enums are named sets of values, like order statuses, that you can use as a column type.</p>
            <button type="button" className={styles.btn} onClick={addEnum}>
              <Plus className="w-3.5 h-3.5" />
              Add enum
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className={styles.empty}>No enums match “{query.trim()}”.</div>
        ) : (
          <div className={styles.list}>{visible.map(renderEnum)}</div>
        )}
      </div>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete enum &ldquo;{pendingDelete?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  {pendingUsage.length} column{pendingUsage.length === 1 ? "" : "s"} still use this type. Their
                  types are left unchanged, so they will refer to an enum that no longer exists.
                </p>
                <ul className="text-xs space-y-0.5 max-h-32 overflow-y-auto">
                  {pendingUsage.map((site) => (
                    <li key={site.columnId}>
                      {site.tableName}.{site.columnName}
                    </li>
                  ))}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete enum</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
