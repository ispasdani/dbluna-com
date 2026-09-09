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
  type EnumValue,
} from "@/store/useCanvasStore";
import { SQL_DIALECTS } from "@/lib/generator/sql-generator";
import {
  buildEnumUsageIndex,
  tablesStructureSignature,
  type EnumUsageSite,
} from "@/lib/enum-usage";

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

// ─── Panel ───────────────────────────────────────────────────────────────────

export function SchemaPanel() {
  const project = useCanvasStore((s) => s.project);
  const enumCount = useCanvasStore((s) => s.enums.length);

  const projectSummary =
    [project?.name, project?.databaseType].filter(Boolean).join(" · ") || "Not set";

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

        <Section
          title="Enums"
          description={enumCount === 0 ? "None" : `${enumCount} defined`}
          defaultOpen={false}
        >
          <EnumsSection />
        </Section>
      </div>
    </div>
  );
}
