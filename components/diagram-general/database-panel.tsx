"use client";

import { useCallback, useState, type CSSProperties } from "react";
import { ChevronDown } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCanvasStore, type CanvasProject } from "@/store/useCanvasStore";
import { usePanelStyle } from "@/store/usePanelStyleStore";
import { SQL_DIALECTS } from "@/lib/generator/sql-generator";
import { splitSchemaName } from "@/lib/schema-namespace";
import { cn } from "@/lib/utils";
import { useCommitOnUnmount } from "./committed-input";
import { DatabaseGlyph } from "./panel-glyphs";
import styles from "./database-panel.module.scss";

const ACCENT = { "--tc": "var(--primary)" } as CSSProperties;

const onKey = (e: React.KeyboardEvent, fn: () => void) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fn();
  }
};

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
          This diagram is one database. Its schemas are in the Schemas tab, and its tables in the Tables tab.
        </p>
      </div>

      <div className={styles.body}>
        <div className={styles.list}>
          <ProjectCard />
        </div>
      </div>
    </div>
  );
}
