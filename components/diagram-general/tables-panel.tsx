"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ChevronDown,
  ChevronsDownUp,
  Crosshair,
  Lock,
  MessageSquare,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { useCanvasStore, TABLE_COLORS, type Column, type Table } from "@/store/useCanvasStore";
import { useDockStore } from "@/store/useDockStore";
import { usePanelStyle } from "@/store/usePanelStyleStore";
import {
  groupTablesBySchema,
  moveTableToSchema,
  qualifySchemaName,
  schemaKey,
  schemaLabel,
  splitSchemaName,
  type SchemaEditPlan,
} from "@/lib/schema-namespace";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { CommittedInput, CommittedTextarea } from "./committed-input";
import { KeyGlyph, LinkGlyph, TableGlyph, UniqueGlyph } from "./panel-glyphs";
import { foreignKeyIsSource } from "./relationship-direction";
import { focusTableOnCanvas } from "./use-diagram-issues";
import styles from "./tables-panel.module.scss";

const PRIMITIVE_TYPES: { value: string; label: string }[] = [
  { value: "INT", label: "INT" },
  { value: "VARCHAR", label: "VARCHAR" },
  { value: "TEXT", label: "TEXT" },
  { value: "BOOLEAN", label: "BOOL" },
  { value: "TIMESTAMP", label: "TIME" },
  { value: "DATE", label: "DATE" },
  { value: "FLOAT", label: "FLOAT" },
  { value: "UUID", label: "UUID" },
  { value: "JSON", label: "JSON" },
];

const CONSTRAINTS = [
  { key: "isPrimaryKey", short: "PK", label: "Primary key" },
  { key: "isNotNull", short: "NN", label: "Not null" },
  { key: "isUnique", short: "UQ", label: "Unique" },
  { key: "isAutoIncrement", short: "AI", label: "Auto incr." },
] as const;

const NEW_ENUM = "__new_enum__";
const NEW_SCHEMA = "__new_schema__";
const NO_SCHEMA = "__no_schema__";

const tc = (color: string) => ({ "--tc": color }) as CSSProperties;

interface ColumnRef {
  relationshipId: string;
  table: Table;
  column: Column;
}

interface TableLinks {
  /** Tables this one references, each once. */
  out: Table[];
  /** Tables that reference this one, each once. */
  in: Table[];
  count: number;
}

function TableMark({ table }: { table: Table }) {
  return (
    <span className={styles.mk} style={tc(table.color)}>
      <TableGlyph />
    </span>
  );
}

