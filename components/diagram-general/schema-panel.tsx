"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Database,
  Plus,
  Trash2,
  X,
} from "lucide-react";

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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  useCanvasStore,
  type CanvasEnum,
  type CanvasProject,
  type CanvasTableGroup,
  type EnumValue,
  type Table,
} from "@/store/useCanvasStore";
import { SQL_DIALECTS } from "@/lib/generator/sql-generator";
import {
  buildEnumUsageIndex,
  tablesStructureSignature,
  type EnumUsageSite,
} from "@/lib/enum-usage";
import { resolveGroupMembers, toggleGroupMember } from "@/lib/table-groups";
import {
  DEFAULT_SCHEMA,
  groupTablesBySchema,
  moveTableToSchema,
  renameSchema,
  splitSchemaName,
  validateSchemaName,
  type SchemaEditPlan,
} from "@/lib/schema-namespace";

// ─── Shared edit plumbing ────────────────────────────────────────────────────

/**
 * Runs `fn` once, on unmount, always with its latest identity.
 *
 * Every text field here commits on blur rather than per keystroke, since a
 * store write re-runs the Code tab's DBML regeneration and re-arms both
 * autosave debounces. Switching dock tabs unmounts the panel *without* firing
 * blur, so without this a pending edit would be silently dropped.
 */
function useCommitOnUnmount(fn: () => void) {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  useEffect(() => () => ref.current(), []);
}

/**
 * Text input holding a local draft, committing on blur. An external change to
 * `value` (typically the Code tab re-parsing DBML) is adopted during render —
 * React's documented alternative to a sync effect — but never while this field
 * owns the edit, so a keystroke is not clobbered mid-type.
 */
