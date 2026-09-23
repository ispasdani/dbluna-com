"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { ChevronDown, Eye, EyeOff, Focus, Plus } from "lucide-react";

import { useCanvasStore, type Table } from "@/store/useCanvasStore";
import { useDockStore } from "@/store/useDockStore";
import { useEditorStore } from "@/store/useEditorStore";
import { usePanelStyle } from "@/store/usePanelStyleStore";
import {
  DEFAULT_SCHEMA,
  groupTablesBySchema,
  moveTableToSchema,
  renameSchema,
  schemaKey,
  schemaLabel,
  splitSchemaName,
  validateSchemaName,
  type SchemaEditPlan,
} from "@/lib/schema-namespace";
import { cn } from "@/lib/utils";
import { CommittedInput } from "./committed-input";
import { SchemaGlyph } from "./panel-glyphs";
import { useSchemaVisibility } from "./use-schema-visibility";
import { SchemaGraph } from "./schema-graph";
import { GroupCards } from "./group-cards";
import { GROUP_SOURCES } from "@/lib/table-grouping";
import styles from "./schemas-panel.module.scss";

const ACCENT = { "--tc": "var(--primary)" } as CSSProperties;
/** Tables listed on a closed schema card before the rest collapse into "+N". */
const PREVIEW_TABLES = 5;

const onKey = (e: React.KeyboardEvent, fn: () => void) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fn();
  }
};

/**
 * Everything this panel draws about a table — id, name, colour — as one string.
 *
 * The panel subscribes to this instead of `tables`: a canvas drag replaces
 * `tables` on every pointermove but changes none of these, so the string
 * compares equal and the panel doesn't re-render mid-drag. Control characters
 * as delimiters, since a name can contain any printable one.
 */
const panelSignature = (tables: Table[]) =>
  tables.map((t) => `${t.id}\u0001${t.name}\u0001${t.color}`).join("\u0002");

