"use client";

import { useCallback, useMemo, useState, type CSSProperties } from "react";
import { ChevronDown, Plus } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCanvasStore, type CanvasProject, type Table } from "@/store/useCanvasStore";
import { useDockStore } from "@/store/useDockStore";
import { usePanelStyle } from "@/store/usePanelStyleStore";
import { SQL_DIALECTS } from "@/lib/generator/sql-generator";
import { tablesStructureSignature } from "@/lib/enum-usage";
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
import { CommittedInput, useCommitOnUnmount } from "./committed-input";
import { DatabaseGlyph, SchemaGlyph } from "./panel-glyphs";
import styles from "./database-panel.module.scss";

const ACCENT = { "--tc": "var(--primary)" } as CSSProperties;
/** Tables listed on a closed schema card before the rest collapse into "+N". */
const PREVIEW_TABLES = 5;

const onKey = (e: React.KeyboardEvent, fn: () => void) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fn();
  }
};

/** Table colours keyed by id, subscribed as a string so a canvas drag doesn't re-render. */
function useTableColors(): Map<string, string> {
  const colorKey = useCanvasStore((s) => s.tables.map((t) => `${t.id}=${t.color}`).join("|"));
  return useMemo(
    () =>
      new Map(
        colorKey
          .split("|")
          .filter(Boolean)
          .map((entry) => entry.split("=") as [string, string])
      ),
    [colorKey]
  );
}

// ─── Project card ────────────────────────────────────────────────────────────

interface ProjectDraft {
  name: string;
  databaseType: string;
  note: string;
}

const toDraft = (project: CanvasProject | null): ProjectDraft => ({
  name: project?.name ?? "",
  databaseType: project?.databaseType ?? "",
  note: project?.note ?? "",
});

// Back to the store's shape. `null` when every field is blank, matching what
// `parsedToCanvasSchemaMeta` returns for DBML with no `Project` block — writing
// `{}` instead would leave the cloud-autosave payload differing from a freshly
// parsed one for a schema that is semantically identical.
const toProject = (draft: ProjectDraft): CanvasProject | null => {
  const name = draft.name.trim();
  const databaseType = draft.databaseType.trim();
  const note = draft.note.trim();
  if (!name && !databaseType && !note) return null;
  return {
    name: name || undefined,
    databaseType: databaseType || undefined,
    note: note || undefined,
  };
};

const sameProject = (a: CanvasProject | null, b: CanvasProject | null) =>
  (a?.name ?? "") === (b?.name ?? "") &&
  (a?.databaseType ?? "") === (b?.databaseType ?? "") &&
  (a?.note ?? "") === (b?.note ?? "");

function ProjectFields() {
  const project = useCanvasStore((s) => s.project);
  const setProject = useCanvasStore((s) => s.setProject);

  const [draft, setDraft] = useState<ProjectDraft>(() => toDraft(project));
  const [isEditing, setIsEditing] = useState(false);

  // Adjusting state during render (React's documented alternative to a
  // store->local sync effect) so an external edit — typically the Code tab
  // re-parsing DBML — flows into the fields without a cascading-render effect.
  // Skipped while this panel owns the edit, so a keystroke is never clobbered.
  const [lastProject, setLastProject] = useState(project);
  if (project !== lastProject) {
    setLastProject(project);
    if (!isEditing) setDraft(toDraft(project));
  }

  // Committed on blur rather than per keystroke: `setProject` re-runs the Code
  // tab's DBML regeneration and re-arms both autosave debounces, none of which
  // needs to happen on every character. Touches the store only — no React state
  // — so the unmount path below can call it safely.
  const commit = useCallback(() => {
    const next = toProject(draft);
    const current = useCanvasStore.getState().project;
    if (sameProject(next, current)) return;
    setProject(next);
  }, [draft, setProject]);

  useCommitOnUnmount(commit);

  const update = (patch: Partial<ProjectDraft>) => {
    setIsEditing(true);
    setDraft((d) => ({ ...d, ...patch }));
  };

  const handleBlur = () => {
    setIsEditing(false);
    commit();
  };

  return (
    <>
      <label className={styles.field}>
        Name
        <Input
          value={draft.name}
          onChange={(e) => update({ name: e.target.value })}
          onBlur={handleBlur}
          placeholder="Database Documentation"
          className={styles.input}
        />
      </label>

      <label className={styles.field}>
        Database type
        {/* Free text with suggestions, not a fixed <select>: DBML's
            `database_type` is an arbitrary string, and narrowing it here would
            silently rewrite a value the parser round-trips fine. */}
        <Input
          list="schema-project-db-type-options"
          value={draft.databaseType}
          onChange={(e) => update({ databaseType: e.target.value })}
          onBlur={handleBlur}
          placeholder="PostgreSQL"
          className={styles.input}
        />
        <datalist id="schema-project-db-type-options">
          {SQL_DIALECTS.map((d) => (
            <option key={d.value} value={d.label} />
          ))}
        </datalist>
      </label>

      <label className={styles.field}>
        Note
        <Textarea
          value={draft.note}
          onChange={(e) => update({ note: e.target.value })}
          onBlur={handleBlur}
          placeholder="Markdown overview shown at the top of your docs."
          className={styles.noteInput}
        />
        <span className={styles.hint}>
          Markdown. Appears as the overview in Docs mode and as the Project block in the generated DBML.
        </span>
      </label>
    </>
  );
}

