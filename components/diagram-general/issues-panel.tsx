"use client";

import { useMemo, useState, type CSSProperties } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Info,
  Search,
  Table2,
  X,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { Issue, IssueSeverity } from "@/lib/diagram-issues";
import { useCanvasStore } from "@/store/useCanvasStore";
import { useDockStore } from "@/store/useDockStore";
import { usePanelStyle } from "@/store/usePanelStyleStore";
import { TableGlyph } from "./panel-glyphs";
import { focusTableOnCanvas, useDiagramIssues } from "./use-diagram-issues";
import styles from "./issues-panel.module.scss";

type GroupBy = "table" | "severity" | "category";

const SEVERITIES: IssueSeverity[] = ["error", "warning", "info"];

const SEVERITY_LABEL: Record<IssueSeverity, { one: string; many: string }> = {
  error: { one: "Error", many: "Errors" },
  warning: { one: "Warning", many: "Warnings" },
  info: { one: "Suggestion", many: "Suggestions" },
};

const CATEGORY_LABEL: Record<Issue["category"], string> = {
  naming: "Naming",
  structure: "Structure",
  keys: "Keys",
  types: "Types",
  relationships: "Relationships",
  enums: "Enums",
};

// One place for the severity icon and colour, so the filter chip, the group
// counts and the row icon can never drift apart.
const SEVERITY_ICON: Record<IssueSeverity, LucideIcon> = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};
const sev = (severity: IssueSeverity) => ({ "--sc": `var(--sev-${severity})` }) as CSSProperties;

const GROUP_BY: { id: GroupBy; label: string }[] = [
  { id: "table", label: "Table" },
  { id: "severity", label: "Severity" },
  { id: "category", label: "Category" },
];

interface IssueGroup {
  key: string;
  label: string;
  issues: Issue[];
  /** Set when the group is a table, so the card takes the table's colour. */
  tableId?: string;
  /** Set when grouping by severity. */
  severity?: IssueSeverity;
}