/** Unique-ifies a proposed name against the existing ones (case-insensitive). */
function uniqueName(base: string, taken: string[]): string {
  const lower = new Set(taken.map((n) => n.toLowerCase()));
  if (!lower.has(base.toLowerCase())) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base}_${i}`;
    if (!lower.has(candidate.toLowerCase())) return candidate;
  }
}

// Schemas are not stored anywhere: they exist only as a `schema.` prefix inside
// table names, so a freshly created empty schema lives in local state until a
// table is actually moved into it. Bucket key/label helpers come from
// lib/schema-namespace so the Tables tab buckets rows identically.

export function SchemasPanel() {
  const { variant } = usePanelStyle("schemas");
  const signature = useCanvasStore((s) => panelSignature(s.tables));
  const setSelectedTableIds = useCanvasStore((s) => s.setSelectedTableIds);
  const openTab = useDockStore((s) => s.openTab);
  const visibility = useSchemaVisibility();
  const { source, info } = visibility;
  const setGroupBy = useEditorStore((s) => s.setGroupBy);

  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [draftSchemas, setDraftSchemas] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Read the tables only when the signature changes. The objects read here are
  // current for everything the panel shows; their x/y may go stale during a
  // drag, which is fine, because nothing here uses them.
  const groups = useMemo(
    () => groupTablesBySchema(useCanvasStore.getState().tables),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature]
  );
  // For the TableGroup and FK-cluster cards, which list tables by id.
  const tableById = useMemo(
    () => new Map(groups.flatMap((g) => g.tables).map((t) => [t.id, t])),
    [groups]
  );

  // Named schemas that exist on the canvas, plus any created here that have no
  // tables yet, so they can be picked as a move target.
  const existingNames = groups.map((g) => g.schema).filter((s): s is string => s !== null);
  const emptyDrafts = draftSchemas.filter((d) => !existingNames.includes(d));
  const allSchemaNames = [...existingNames, ...emptyDrafts].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );

  // Renames rewrite `tables` AND `tableGroups` together — group members are
  // schema-qualified strings resolved by exact compare, so writing one without
  // the other silently empties every affected group, in Docs too. React batches
  // the two store writes into a single render. See schema-tab-plan.md §4.
  const applyPlan = (plan: SchemaEditPlan) => {
    if (!plan.ok) {
      setError(plan.error);
      return false;
    }
    setError(null);
    const store = useCanvasStore.getState();
    store.setTables(plan.result.tables);
    // Identity-stable when untouched, so an unaffected schema edit doesn't
    // trigger a second write (or a second upgrade toast when writes are gated).
    if (plan.result.tableGroups !== store.tableGroups) {
      store.setTableGroups(plan.result.tableGroups);
    }
    return true;
  };

  const handleRename = (from: string, to: string) => {
    const store = useCanvasStore.getState();
    if (applyPlan(renameSchema(from, to, store.tables, store.tableGroups))) {
      // Visibility is keyed by name, so it has to follow the rename or the
      // hidden set points at a schema nobody has any more. Renaming onto an
      // existing schema merges into it, and the merged tables take that
      // schema's visibility.
      const target = to.trim();
      const editor = useEditorStore.getState();
      if (existingNames.includes(target)) editor.setSchemaHidden(schemaKey(from), false);
      else editor.renameHiddenSchema(schemaKey(from), schemaKey(target));
      setDraftSchemas((prev) => prev.filter((d) => d !== from));
      setExpandedKey(schemaKey(to.trim()));
    }
  };

  const handleMove = (tableId: string, to: string | null) => {
    const store = useCanvasStore.getState();
    applyPlan(moveTableToSchema(tableId, to, store.tables, store.tableGroups));
  };

  const addSchema = () => {
    const created = uniqueName("new_schema", [...allSchemaNames]);
    setDraftSchemas((prev) => [...prev, created]);
    setExpandedKey(schemaKey(created));
    setError(null);
  };

  const showTable = (tableId: string) => {
    openTab("tables");
    setSelectedTableIds([tableId]);
  };

  const tint = (t: Table) => ({ "--tc": t.color }) as CSSProperties;

  const sections: { schema: string | null; tables: Table[]; isDraft: boolean }[] = [
    ...groups.map((g) => ({ ...g, isDraft: false })),
    ...emptyDrafts.map((name) => ({ schema: name, tables: [] as Table[], isDraft: true })),
  ];

  const renderSchema = ({ schema, tables: schemaTables, isDraft }: (typeof sections)[number]) => {
    const key = schemaKey(schema);
    const isOpen = expandedKey === key;
    const isReserved = schema?.toLowerCase() === DEFAULT_SCHEMA;
    const isHidden = !isDraft && visibility.isHidden(key);
    const toggle = () => setExpandedKey(isOpen ? null : key);
    // The head toggles the card open; its buttons must not.
    const stop = (e: React.SyntheticEvent) => e.stopPropagation();

    return (
      <div
        key={key}
        className={cn(styles.tb, styles.card, !isOpen && styles.closed, isOpen && styles.cardOpen, isHidden && styles.cardHidden)}
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
          <span className={cn(styles.tname, schema === null && styles.untitled)}>{schemaLabel(schema)}</span>
          {isReserved && (
            <span className={styles.tag} title="DBML drops a `public.` prefix on import, so it won't survive a round-trip.">
              reserved
            </span>
          )}
          <span className={styles.meta}>
            {isDraft ? "empty" : `${schemaTables.length} table${schemaTables.length === 1 ? "" : "s"}`}
          </span>
          {!isDraft && (
            <span className={styles.headActions} onClick={stop} onKeyDown={stop}>
              {visibility.total > 1 && (
                <button
                  type="button"
                  className={styles.headBtn}
                  title="Show only this schema on the canvas"
                  aria-label={`Show only ${schemaLabel(schema)}`}
                  onClick={() => visibility.showOnly(key)}
                >
                  <Focus className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                className={styles.headBtn}
                title={isHidden ? "Show on the canvas" : "Hide from the canvas"}
                aria-label={`${isHidden ? "Show" : "Hide"} ${schemaLabel(schema)}`}
                aria-pressed={isHidden}
                onClick={() => visibility.toggle(key)}
              >
                {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </span>
          )}
        </div>

        {/* Closed cards preview the tables inside. */}
        {!isOpen && schemaTables.length > 0 && (
          <div className={styles.closedBody} onClick={toggle}>
            <div className={styles.tableChips}>
              {schemaTables.slice(0, PREVIEW_TABLES).map((t) => (
                <span key={t.id} className={styles.chip} style={tint(t)} title={t.name}>
                  <i />
                  <span className={styles.tname}>{splitSchemaName(t.name).table}</span>
                </span>
              ))}
              {schemaTables.length > PREVIEW_TABLES && (
                <span className={styles.more}>+{schemaTables.length - PREVIEW_TABLES}</span>
              )}
            </div>
          </div>
        )}

        {isOpen && (
          <>
            <div className={styles.tbBody}>
              {schemaTables.length === 0 ? (
                <p className={styles.emptyRows}>No tables yet. Move one here from another schema.</p>
              ) : (
                schemaTables.map((t) => {
                  const bare = splitSchemaName(t.name).table;
                  return (
                    <div key={t.id} className={cn(styles.row, styles.tableRow)} style={tint(t)}>
                      <i />
                      <button
                        type="button"
                        className={styles.tableLink}
                        title={`Open ${t.name} in the Tables tab`}
                        onClick={() => showTable(t.id)}
                      >
                        {bare}
                      </button>
                      <select
                        className={styles.moveSelect}
                        value={splitSchemaName(t.name).schema ?? ""}
                        onChange={(e) => handleMove(t.id, e.target.value || null)}
                        aria-label={`Schema for ${t.name}`}
                        title="Move to another schema"
                      >
                        <option value="">No schema</option>
                        {allSchemaNames.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })
              )}
            </div>

            {schema !== null && (
              <div className={styles.settings}>
                <label className={styles.field}>
                  Schema name
                  <CommittedInput
                    value={schema}
                    onCommit={(next) => {
                      if (isDraft) {
                        const invalid = validateSchemaName(next);
                        if (invalid) {
                          setError(invalid);
                          return;
                        }
                        setError(null);
                        setDraftSchemas((prev) => prev.map((d) => (d === schema ? next.trim() : d)));
                        setExpandedKey(schemaKey(next.trim()));
                        return;
                      }
                      handleRename(schema, next);
                    }}
                    className={styles.input}
                  />
                  <span className={styles.hint}>
                    Renaming rewrites every table in this schema and any table group that references them.
                  </span>
                </label>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className={styles.panel} data-v={variant}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h3>Schemas</h3>
          <span className={styles.count}>{source === "schema" ? allSchemaNames.length : visibility.total}</span>
          <span className={styles.spacer} />
          {source === "schema" && (
            <button type="button" className={styles.addBtn} onClick={addSchema}>
              <Plus className="w-3.5 h-3.5" />
              Add schema
            </button>
          )}
        </div>

        {/* What "a group" means here. Schemas come from the database;
            databases without them (MySQL, SQLite) group by TableGroup blocks
            or by the clusters their foreign keys form. A view setting, per
            diagram, like the hidden set. */}
        <div className={styles.seg} role="radiogroup" aria-label="Group tables by">
          {GROUP_SOURCES.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={source === s.id}
              onClick={() => setGroupBy(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Changing a prefix in the Code tab re-creates the table (the parser
            matches on the qualified name), losing its position and colour —
            this panel is the supported way to reorganise. */}
        <p className={styles.intro}>
          {source === "schema" ? (
            <>
              The namespaces inside this database. Rename or move tables here rather than editing the prefix
              in the Code tab, which resets the table&apos;s position and colour.
            </>
          ) : source === "tableGroup" ? (
            <>
              The <b>TableGroup</b> blocks in your DBML. Add or change them in the Code tab.
            </>
          ) : (
            <>Tables that reference each other more than anything else, found from your relationships.</>
          )}
        </p>
        {/* Hiding is a view of this diagram in this browser, never an edit:
            nothing is deleted, synced or left out of the DBML. */}
        {visibility.total > 0 && (
          <div className={styles.visRow}>
            <span>
              {visibility.hiddenCount === 0
                ? `All ${info.plural} on the canvas`
                : `${visibility.shownCount} of ${visibility.total} on the canvas`}
            </span>
            <span className={styles.spacer} />
            <button
              type="button"
              className={styles.linkBtn}
              disabled={visibility.hiddenCount === 0}
              onClick={visibility.showAll}
            >
              Show all
            </button>
            <button
              type="button"
              className={styles.linkBtn}
              disabled={visibility.shownCount === 0}
              onClick={visibility.hideAll}
            >
              Hide all
            </button>
          </div>
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.list}>
          <SchemaGraph />

          {/* Nothing to switch between: say so plainly rather than show one
              lonely catch-all card, and point at a source that would help. */}
          {groups.length > 0 && visibility.entries.every((e) => e.isRemainder) && (
            <p className={styles.intro}>
              {source === "schema" ? (
                <>
                  No schemas yet. Add one and move tables into it, or prefix a table name like <b>auth.users</b>.
                </>
              ) : source === "tableGroup" ? (
                <>
                  No table groups yet. Declare one in the Code tab, like <b>TableGroup billing {"{ … }"}</b>.
                </>
              ) : (
                <>No relationships yet, so there is nothing to cluster.</>
              )}{" "}
              {source !== "fkCluster" && (
                <button type="button" className={styles.linkBtn} onClick={() => setGroupBy("fkCluster")}>
                  Group by relationships instead
                </button>
              )}
            </p>
          )}

          {error && <p className={styles.error}>{error}</p>}

          {groups.length === 0 && sections.length === 0 ? (
            <p className={styles.empty}>No tables yet. Add one, then give it a schema here.</p>
          ) : source === "schema" ? (
            sections.map(renderSchema)
          ) : (
            <GroupCards visibility={visibility} tableById={tableById} onShowTable={showTable} />
          )}
        </div>
      </div>
    </div>
  );
}