export function TablesPanel() {
  const tables = useCanvasStore((s) => s.tables);
  const relationships = useCanvasStore((s) => s.relationships);
  const enums = useCanvasStore((s) => s.enums);
  const selectedTableIds = useCanvasStore((s) => s.selectedTableIds);
  const addTable = useCanvasStore((s) => s.addTable);
  const updateTable = useCanvasStore((s) => s.updateTable);
  const deleteTable = useCanvasStore((s) => s.deleteTable);
  const setSelectedTableIds = useCanvasStore((s) => s.setSelectedTableIds);
  const setSelectedRelationshipId = useCanvasStore((s) => s.setSelectedRelationshipId);
  const addField = useCanvasStore((s) => s.addField);
  const updateField = useCanvasStore((s) => s.updateField);
  const deleteField = useCanvasStore((s) => s.deleteField);
  const openTab = useDockStore((s) => s.openTab);
  const { variant } = usePanelStyle("tables");

  const isSingleSelection = selectedTableIds.length === 1;
  const selectionKey = selectedTableIds.join(",");

  // Cards start closed. Expansion is tracked apart from selection so a card can
  // be folded by clicking its header again without losing the canvas selection.
  const [expandedTableId, setExpandedTableId] = useState<string | null>(
    isSingleSelection ? selectedTableIds[0] : null
  );
  const [openColumnId, setOpenColumnId] = useState<string | null>(null);
  const [focusColumnId, setFocusColumnId] = useState<string | null>(null);
  const [collapsedSchemas, setCollapsedSchemas] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState("");
  const [newSchemaFor, setNewSchemaFor] = useState<string | null>(null);
  const [newSchemaName, setNewSchemaName] = useState("");
  const [schemaError, setSchemaError] = useState<{ tableId: string; message: string } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const resetCardState = () => {
    setOpenColumnId(null);
    setNewSchemaFor(null);
    setSchemaError(null);
  };

  const reveal = (el: Element | null | undefined) => {
    const box = bodyRef.current;
    if (!el || !box) return;
    const r = el.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    if (r.top < b.top || r.top > b.bottom - 80) {
      box.scrollTo({ top: box.scrollTop + r.top - b.top - 12, behavior: "smooth" });
    }
  };

  // A table picked on the canvas opens its card: unfold its schema, scroll to it.
  useEffect(() => {
    const id = selectedTableIds.length === 1 ? selectedTableIds[0] : null;
    setExpandedTableId(id);
    resetCardState();
    if (!id) return;
    const table = useCanvasStore.getState().tables.find((t) => t.id === id);
    if (table) {
      const key = schemaKey(splitSchemaName(table.name).schema);
      setCollapsedSchemas((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
    const raf = requestAnimationFrame(() =>
      reveal(bodyRef.current?.querySelector(`[data-table-id="${CSS.escape(id)}"]`))
    );
    return () => cancelAnimationFrame(raf);
    // Only react to an actual change of selection, not to unrelated store updates,
    // so a manual collapse isn't immediately undone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey]);

  // Foreign-key columns and table-to-table links, derived from relationships.
  const { columnRefs, links } = useMemo(() => {
    const byId = new Map(tables.map((t) => [t.id, t]));
    const refs = new Map<string, ColumnRef>();
    const linkMap = new Map<string, TableLinks>();
    const linksOf = (id: string) => {
      let l = linkMap.get(id);
      if (!l) {
        l = { out: [], in: [], count: 0 };
        linkMap.set(id, l);
      }
      return l;
    };

    for (const rel of relationships) {
      const st = byId.get(rel.sourceTableId);
      const tt = byId.get(rel.targetTableId);
      const sc = st?.columns.find((c) => c.id === rel.sourceColumnId);
      const tcol = tt?.columns.find((c) => c.id === rel.targetColumnId);
      if (!st || !tt || !sc || !tcol) continue;

      const fkIsSource = foreignKeyIsSource(rel, sc, tcol);
      const fk = fkIsSource ? { table: st, column: sc } : { table: tt, column: tcol };
      const ref = fkIsSource ? { table: tt, column: tcol } : { table: st, column: sc };

      if (!refs.has(fk.column.id)) refs.set(fk.column.id, { relationshipId: rel.id, ...ref });

      const from = linksOf(fk.table.id);
      const to = linksOf(ref.table.id);
      from.count++;
      if (ref.table.id !== fk.table.id) to.count++;
      if (!from.out.includes(ref.table)) from.out.push(ref.table);
      if (!to.in.includes(fk.table)) to.in.push(fk.table);
    }
    return { columnRefs: refs, links: linkMap };
  }, [tables, relationships]);

  // Grouped on every render, deliberately NOT memoised on
  // `tablesStructureSignature` the way the Database tab does it: rows here also
  // render colour, comment and lock state, which that signature doesn't cover.
  const groups = groupTablesBySchema(tables);
  const schemaNames = groups.map((g) => g.schema).filter((s): s is string => s !== null);

  // With no `schema.` prefix anywhere there is exactly one bucket holding
  // everything, and wrapping it in a "(no schema)" header would be pure chrome.
  const isGrouped = schemaNames.length > 0;

  const needle = query.trim().toLowerCase();
  const matches = (t: Table) =>
    !needle ||
    needle
      .split(/\s+/)
      .every((w) => `${t.name} ${t.columns.map((c) => c.name).join(" ")}`.toLowerCase().includes(w));
  const visibleGroups = groups
    .map((g) => ({ ...g, tables: g.tables.filter(matches) }))
    .filter((g) => g.tables.length > 0);
  const visibleCount = visibleGroups.reduce((n, g) => n + g.tables.length, 0);

  const toggleSchema = (key: string) =>
    setCollapsedSchemas((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Moves rewrite `tables` AND `tableGroups` together — group members are
  // schema-qualified strings, so writing one without the other empties them.
  // Same as the Database tab's applyPlan.
  const moveToSchema = (tableId: string, to: string | null) => {
    const store = useCanvasStore.getState();
    const plan: SchemaEditPlan = moveTableToSchema(tableId, to, store.tables, store.tableGroups);
    if (!plan.ok) {
      setSchemaError({ tableId, message: plan.error });
      return;
    }
    setSchemaError(null);
    setNewSchemaFor(null);
    store.setTables(plan.result.tables);
    if (plan.result.tableGroups !== store.tableGroups) store.setTableGroups(plan.result.tableGroups);
    if (to) {
      const key = schemaKey(to.trim());
      setCollapsedSchemas((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
    requestAnimationFrame(() =>
      reveal(bodyRef.current?.querySelector(`[data-table-id="${CSS.escape(tableId)}"]`))
    );
  };

  const onHeaderClick = (e: React.MouseEvent | React.KeyboardEvent, table: Table) => {
    const isSelected = selectedTableIds.includes(table.id);
    if (e.ctrlKey || e.metaKey) {
      setSelectedTableIds(
        isSelected ? selectedTableIds.filter((id) => id !== table.id) : [...selectedTableIds, table.id]
      );
      return;
    }
    if (isSelected && isSingleSelection) {
      // Already the active table: fold or unfold its card.
      setExpandedTableId(expandedTableId === table.id ? null : table.id);
      resetCardState();
    } else {
      setSelectedTableIds([table.id]);
    }
  };

  const addColumn = (tableId: string) => {
    addField(tableId);
    const table = useCanvasStore.getState().tables.find((t) => t.id === tableId);
    const created = table?.columns[table.columns.length - 1];
    if (created) {
      setOpenColumnId(created.id);
      setFocusColumnId(created.id);
    }
  };

  const showRelationship = (relationshipId: string) => {
    openTab("relationships");
    setSelectedRelationshipId(relationshipId);
  };

  const onKey = (e: React.KeyboardEvent, fn: () => void) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  };

  const typeSelect = (table: Table, col: Column) => {
    const known =
      PRIMITIVE_TYPES.some((p) => p.value === col.type) || enums.some((en) => en.name === col.type);
    return (
      <select
        className={styles.select}
        value={col.type}
        aria-label="Type"
        onChange={(e) => {
          if (e.target.value === NEW_ENUM) {
            openTab("enums");
            return;
          }
          updateField(table.id, col.id, { type: e.target.value });
        }}
      >
        {!known && <option value={col.type}>{col.type}</option>}
        <optgroup label="Primitives">
          {PRIMITIVE_TYPES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </optgroup>
        {enums.length > 0 && (
          <optgroup label="Enums">
            {enums.map((en) => (
              <option key={en.id} value={en.name}>
                {en.name}
              </option>
            ))}
          </optgroup>
        )}
        <optgroup label="">
          <option value={NEW_ENUM}>＋ New enum…</option>
        </optgroup>
      </select>
    );
  };

  const renderColumn = (table: Table, col: Column) => {
    const ref = columnRefs.get(col.id);
    const isOpen = openColumnId === col.id;
    const nullable = !col.isNotNull && !col.isPrimaryKey;
    const badge = col.isPrimaryKey ? "PK" : ref ? "FK" : col.isUnique ? "UQ" : null;
    const flags = [col.isAutoIncrement && "AI", nullable && "NULL"].filter(Boolean) as string[];
    const toggle = () => setOpenColumnId(isOpen ? null : col.id);

    return (
      <Fragment key={col.id}>
        <div
          className={cn(styles.row, styles.colRow, col.isPrimaryKey && styles.pk, isOpen && styles.colOpen)}
          role="button"
          tabIndex={0}
          aria-expanded={isOpen}
          onClick={toggle}
          onKeyDown={(e) => onKey(e, toggle)}
        >
          <span className={styles.ic}>
            {col.isPrimaryKey ? <KeyGlyph /> : ref ? <LinkGlyph /> : col.isUnique ? <UniqueGlyph /> : null}
          </span>
          {badge && <span className={styles.badge}>{badge}</span>}
          <span className={styles.cn} title={col.name}>
            {col.name}
          </span>
          {variant !== "dense" && flags.length > 0 && (
            <span className={styles.flags}>
              {flags.map((f) => (
                <span key={f}>{f}</span>
              ))}
            </span>
          )}
          <span className={styles.ty}>
            {col.type}
            {variant === "dense" && nullable && <span className={styles.nullMark}>?</span>}
          </span>
        </div>

        {isOpen && (
          <div className={cn(styles.detail, styles.columnEditor)} onClick={(e) => e.stopPropagation()}>
            <div className={styles.twoCol}>
              <label className={styles.field}>
                Name
                <CommittedInput
                  value={col.name}
                  onCommit={(name) => name.trim() && updateField(table.id, col.id, { name: name.trim() })}
                  className={styles.input}
                  autoFocus={focusColumnId === col.id}
                  onFocus={(e) => {
                    if (focusColumnId === col.id) {
                      e.currentTarget.select();
                      setFocusColumnId(null);
                    }
                  }}
                />
              </label>
              <label className={styles.field}>
                Type
                {typeSelect(table, col)}
              </label>
            </div>

            <div className={styles.toggles} role="group" aria-label="Constraints">
              {CONSTRAINTS.map(({ key, short, label }) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={col[key]}
                  onClick={() => updateField(table.id, col.id, { [key]: !col[key] })}
                >
                  <b>{short}</b>
                  {label}
                </button>
              ))}
            </div>

            {ref && (
              <div className={styles.ref}>
                <LinkGlyph />
                <span>References</span>
                <TableMark table={ref.table} />
                <button
                  type="button"
                  title="Open in the Relationships tab"
                  onClick={() => showRelationship(ref.relationshipId)}
                >
                  {splitSchemaName(ref.table.name).table}.{ref.column.name}
                </button>
              </div>
            )}

            <div className={styles.editorFoot}>
              <button
                type="button"
                className={styles.linkDanger}
                onClick={() => {
                  deleteField(table.id, col.id);
                  setOpenColumnId(null);
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete column
              </button>
            </div>
          </div>
        )}
      </Fragment>
    );
  };

  const renderSettings = (table: Table) => {
    const { schema, table: bare } = splitSchemaName(table.name);
    const tableLinks = links.get(table.id);
    const error = schemaError?.tableId === table.id ? schemaError.message : null;
    const pickingNew = newSchemaFor === table.id;

    return (
      <div className={styles.settings} onClick={(e) => e.stopPropagation()}>
        <div className={styles.sec}>
          <h4>Name</h4>
          <div className={styles.nameBlock}>
            <div className={styles.nameGrid}>
              <label className={styles.field}>
                Schema
                <select
                  className={styles.select}
                  value={pickingNew ? NEW_SCHEMA : schema ?? NO_SCHEMA}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSchemaError(null);
                    if (v === NEW_SCHEMA) {
                      setNewSchemaFor(table.id);
                      setNewSchemaName("");
                      return;
                    }
                    setNewSchemaFor(null);
                    moveToSchema(table.id, v === NO_SCHEMA ? null : v);
                  }}
                >
                  {schemaNames.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                  <option value={NO_SCHEMA}>No schema</option>
                  <option value={NEW_SCHEMA}>＋ New schema…</option>
                </select>
              </label>
              <label className={styles.field}>
                Table
                <CommittedInput
                  value={bare}
                  onCommit={(next) =>
                    next.trim() && updateTable(table.id, { name: qualifySchemaName(schema, next.trim()) })
                  }
                  className={styles.input}
                />
              </label>
            </div>

            {pickingNew && (
              <div className={styles.newSchema}>
                <Input
                  value={newSchemaName}
                  autoFocus
                  placeholder="New schema name, like audit"
                  aria-label="New schema name"
                  className={styles.input}
                  onChange={(e) => {
                    setNewSchemaName(e.target.value);
                    setSchemaError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") moveToSchema(table.id, newSchemaName);
                    if (e.key === "Escape") {
                      setNewSchemaFor(null);
                      setSchemaError(null);
                    }
                  }}
                />
                <button type="button" className={styles.btn} onClick={() => moveToSchema(table.id, newSchemaName)}>
                  Move
                </button>
                <button
                  type="button"
                  className={styles.iconBtn}
                  aria-label="Cancel"
                  onClick={() => {
                    setNewSchemaFor(null);
                    setSchemaError(null);
                  }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {error ? (
              <p className={styles.error}>{error}</p>
            ) : (
              <p className={styles.hint}>
                Full name: <b>{table.name}</b>
              </p>
            )}
          </div>
        </div>

        <div className={styles.sec}>
          <h4>Color</h4>
          <div className={styles.swatches}>
            {TABLE_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Color ${color}`}
                aria-pressed={table.color === color}
                style={{ "--c": color } as CSSProperties}
                onClick={() => updateTable(table.id, { color })}
              />
            ))}
          </div>
        </div>

        {tableLinks && tableLinks.count > 0 && (
          <div className={styles.sec}>
            <h4>Relationships</h4>
            <div className={styles.relChips}>
              {tableLinks.out.map((t) => (
                <button
                  key={`out-${t.id}`}
                  type="button"
                  style={tc(t.color)}
                  title={`References ${t.name}`}
                  onClick={() => setSelectedTableIds([t.id])}
                >
                  <span className={styles.dir}>→</span>
                  <i />
                  <span className={styles.tname}>{splitSchemaName(t.name).table}</span>
                </button>
              ))}
              {tableLinks.in.map((t) => (
                <button
                  key={`in-${t.id}`}
                  type="button"
                  style={tc(t.color)}
                  title={`Referenced by ${t.name}`}
                  onClick={() => setSelectedTableIds([t.id])}
                >
                  <span className={styles.dir}>←</span>
                  <i />
                  <span className={styles.tname}>{splitSchemaName(t.name).table}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={styles.sec}>
          <h4>Comment</h4>
          <CommittedTextarea
            value={table.comment || ""}
            onCommit={(comment) => updateTable(table.id, { comment })}
            placeholder="What this table holds, who writes to it"
            className={styles.comment}
          />
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.btn} onClick={() => focusTableOnCanvas(table.id)}>
            <Crosshair className="w-3.5 h-3.5" />
            Show on canvas
          </button>
          <button
            type="button"
            className={cn(styles.btn, table.isLocked && styles.btnOn)}
            aria-pressed={!!table.isLocked}
            onClick={() => updateTable(table.id, { isLocked: !table.isLocked })}
          >
            <Lock className="w-3.5 h-3.5" />
            {table.isLocked ? "Locked" : "Lock"}
          </button>
          <button type="button" className={cn(styles.btn, styles.btnDanger)} onClick={() => deleteTable(table.id)}>
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      </div>
    );
  };

  const renderTable = (table: Table) => {
    const isSelected = selectedTableIds.includes(table.id);
    const isOpen = expandedTableId === table.id && isSingleSelection;
    const bare = splitSchemaName(table.name).table;
    const relCount = links.get(table.id)?.count ?? 0;

    return (
      <div
        key={table.id}
        data-table-id={table.id}
        className={cn(
          styles.tb,
          styles.card,
          !isOpen && styles.closed,
          isOpen ? styles.cardOpen : isSelected && styles.cardSelected
        )}
        style={tc(table.color)}
      >
        <div
          className={styles.tbHead}
          role="button"
          tabIndex={0}
          aria-expanded={isOpen}
          onClick={(e) => onHeaderClick(e, table)}
          onKeyDown={(e) => onKey(e, () => onHeaderClick(e, table))}
        >
          <span className={styles.chev}>
            <ChevronDown className="w-3 h-3" />
          </span>
          <TableMark table={table} />
          <span className={styles.tname} title={table.name}>
            {bare}
          </span>
          <span className={styles.meta}>
            {table.isLocked && (
              <span className={cn(styles.metaItem, styles.locked)} title="Locked">
                <Lock className="w-3 h-3" />
              </span>
            )}
            {table.comment && (
              <span className={styles.metaItem} title={table.comment}>
                <MessageSquare className="w-3 h-3" />
              </span>
            )}
            {relCount > 0 && (
              <span className={styles.metaItem} title={`${relCount} relationship${relCount === 1 ? "" : "s"}`}>
                <LinkGlyph />
                {relCount}
              </span>
            )}
            <span>{table.columns.length} cols</span>
          </span>
        </div>

        {isOpen && (
          <>
            <div className={styles.tbBody}>
              {table.columns.map((col) => renderColumn(table, col))}
              <button type="button" className={styles.addCol} onClick={() => addColumn(table.id)}>
                <Plus className="w-3 h-3" />
                Add column
              </button>
            </div>
            {renderSettings(table)}
          </>
        )}
      </div>
    );
  };

  const countLabel = needle ? `${visibleCount} / ${tables.length}` : `${tables.length}`;

  return (
    <div className={styles.panel} data-v={variant}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h3>Tables</h3>
          <span className={styles.count}>{countLabel}</span>
          <span className={styles.spacer} />
          {expandedTableId && isSingleSelection && (
            <button
              type="button"
              className={styles.iconBtn}
              title="Close the open table"
              aria-label="Close the open table"
              onClick={() => {
                setExpandedTableId(null);
                resetCardState();
              }}
            >
              <ChevronsDownUp className="w-3.5 h-3.5" />
            </button>
          )}
          <button type="button" className={styles.addBtn} onClick={addTable}>
            <Plus className="w-3.5 h-3.5" />
            Add table
          </button>
        </div>
        {tables.length > 0 && (
          <label className={styles.search}>
            <Search className="w-3.5 h-3.5 shrink-0" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter tables or columns"
              aria-label="Filter tables"
            />
          </label>
        )}
      </div>

      <div className={styles.body} ref={bodyRef}>
        {tables.length === 0 ? (
          <div className={styles.empty}>No tables yet. Add one to start.</div>
        ) : visibleCount === 0 ? (
          <div className={styles.empty}>No tables match “{query.trim()}”.</div>
        ) : (
          <div className={styles.list}>
            {isGrouped
              ? visibleGroups.map(({ schema, tables: schemaTables }) => {
                  const key = schemaKey(schema);
                  const isCollapsed = collapsedSchemas.has(key) && !needle;
                  return (
                    <div key={key} className={styles.schemaGroup}>
                      <button
                        type="button"
                        className={cn(styles.schemaHead, isCollapsed && styles.schemaClosed)}
                        aria-expanded={!isCollapsed}
                        onClick={() => toggleSchema(key)}
                      >
                        <span className={styles.chev}>
                          <ChevronDown className="w-3 h-3" />
                        </span>
                        {schemaLabel(schema)}
                        <span className={styles.schemaCount}>{schemaTables.length}</span>
                      </button>
                      {!isCollapsed && schemaTables.map(renderTable)}
                    </div>
                  );
                })
              : visibleGroups.flatMap((g) => g.tables).map(renderTable)}
          </div>
        )}
      </div>
    </div>
  );
}