export function IssuesPanel() {
  const { issues, counts } = useDiagramIssues();
  // Only ids and colours, as a string, so dragging tables (which replaces the
  // array every pointermove) doesn't re-render the whole issue list.
  const colorKey = useCanvasStore((s) => s.tables.map((t) => `${t.id}=${t.color}`).join("|"));
  const hasTables = colorKey !== "";
  const setSelectedTableIds = useCanvasStore((s) => s.setSelectedTableIds);
  const setSelectedRelationshipId = useCanvasStore((s) => s.setSelectedRelationshipId);
  const openTab = useDockStore((s) => s.openTab);
  const { variant } = usePanelStyle("issues");

  const [mutedSeverities, setMutedSeverities] = useState<Set<IssueSeverity>>(() => new Set());
  const [query, setQuery] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("table");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [activeIssueId, setActiveIssueId] = useState<string | null>(null);

  const tableColor = useMemo(
    () =>
      new Map(
        colorKey
          .split("|")
          .filter(Boolean)
          .map((entry) => entry.split("=") as [string, string])
      ),
    [colorKey]
  );

  const visibleIssues = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return issues.filter((issue) => {
      if (mutedSeverities.has(issue.severity)) return false;
      if (!needle) return true;
      return (
        issue.message.toLowerCase().includes(needle) ||
        issue.groupLabel.toLowerCase().includes(needle) ||
        issue.rule.includes(needle)
      );
    });
  }, [issues, mutedSeverities, query]);

  const groups = useMemo<IssueGroup[]>(() => {
    const byKey = new Map<string, IssueGroup>();

    for (const issue of visibleIssues) {
      const group: Omit<IssueGroup, "issues"> =
        groupBy === "table"
          ? { key: issue.groupKey, label: issue.groupLabel, tableId: issue.tableId }
          : groupBy === "severity"
            ? { key: issue.severity, label: SEVERITY_LABEL[issue.severity].many, severity: issue.severity }
            : { key: issue.category, label: CATEGORY_LABEL[issue.category] };

      const existing = byKey.get(group.key);
      if (existing) existing.issues.push(issue);
      else byKey.set(group.key, { ...group, issues: [issue] });
    }

    const list = [...byKey.values()];
    if (groupBy === "severity") {
      const order: Record<string, number> = { error: 0, warning: 1, info: 2 };
      return list.sort((a, b) => order[a.key] - order[b.key]);
    }
    // Worst-first, so the group that needs attention is at the top of a long list.
    const worst = (g: IssueGroup) =>
      g.issues.some((i) => i.severity === "error") ? 0 : g.issues.some((i) => i.severity === "warning") ? 1 : 2;
    return list.sort((a, b) => worst(a) - worst(b) || a.label.localeCompare(b.label));
  }, [visibleIssues, groupBy]);

  const toggleSeverity = (severity: IssueSeverity) =>
    setMutedSeverities((prev) => {
      const next = new Set(prev);
      if (next.has(severity)) next.delete(severity);
      else next.add(severity);
      return next;
    });

  const toggleGroup = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const clearFilters = () => {
    setQuery("");
    setMutedSeverities(new Set());
  };

  /**
   * Select the thing the issue is about and bring it into view. Enum and
   * table-group findings have no canvas presence, so those open the tab that
   * can actually fix them instead.
   */
  const handleIssueClick = (issue: Issue) => {
    setActiveIssueId(issue.id);

    if (issue.tableId) {
      setSelectedTableIds([issue.tableId]);
      focusTableOnCanvas(issue.tableId);
      if (issue.relationshipId) setSelectedRelationshipId(issue.relationshipId);
      return;
    }

    if (issue.enumId) {
      openTab("enums");
      return;
    }

    if (issue.relationshipId) {
      setSelectedRelationshipId(issue.relationshipId);
      openTab("relationships");
      return;
    }

    if (issue.rule === "table-group-unknown-member") openTab("code");
  };

  const groupTint = (group: IssueGroup): CSSProperties => {
    if (group.tableId) return { "--tc": tableColor.get(group.tableId) ?? "var(--primary)" } as CSSProperties;
    if (group.severity) return { "--tc": `var(--sev-${group.severity})` } as CSSProperties;
    return { "--tc": "var(--primary)" } as CSSProperties;
  };

  const onKey = (e: React.KeyboardEvent, fn: () => void) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  };

  const isFiltered = mutedSeverities.size > 0 || query.trim() !== "";

  const renderGroup = (group: IssueGroup) => {
    const isCollapsed = collapsed.has(group.key);
    const GroupIcon = group.severity ? SEVERITY_ICON[group.severity] : null;

    return (
      <div
        key={group.key}
        className={cn(styles.tb, styles.card, styles.group, isCollapsed && styles.closed)}
        style={groupTint(group)}
      >
        <div
          className={styles.tbHead}
          role="button"
          tabIndex={0}
          aria-expanded={!isCollapsed}
          onClick={() => toggleGroup(group.key)}
          onKeyDown={(e) => onKey(e, () => toggleGroup(group.key))}
        >
          <span className={styles.chev}>
            <ChevronDown className="w-3 h-3" />
          </span>
          <span className={styles.mk}>
            {GroupIcon ? <GroupIcon className="w-3 h-3" /> : <TableGlyph />}
          </span>
          <span className={styles.tname} title={group.label}>
            {group.label}
          </span>
          <span className={styles.sevCounts}>
            {SEVERITIES.map((severity) => {
              const n = group.issues.filter((i) => i.severity === severity).length;
              if (n === 0) return null;
              const Icon = SEVERITY_ICON[severity];
              return (
                <span key={severity} className={styles.sevCount} style={sev(severity)} title={SEVERITY_LABEL[severity].many}>
                  <Icon className="w-3 h-3" />
                  <span className={styles.trim}>{n}</span>
                </span>
              );
            })}
          </span>
        </div>

        {!isCollapsed && (
          <div className={styles.issues}>
            {group.issues.map((issue) => {
              const Icon = SEVERITY_ICON[issue.severity];
              return (
                <button
                  key={issue.id}
                  type="button"
                  className={cn(styles.issue, issue.id === activeIssueId && styles.activeIssue)}
                  style={sev(issue.severity)}
                  onClick={() => handleIssueClick(issue)}
                >
                  <Icon className="w-3.5 h-3.5" aria-label={SEVERITY_LABEL[issue.severity].one} />
                  <span className={styles.issueText}>
                    <span className={styles.message}>{issue.message}</span>
                    {issue.hint && <span className={styles.hintText}>{issue.hint}</span>}
                    {groupBy !== "table" && <span className={styles.scope}>{issue.groupLabel}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.panel} data-v={variant}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h3>Issues</h3>
          {counts.total > 0 && <span className={styles.count}>{counts.total}</span>}
          <span className={styles.spacer} />
          {counts.total === 0 && hasTables && (
            <span className={cn(styles.summary, styles.clean)}>Schema is clean</span>
          )}
        </div>

        {counts.total > 0 && (
          <>
            {/* Severity filters double as the count summary — one control
                instead of a static legend the user can't act on. */}
            <div className={styles.sevChips}>
              {SEVERITIES.map((severity) => {
                const Icon = SEVERITY_ICON[severity];
                const count = counts[severity];
                const muted = mutedSeverities.has(severity);
                const label = count === 1 ? SEVERITY_LABEL[severity].one : SEVERITY_LABEL[severity].many;
                return (
                  <button
                    key={severity}
                    type="button"
                    style={sev(severity)}
                    aria-pressed={!muted}
                    title={`${muted ? "Show" : "Hide"} ${SEVERITY_LABEL[severity].many.toLowerCase()}`}
                    onClick={() => toggleSeverity(severity)}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <b className={styles.trim}>{count}</b>
                    <span className={styles.trim}>{label}</span>
                  </button>
                );
              })}
            </div>

            <div className={styles.filterRow}>
              <label className={styles.search}>
                <Search className="w-3.5 h-3.5 shrink-0" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter issues"
                  aria-label="Filter issues"
                />
                {query && (
                  <button type="button" className={styles.clearBtn} onClick={() => setQuery("")} aria-label="Clear filter">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </label>
              <div className={styles.seg} role="group" aria-label="Group issues by">
                {GROUP_BY.map(({ id, label }) => (
                  <button key={id} type="button" aria-pressed={groupBy === id} onClick={() => setGroupBy(id)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div className={styles.body}>
        {!hasTables ? (
          <EmptyState
            icon={<Table2 className={cn("w-9 h-9", styles.emptyIcon)} />}
            title="Nothing to check yet"
            body="Add a table to the canvas and this tab will start reviewing your schema."
          />
        ) : issues.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className={cn("w-9 h-9", styles.emptyIconClean)} />}
            title="No issues found"
            body="Names, keys, types and relationships all check out."
          />
        ) : visibleIssues.length === 0 ? (
          <EmptyState
            icon={<Search className={cn("w-9 h-9", styles.emptyIcon)} />}
            title="No matching issues"
            body={`${counts.total} ${counts.total === 1 ? "issue is" : "issues are"} hidden by the current filter.`}
            action={
              <button type="button" className={styles.textLink} onClick={clearFilters}>
                Clear filters
              </button>
            }
          />
        ) : (
          <div className={styles.list}>
            {groups.map(renderGroup)}
            {isFiltered && (
              <p className={styles.footnote}>
                Showing {visibleIssues.length} of {counts.total}.{" "}
                <button type="button" className={styles.textLink} onClick={clearFilters}>
                  Clear filters
                </button>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={styles.emptyState}>
      {icon}
      <p className={styles.emptyTitle}>{title}</p>
      <p>{body}</p>
      {action}
    </div>
  );
}
