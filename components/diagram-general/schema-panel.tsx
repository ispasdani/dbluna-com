"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Database,
  Plus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  useCanvasStore,
  type CanvasProject,
  type Table,
} from "@/store/useCanvasStore";
import { SQL_DIALECTS } from "@/lib/generator/sql-generator";
import { tablesStructureSignature } from "@/lib/enum-usage";
import {
  DEFAULT_SCHEMA,
  groupTablesBySchema,
  moveTableToSchema,
  renameSchema,
  splitSchemaName,
  validateSchemaName,
  type SchemaEditPlan,
} from "@/lib/schema-namespace";
import { CommittedInput, useCommitOnUnmount } from "./committed-input";

// ─── Collapsible section shell ───────────────────────────────────────────────
// Open/closed is local state only — the dock store tracks tabs, not what's
// expanded inside one.

interface SectionProps {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function Section({ title, description, defaultOpen = true, children }: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    // `bg-card` rather than no background: the dock ground is a faint grey
    // (--dock-bg), so an unpainted section blended into it instead of reading
    // as a distinct card. Same surface token TablesPanel gives its rows, so it
    // is white in the light palettes and the dark surface in Tokyo Night.
    <div className="bg-card border border-border">
      {/* --muted and --accent resolve to the same value in the light palettes,
          so the previous `bg-muted/50` was that colour at half strength and
          barely registered against the card. `bg-accent` is what the rest of
          the app uses for an interactive row (dropdown items, issue rows). */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center gap-2 p-3 text-left select-none hover:bg-accent transition-colors"
      >
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <span className="font-medium text-sm text-foreground">{title}</span>
          {description && (
            <p className="text-xs text-muted-foreground truncate">{description}</p>
          )}
        </div>
      </button>

      {isOpen && <div className="px-3 pb-3 pt-0">{children}</div>}
    </div>
  );
}

// ─── Project section ─────────────────────────────────────────────────────────

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

function ProjectSection() {
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
    <div className="space-y-3">
      <div className="space-y-1">
        <label htmlFor="schema-project-name" className="text-xs font-medium text-muted-foreground">
          Name
        </label>
        <Input
          id="schema-project-name"
          value={draft.name}
          onChange={(e) => update({ name: e.target.value })}
          onBlur={handleBlur}
          placeholder="Database Documentation"
          className="h-8 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="schema-project-db-type" className="text-xs font-medium text-muted-foreground">
          Database type
        </label>
        {/* Free text with suggestions, not a fixed <select>: DBML's
            `database_type` is an arbitrary string, and narrowing it here would
            silently rewrite a value the parser round-trips fine. */}
        <Input
          id="schema-project-db-type"
          list="schema-project-db-type-options"
          value={draft.databaseType}
          onChange={(e) => update({ databaseType: e.target.value })}
          onBlur={handleBlur}
          placeholder="PostgreSQL"
          className="h-8 text-sm"
        />
        <datalist id="schema-project-db-type-options">
          {SQL_DIALECTS.map((d) => (
            <option key={d.value} value={d.label} />
          ))}
        </datalist>
      </div>

      <div className="space-y-1">
        <label htmlFor="schema-project-note" className="text-xs font-medium text-muted-foreground">
          Note
        </label>
        <Textarea
          id="schema-project-note"
          value={draft.note}
          onChange={(e) => update({ note: e.target.value })}
          onBlur={handleBlur}
          placeholder="Markdown overview shown at the top of your docs."
          className="min-h-20 text-sm"
        />
        <p className="text-[11px] text-muted-foreground">
          Markdown. Appears as the overview in Docs mode and as the{" "}
          <code className="font-mono">Project</code> block in the generated DBML.
        </p>
      </div>
    </div>
  );
}

// ─── Namespaces section ──────────────────────────────────────────────────────

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
// table names. So the "no schema" bucket needs a key that can't collide with a
// real schema name, and a freshly created empty schema lives in local state
// until a table is actually moved into it.
const NO_SCHEMA_KEY = "\u0000none";
const schemaKey = (schema: string | null) => schema ?? NO_SCHEMA_KEY;

