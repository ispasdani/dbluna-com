"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Database } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCanvasStore, type CanvasProject } from "@/store/useCanvasStore";
import { SQL_DIALECTS } from "@/lib/generator/sql-generator";

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

  // Closing the tab or switching panels unmounts without firing blur, which
  // would drop the pending edit. The latest-ref pattern keeps the cleanup
  // pinned to a single mount/unmount pass instead of re-running per keystroke.
  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  });
  useEffect(() => () => commitRef.current(), []);

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

// ─── Panel ───────────────────────────────────────────────────────────────────

export function SchemaPanel() {
  const project = useCanvasStore((s) => s.project);

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
      </div>
    </div>
  );
}