function CommittedInput({
  value,
  onCommit,
  className,
  ...props
}: {
  value: string;
  onCommit: (next: string) => void;
} & Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "onBlur">) {
  const [draft, setDraft] = useState(value);
  const [isEditing, setIsEditing] = useState(false);
  const [lastValue, setLastValue] = useState(value);

  if (value !== lastValue) {
    setLastValue(value);
    if (!isEditing) setDraft(value);
  }

  const commit = useCallback(() => {
    if (draft === value) return;
    onCommit(draft);
  }, [draft, value, onCommit]);

  useCommitOnUnmount(commit);

  return (
    <Input
      {...props}
      className={className}
      value={draft}
      onChange={(e) => {
        setIsEditing(true);
        setDraft(e.target.value);
      }}
      onBlur={() => {
        setIsEditing(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}

// ─── Collapsible section shell ───────────────────────────────────────────────
// Shared by every Schema-tab section (Project today; namespaces, enums and
// table groups land in later phases). Open/closed is local state only — the
// dock store tracks tabs, not what's expanded inside one.

interface SectionProps {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function Section({ title, description, defaultOpen = true, children }: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-border">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center gap-2 p-3 text-left select-none hover:bg-muted/50 transition-colors"
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

// ─── Enums section ───────────────────────────────────────────────────────────

// Unique-ifies a proposed name against the existing ones so "New enum" twice
// doesn't produce a duplicate — duplicates are legal in the model but confusing
// in a list, and DBML treats a repeated `Enum` block as a redefinition.
function uniqueName(base: string, taken: string[]): string {
  const lower = new Set(taken.map((n) => n.toLowerCase()));
  if (!lower.has(base.toLowerCase())) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base}_${i}`;
    if (!lower.has(candidate.toLowerCase())) return candidate;
  }
}

function EnumValueRow({
  value,
  index,
  total,
  onChange,
  onMove,
  onRemove,
}: {
  value: EnumValue;
  index: number;
  total: number;
  onChange: (patch: Partial<EnumValue>) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="bg-card border border-border p-2 space-y-1.5">
      <div className="flex items-center gap-1">
        <CommittedInput
          value={value.name}
          onCommit={(name) => onChange({ name })}
          placeholder="value"
          aria-label={`Enum value ${index + 1} name`}
          className="h-7 text-xs font-mono"
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-6 shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-30"
          disabled={index === 0}
          onClick={() => onMove(-1)}
          title="Move up"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-6 shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-30"
          disabled={index === total - 1}
          onClick={() => onMove(1)}
          title="Move down"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-6 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          title="Remove value"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
      <CommittedInput
        value={value.note ?? ""}
        onCommit={(note) => onChange({ note: note.trim() || undefined })}
        placeholder="Note (optional)"
        aria-label={`Enum value ${index + 1} note`}
        className="h-7 text-xs"
      />
    </div>
  );
}

function EnumCard({
  canvasEnum,
  usage,
  isExpanded,
  onToggle,
  onPatch,
  onPatchValues,
  onDelete,
  onSelectTable,
}: {
  canvasEnum: CanvasEnum;
  usage: EnumUsageSite[];
  isExpanded: boolean;
  onToggle: () => void;
  onPatch: (patch: Partial<CanvasEnum>) => void;
  onPatchValues: (updater: (prev: EnumValue[]) => EnumValue[]) => void;
  onDelete: () => void;
  onSelectTable: (tableId: string) => void;
}) {

  return (
    <div className="border border-border">
      <div className="flex items-center p-2 gap-1">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-2 min-w-0 flex-1 text-left select-none"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
          <span className="font-mono text-sm truncate" title={canvasEnum.name}>
            {canvasEnum.name}
          </span>
          <span className="text-xs text-muted-foreground shrink-0">
            {canvasEnum.values.length} value{canvasEnum.values.length === 1 ? "" : "s"}
          </span>
        </button>

        <span
          className={
            usage.length > 0
              ? "text-[11px] text-emerald-600 dark:text-emerald-400 shrink-0"
              : "text-[11px] text-muted-foreground shrink-0"
          }
        >
          {usage.length > 0
            ? `${usage.length} use${usage.length === 1 ? "" : "s"}`
            : "unused"}
        </span>

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-muted-foreground/60 hover:text-destructive"
          onClick={onDelete}
          title="Delete enum"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <CommittedInput
              value={canvasEnum.name}
              onCommit={(name) => onPatch({ name })}
              placeholder="enum_name"
              className="h-8 text-sm font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Note</label>
            <CommittedInput
              value={canvasEnum.note ?? ""}
              onCommit={(note) => onPatch({ note: note.trim() || undefined })}
              placeholder="Optional description"
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Values</label>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs gap-1 px-2"
                onClick={() =>
                  onPatchValues((prev) => [
                    ...prev,
                    { name: uniqueName("value", prev.map((v) => v.name)) },
                  ])
                }
              >
                <Plus className="w-3 h-3" /> Value
              </Button>
            </div>

            {canvasEnum.values.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No values yet. An enum with no values is dropped from the generated DBML.
              </p>
            ) : (
              <div className="space-y-2">
                {canvasEnum.values.map((value, idx) => (
                  <EnumValueRow
                    // Values have no ids in the model; index is the only stable
                    // handle, and reorder/remove rebuild the whole list anyway.
                    key={idx}
                    value={value}
                    index={idx}
                    total={canvasEnum.values.length}
                    onChange={(patch) =>
                      onPatchValues((prev) =>
                        prev.map((v, i) => (i === idx ? { ...v, ...patch } : v))
                      )
                    }
                    onMove={(delta) =>
                      onPatchValues((prev) => {
                        const next = [...prev];
                        const target = idx + delta;
                        if (target < 0 || target >= next.length) return prev;
                        [next[idx], next[target]] = [next[target], next[idx]];
                        return next;
                      })
                    }
                    onRemove={() => onPatchValues((prev) => prev.filter((_, i) => i !== idx))}
                  />
                ))}
              </div>
            )}
          </div>

          {usage.length > 0 && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Used by</label>
              <div className="flex flex-wrap gap-1">
                {usage.map((site) => (
                  <button
                    key={site.columnId}
                    type="button"
                    onClick={() => onSelectTable(site.tableId)}
                    className="text-[11px] font-mono px-1.5 py-0.5 border border-border hover:bg-accent transition-colors"
                    title={`Select ${site.tableName}`}
                  >
                    {site.tableName}.{site.columnName}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EnumsSection() {
  const enums = useCanvasStore((s) => s.enums);
  const tables = useCanvasStore((s) => s.tables);
  const setSelectedTableIds = useCanvasStore((s) => s.setSelectedTableIds);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CanvasEnum | null>(null);

  // `tables` is replaced on every pointermove of a canvas drag. Keying the
  // usage scan on a structural fingerprint instead of the array identity keeps
  // it off the drag path entirely. See release-1-0/schema-tab-plan.md §6.
  const signature = useMemo(() => tablesStructureSignature(tables), [tables]);
  const usageIndex = useMemo(
    () => buildEnumUsageIndex(tables, enums),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature, enums]
  );

  // Every mutation reads `enums` fresh from the store rather than from the
  // render closure. A field committing on blur writes the store during the
  // mousedown that precedes a button's click, so a closure captured at render
  // time can already be one edit stale by the time the click handler runs —
  // the same reason code-editor.tsx reads tables via getState().
  const mutate = (next: (current: CanvasEnum[]) => CanvasEnum[]) => {
    const store = useCanvasStore.getState();
    store.setEnums(next(store.enums));
  };

  const patchEnum = (id: string, patch: Partial<CanvasEnum>) =>
    mutate((current) => current.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const patchEnumValues = (id: string, updater: (prev: EnumValue[]) => EnumValue[]) =>
    mutate((current) =>
      current.map((e) => (e.id === id ? { ...e, values: updater(e.values) } : e))
    );

  const addEnum = () => {
    const created: CanvasEnum = {
      id: crypto.randomUUID(),
      name: uniqueName("new_enum", useCanvasStore.getState().enums.map((e) => e.name)),
      values: [{ name: "value" }],
    };
    mutate((current) => [...current, created]);
    setExpandedId(created.id);
  };

  const requestDelete = (target: CanvasEnum) => {
    // Deleting an unused enum is trivially reversible and needs no ceremony;
    // one that columns still reference gets a confirmation naming them.
    if ((usageIndex.get(target.id) ?? []).length === 0) {
      mutate((current) => current.filter((e) => e.id !== target.id));
      return;
    }
    setPendingDelete(target);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    // Column types are deliberately left alone: rewriting table data from this
    // panel is the Tables tab's job, and silently retyping columns would be a
    // much bigger edit than the one the user asked for.
    mutate((current) => current.filter((e) => e.id !== pendingDelete.id));
    setPendingDelete(null);
  };

  const pendingUsage = pendingDelete ? (usageIndex.get(pendingDelete.id) ?? []) : [];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Named value sets you can use as a column type.
        </p>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1 px-2" onClick={addEnum}>
          <Plus className="w-3 h-3" /> Enum
        </Button>
      </div>

      {enums.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          No enums yet. Add one, then set a column&apos;s type to its name in the Tables tab.
        </p>
      ) : (
        <div className="space-y-2">
          {enums.map((e) => (
            <EnumCard
              key={e.id}
              canvasEnum={e}
              usage={usageIndex.get(e.id) ?? []}
              isExpanded={expandedId === e.id}
              onToggle={() => setExpandedId(expandedId === e.id ? null : e.id)}
              onPatch={(patch) => patchEnum(e.id, patch)}
              onPatchValues={(updater) => patchEnumValues(e.id, updater)}
              onDelete={() => requestDelete(e)}
              onSelectTable={(tableId) => setSelectedTableIds([tableId])}
            />
          ))}
        </div>
      )}

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete enum &ldquo;{pendingDelete?.name}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  {pendingUsage.length} column
                  {pendingUsage.length === 1 ? "" : "s"} still use this type. Their types are
                  left unchanged, so they will refer to an enum that no longer exists.
                </p>
                <ul className="font-mono text-xs space-y-0.5 max-h-32 overflow-y-auto">
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

// ─── Namespaces section ──────────────────────────────────────────────────────

// Schemas are not stored anywhere: they exist only as a `schema.` prefix inside
// table names. So the "no schema" bucket needs a key that can't collide with a
// real schema name, and a freshly created empty schema lives in local state
// until a table is actually moved into it.
const NO_SCHEMA_KEY = " none";
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
          className="h-6 text-[11px] bg-transparent border border-border px-1 max-w-32"
          aria-label={`Schema for ${t.name}`}
        >
          <option value="">(no schema)</option>
          {allSchemaNames.map((name) => (
            <option key={name} value={name}>
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

// ─── Table groups section ────────────────────────────────────────────────────

function TableGroupCard({
  group,
  tables,
  isExpanded,
  onToggle,
  onRename,
  onPatchMembers,
  onDelete,
  onSelectTable,
}: {
  group: CanvasTableGroup;
  tables: Table[];
  isExpanded: boolean;
  onToggle: () => void;
  onRename: (name: string) => void;
  onPatchMembers: (updater: (prev: string[]) => string[]) => void;
  onDelete: () => void;
  onSelectTable: (tableId: string) => void;
}) {
  const members = useMemo(
    () => resolveGroupMembers(group.tableNames, tables),
    [group.tableNames, tables]
  );
  const missing = members.filter((m) => m.table === null);
  const memberNames = new Set(group.tableNames);

  return (
    <div className="border border-border">
      <div className="flex items-center p-2 gap-1">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-2 min-w-0 flex-1 text-left select-none"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
          <span className="text-sm truncate" title={group.name}>
            {group.name}
          </span>
          <span className="text-xs text-muted-foreground shrink-0">
            {group.tableNames.length} table{group.tableNames.length === 1 ? "" : "s"}
          </span>
        </button>

        {missing.length > 0 && (
          <span
            className="text-[11px] text-yellow-600 dark:text-yellow-500 shrink-0"
            title={`Not on this canvas: ${missing.map((m) => m.name).join(", ")}`}
          >
            {missing.length} missing
          </span>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-muted-foreground/60 hover:text-destructive"
          onClick={onDelete}
          title="Delete group"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <CommittedInput
              value={group.name}
              onCommit={onRename}
              placeholder="Group name"
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Tables</label>
            {tables.length === 0 ? (
              <p className="text-xs text-muted-foreground">No tables on this canvas yet.</p>
            ) : (
              <div className="max-h-56 overflow-y-auto border border-border divide-y divide-border">
                {tables.map((t) => (
                  <label
                    key={t.id}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer hover:bg-accent/50"
                  >
                    <input
                      type="checkbox"
                      className="shrink-0"
                      checked={memberNames.has(t.name)}
                      // Stores `table.name` verbatim, schema prefix included:
                      // docs-sidebar.tsx resolves members with an exact compare,
                      // so a stripped or normalized name would silently empty
                      // the group in Docs. See schema-tab-plan.md §3.
                      onChange={() => onPatchMembers((prev) => toggleGroupMember(prev, t.name))}
                    />
                    <span className="font-mono truncate" title={t.name}>
                      {t.name}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {missing.length > 0 && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-yellow-600 dark:text-yellow-500">
                Not on this canvas
              </label>
              <p className="text-[11px] text-muted-foreground">
                Kept as written so the generated DBML still matches your source. Remove one
                if it is no longer wanted.
              </p>
              <div className="space-y-1">
                {missing.map((m) => (
                  <div key={m.name} className="flex items-center gap-1">
                    <span className="font-mono text-xs truncate flex-1" title={m.name}>
                      {m.name}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => onPatchMembers((prev) => prev.filter((n) => n !== m.name))}
                      title="Remove from group"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {members.some((m) => m.table) && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Members</label>
              <div className="flex flex-wrap gap-1">
                {members
                  .filter((m) => m.table)
                  .map((m) => (
                    <button
                      key={m.name}
                      type="button"
                      onClick={() => onSelectTable(m.table!.id)}
                      className="text-[11px] font-mono px-1.5 py-0.5 border border-border hover:bg-accent transition-colors"
                      title={`Select ${m.name}`}
                    >
                      {m.name}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TableGroupsSection() {
  const tableGroups = useCanvasStore((s) => s.tableGroups);
  const tables = useCanvasStore((s) => s.tables);
  const setSelectedTableIds = useCanvasStore((s) => s.setSelectedTableIds);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Same drag-path guard as the enum scan: `tables` is replaced on every
  // pointermove, so the member resolution keys on a structural fingerprint.
  // See release-1-0/schema-tab-plan.md §6.
  //
  // `stableTables` keeps its identity across a drag, so the per-card
  // `resolveGroupMembers` memo below doesn't re-run. It can therefore hold
  // positions one drag behind — harmless, because this section reads only
  // `id` and `name`, both of which are part of the signature.
  const signature = useMemo(() => tablesStructureSignature(tables), [tables]);
  const stableTables = useMemo(
    () => tables,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature]
  );

  // Reads fresh from the store for the same reason the enum section does: a
  // field committing on blur writes between mousedown and click.
  const mutate = (next: (current: CanvasTableGroup[]) => CanvasTableGroup[]) => {
    const store = useCanvasStore.getState();
    store.setTableGroups(next(store.tableGroups));
  };

  const addGroup = () => {
    const created: CanvasTableGroup = {
      id: crypto.randomUUID(),
      name: uniqueName("New group", useCanvasStore.getState().tableGroups.map((g) => g.name)),
      tableNames: [],
    };
    mutate((current) => [...current, created]);
    setExpandedId(created.id);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Named sets of tables. Docs groups its sidebar by these when any exist.
        </p>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1 px-2" onClick={addGroup}>
          <Plus className="w-3 h-3" /> Group
        </Button>
      </div>

      {tableGroups.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          No groups yet. Without them, Docs falls back to grouping by schema prefix.
        </p>
      ) : (
        <div className="space-y-2">
          {tableGroups.map((g) => (
            <TableGroupCard
              key={g.id}
              group={g}
              tables={stableTables}
              isExpanded={expandedId === g.id}
              onToggle={() => setExpandedId(expandedId === g.id ? null : g.id)}
              onRename={(name) =>
                mutate((current) => current.map((x) => (x.id === g.id ? { ...x, name } : x)))
              }
              onPatchMembers={(updater) =>
                mutate((current) =>
                  current.map((x) =>
                    x.id === g.id ? { ...x, tableNames: updater(x.tableNames) } : x
                  )
                )
              }
              onDelete={() => mutate((current) => current.filter((x) => x.id !== g.id))}
              onSelectTable={(tableId) => setSelectedTableIds([tableId])}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Panel ───────────────────────────────────────────────────────────────────

export function SchemaPanel() {
  const project = useCanvasStore((s) => s.project);
  const enumCount = useCanvasStore((s) => s.enums.length);
  const groupCount = useCanvasStore((s) => s.tableGroups.length);
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

        <Section
          title="Enums"
          description={enumCount === 0 ? "None" : `${enumCount} defined`}
          defaultOpen={false}
        >
          <EnumsSection />
        </Section>

        <Section
          title="Table groups"
          description={groupCount === 0 ? "None" : `${groupCount} defined`}
          defaultOpen={false}
        >
          <TableGroupsSection />
        </Section>
      </div>
    </div>
  );
}