function NamespacesSection() {
  const tables = useCanvasStore((s) => s.tables);
  const setSelectedTableIds = useCanvasStore((s) => s.setSelectedTableIds);

  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [draftSchemas, setDraftSchemas] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Drag-path guard, same as the other sections: group by prefix only when the
  // structure actually changed. See release-1-0/schema-tab-plan.md §6.
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

  const renderTableRow = (t: Table) => {
    const { schema, table: bare } = splitSchemaName(t.name);
    return (
      <div key={t.id} className="flex items-center gap-1 px-2 py-1.5 text-xs">
        <button
          type="button"
          onClick={() => setSelectedTableIds([t.id])}
          className="font-mono truncate flex-1 text-left hover:underline"
          title={`Select ${t.name}`}
        >
          {bare}
        </button>
        <select
          value={schema ?? ""}
          onChange={(e) => handleMove(t.id, e.target.value || null)}
          className="h-6 text-[11px] bg-popover text-popover-foreground border border-border px-1 max-w-32"
          aria-label={`Schema for ${t.name}`}
        >
          {/* Native selects inherit the OS popup background unless the options
              carry one too, which reads as a stray dark strip in light mode.
              Same treatment code-editor.tsx gives its language picker. */}
          <option value="" className="bg-popover text-popover-foreground">
            (no schema)
          </option>
          {allSchemaNames.map((name) => (
            <option key={name} value={name} className="bg-popover text-popover-foreground">
              {name}
            </option>
          ))}
        </select>
      </div>
    );
  };

  const sections: { schema: string | null; tables: Table[]; isDraft: boolean }[] = [
    ...groups.map((g) => ({ ...g, isDraft: false })),
    ...emptyDrafts.map((name) => ({ schema: name, tables: [] as Table[], isDraft: true })),
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Derived from the <code className="font-mono">schema.</code> prefix on table names.
        </p>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1 px-2" onClick={addSchema}>
          <Plus className="w-3 h-3" /> Schema
        </Button>
      </div>

      {error && (
        <p className="text-xs text-destructive border border-destructive/30 px-2 py-1.5">
          {error}
        </p>
      )}

      {sections.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          No tables yet. Add one, then give it a schema here.
        </p>
      ) : (
        <div className="space-y-2">
          {sections.map(({ schema, tables: schemaTables, isDraft }) => {
            const key = schemaKey(schema);
            const isExpanded = expandedKey === key;
            const isReserved = schema?.toLowerCase() === DEFAULT_SCHEMA;

            return (
              <div key={key} className="border border-border">
                <button
                  type="button"
                  onClick={() => setExpandedKey(isExpanded ? null : key)}
                  className="w-full flex items-center gap-2 p-2 text-left select-none"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="font-mono text-sm truncate flex-1">
                    {schema ?? "(no schema)"}
                  </span>
                  {isReserved && (
                    <span
                      className="text-[11px] text-yellow-600 dark:text-yellow-500 shrink-0"
                      title="DBML drops a `public.` prefix on import, so it won't survive a round-trip."
                    >
                      reserved
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground shrink-0">
                    {isDraft ? "empty" : `${schemaTables.length}`}
                  </span>
                </button>

                {isExpanded && (
                  <div className="px-2 pb-2 space-y-2">
                    {schema !== null && (
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">
                          Schema name
                        </label>
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
                              setDraftSchemas((prev) =>
                                prev.map((d) => (d === schema ? next.trim() : d))
                              );
                              setExpandedKey(schemaKey(next.trim()));
                              return;
                            }
                            handleRename(schema, next);
                          }}
                          className="h-8 text-sm font-mono"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Renaming rewrites every table in this schema and any table group
                          that references them.
                        </p>
                      </div>
                    )}

                    {schemaTables.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-1">
                        No tables. Assign one from another schema&apos;s list.
                      </p>
                    ) : (
                      <div className="border border-border divide-y divide-border max-h-56 overflow-y-auto">
                        {schemaTables.map(renderTableRow)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Panel ───────────────────────────────────────────────────────────────────

export function SchemaPanel() {
  const project = useCanvasStore((s) => s.project);
  // Counts only distinct named prefixes — cheap enough to run on any store
  // change, and returning a number means a canvas drag never re-renders the
  // header (the selector's result is unchanged).
  const namedSchemaCount = useCanvasStore(
    (s) =>
      new Set(
        s.tables
          .map((t) => splitSchemaName(t.name).schema)
          .filter((schema): schema is string => schema !== null)
      ).size
  );

  const projectSummary =
    [project?.name, project?.databaseType].filter(Boolean).join(" · ") || "Not set";
  const namespaceSummary =
    namedSchemaCount === 0 ? "None" : `${namedSchemaCount} schema${namedSchemaCount === 1 ? "" : "s"}`;

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold text-lg">Schema</h2>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Database-wide settings. Tables and columns live in the Tables tab.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
        <Section title="Project" description={projectSummary}>
          <ProjectSection />
        </Section>

        <Section title="Namespaces" description={namespaceSummary} defaultOpen={false}>
          <NamespacesSection />
        </Section>
      </div>
    </div>
  );
}