function ProjectCard() {
  const project = useCanvasStore((s) => s.project);
  // Numbers only, so a canvas drag never re-renders this card.
  const tableCount = useCanvasStore((s) => s.tables.length);
  const relationshipCount = useCanvasStore((s) => s.relationships.length);
  const enumCount = useCanvasStore((s) => s.enums.length);
  const schemaCount = useCanvasStore(
    (s) =>
      new Set(
        s.tables.map((t) => splitSchemaName(t.name).schema).filter((schema): schema is string => schema !== null)
      ).size
  );
  const [isOpen, setIsOpen] = useState(false);
  const toggle = () => setIsOpen((v) => !v);

  const name = project?.name?.trim();
  const summary = [project?.databaseType, `${tableCount} table${tableCount === 1 ? "" : "s"}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={cn(styles.tb, styles.card, !isOpen && styles.closed, isOpen && styles.cardOpen)} style={ACCENT}>
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
          <DatabaseGlyph />
        </span>
        <span className={cn(styles.tname, !name && styles.untitled)}>{name || "Untitled database"}</span>
        <span className={styles.meta}>{project?.databaseType || "Project"}</span>
      </div>

      {!isOpen && (
        <div className={styles.closedBody} onClick={toggle}>
          <span className={styles.summaryLine}>{summary}</span>
          {project?.note && <p className={styles.notePreview}>{project.note}</p>}
        </div>
      )}

      {isOpen && (
        <div className={styles.settings}>
          <div className={styles.stats}>
            <div>
              <b>{tableCount}</b>tables
            </div>
            <div>
              <b>{relationshipCount}</b>relations
            </div>
            <div>
              <b>{schemaCount}</b>schemas
            </div>
            <div>
              <b>{enumCount}</b>enums
            </div>
          </div>
          <ProjectFields />
        </div>
      )}
    </div>
  );
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

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

function Schemas() {
  const tables = useCanvasStore((s) => s.tables);
  const setSelectedTableIds = useCanvasStore((s) => s.setSelectedTableIds);
  const openTab = useDockStore((s) => s.openTab);
  const colors = useTableColors();

  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [draftSchemas, setDraftSchemas] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Drag-path guard: group by prefix only when the structure actually changed.
  // See release-1-0/schema-tab-plan.md §6. Colours come from `colors`, since
  // the signature doesn't cover them.
  const signature = useMemo(() => tablesStructureSignature(tables), [tables]);
  const groups = useMemo(
    () => groupTablesBySchema(tables),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature]
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

  const tint = (t: Table) => ({ "--tc": colors.get(t.id) ?? t.color }) as CSSProperties;

  const sections: { schema: string | null; tables: Table[]; isDraft: boolean }[] = [
    ...groups.map((g) => ({ ...g, isDraft: false })),
    ...emptyDrafts.map((name) => ({ schema: name, tables: [] as Table[], isDraft: true })),
  ];

  const renderSchema = ({ schema, tables: schemaTables, isDraft }: (typeof sections)[number]) => {
    const key = schemaKey(schema);
    const isOpen = expandedKey === key;
    const isReserved = schema?.toLowerCase() === DEFAULT_SCHEMA;
    const toggle = () => setExpandedKey(isOpen ? null : key);

    return (
      <div key={key} className={cn(styles.tb, styles.card, !isOpen && styles.closed, isOpen && styles.cardOpen)} style={ACCENT}>
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
    <>
      <div className={styles.sectionHead}>
        Schemas
        <span className={styles.sectionCount}>{allSchemaNames.length}</span>
        <button type="button" className={styles.ghostBtn} onClick={addSchema}>
          <Plus className="w-3 h-3" />
          Add schema
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {sections.length === 0 ? (
        <p className={styles.empty}>No tables yet. Add one, then give it a schema here.</p>
      ) : (
        sections.map(renderSchema)
      )}
    </>
  );
}

// ─── Panel ───────────────────────────────────────────────────────────────────

export function DatabasePanel() {
  const { variant } = usePanelStyle("database");

  return (
    <div className={styles.panel} data-v={variant}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h3>Database</h3>
        </div>
        <p className={styles.intro}>
          This diagram is one database. It holds schemas, which hold the tables you edit in the Tables tab.
        </p>
      </div>

      <div className={styles.body}>
        <div className={styles.list}>
          <ProjectCard />
          <Schemas />
        </div>
      </div>
    </div>
  );
}
