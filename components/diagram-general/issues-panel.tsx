"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Info,
  Search,
  Table2,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { Issue, IssueSeverity } from "@/lib/diagram-issues";
import { useCanvasStore } from "@/store/useCanvasStore";
import { useDockStore } from "@/store/useDockStore";
import { focusTableOnCanvas, useDiagramIssues } from "./use-diagram-issues";

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

// One place for the severity palette so the icon, the filter chip and the row
// accent can never drift apart. Amber rather than `text-yellow-600`: the old
// value was close to unreadable against the Tokyo Night dock surface.
const SEVERITY_STYLES: Record<
  IssueSeverity,
  { icon: typeof AlertCircle; text: string; accent: string; chipOn: string }
> = {
  error: {
    icon: AlertCircle,
    text: "text-destructive",
    accent: "border-l-destructive",
    chipOn: "bg-destructive/10 text-destructive border-destructive/30",
  },
  warning: {
    icon: AlertTriangle,
    text: "text-amber-600 dark:text-amber-400",
    accent: "border-l-amber-500",
    chipOn:
      "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  },
  info: {
    icon: Info,
    text: "text-sky-600 dark:text-sky-400",
    accent: "border-l-sky-500",
    chipOn: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30",
  },
};

interface IssueGroup {
  key: string;
  label: string;
  issues: Issue[];
  /** Set when the group is a table, so the header itself can navigate. */
  tableId?: string;
}

export function IssuesPanel() {
  const { issues, counts } = useDiagramIssues();
  const hasTables = useCanvasStore((s) => s.tables.length > 0);
  const setSelectedTableIds = useCanvasStore((s) => s.setSelectedTableIds);
  const setSelectedRelationshipId = useCanvasStore((s) => s.setSelectedRelationshipId);
  const openTab = useDockStore((s) => s.openTab);

  const [mutedSeverities, setMutedSeverities] = useState<Set<IssueSeverity>>(
    () => new Set()
  );
  const [query, setQuery] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("table");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [activeIssueId, setActiveIssueId] = useState<string | null>(null);

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
      const [key, label, tableId] =
        groupBy === "table"
          ? [issue.groupKey, issue.groupLabel, issue.tableId]
          : groupBy === "severity"
            ? [issue.severity, SEVERITY_LABEL[issue.severity].many, undefined]
            : [issue.category, CATEGORY_LABEL[issue.category], undefined];

      const existing = byKey.get(key);
      if (existing) existing.issues.push(issue);
      else byKey.set(key, { key, label, issues: [issue], tableId });
    }

    const list = [...byKey.values()];
    if (groupBy === "severity") {
      const order: Record<string, number> = { error: 0, warning: 1, info: 2 };
      return list.sort((a, b) => order[a.key] - order[b.key]);
    }
    // Worst-first, so the group that needs attention is at the top of a long list.
    const worst = (g: IssueGroup) =>
      g.issues.some((i) => i.severity === "error")
        ? 0
        : g.issues.some((i) => i.severity === "warning")
          ? 1
          : 2;
    return list.sort((a, b) => worst(a) - worst(b) || a.label.localeCompare(b.label));
  }, [visibleIssues, groupBy]);

  const toggleSeverity = (severity: IssueSeverity) => {
    setMutedSeverities((prev) => {
      const next = new Set(prev);
      if (next.has(severity)) next.delete(severity);
      else next.add(severity);
      return next;
    });
  };

  const toggleGroup = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
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

  const isFiltered = mutedSeverities.size > 0 || query.trim() !== "";

  return (
    <div className="h-full flex flex-col bg-background">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-border">
        <div className="p-4 pb-3 space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-medium text-foreground">Issues</h3>
            <span className="text-xs text-muted-foreground">
              {counts.total === 0
                ? "Schema is clean"
                : `${counts.total} ${counts.total === 1 ? "finding" : "findings"}`}
            </span>
          </div>

          {/* Severity filters double as the count summary — one control instead
              of a static legend the user can't act on. */}
          <div className="flex flex-wrap gap-1.5">
            {SEVERITIES.map((severity) => {
              const style = SEVERITY_STYLES[severity];
              const Icon = style.icon;
              const count = counts[severity];
              const muted = mutedSeverities.has(severity);
              return (
                <button
                  key={severity}
                  type="button"
                  aria-pressed={!muted}
                  onClick={() => toggleSeverity(severity)}
                  title={
                    muted
                      ? `Show ${SEVERITY_LABEL[severity].many.toLowerCase()}`
                      : `Hide ${SEVERITY_LABEL[severity].many.toLowerCase()}`
                  }
                  className={cn(
                    "inline-flex items-center gap-1.5 border px-2 py-1 text-xs font-medium transition-colors cursor-pointer",
                    muted
                      ? "border-border text-muted-foreground/60 hover:text-muted-foreground"
                      : style.chipOn
                  )}
                >
                  <Icon className={cn("w-3.5 h-3.5", muted && "opacity-50")} />
                  <span className="tabular-nums">{count}</span>
                  <span>
                    {count === 1
                      ? SEVERITY_LABEL[severity].one
                      : SEVERITY_LABEL[severity].many}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter issues…"
                aria-label="Filter issues"
                className="w-full h-8 border border-input bg-background pl-7 pr-7 text-sm outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear filter"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupBy)}
              aria-label="Group issues by"
              className="h-8 shrink-0 border border-input bg-background px-2 text-xs text-muted-foreground outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
            >
              <option value="table">By table</option>
              <option value="severity">By severity</option>
              <option value="category">By category</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {!hasTables ? (
          <EmptyState
            icon={<Table2 className="w-10 h-10 text-muted-foreground/40" />}
            title="Nothing to check yet"
            body="Add a table to the canvas and this tab will start reviewing your schema."
          />
        ) : issues.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="w-10 h-10 text-emerald-500/60" />}
            title="No issues found"
            body="Names, keys, types and relationships all check out."
          />
        ) : visibleIssues.length === 0 ? (
          <EmptyState
            icon={<Search className="w-10 h-10 text-muted-foreground/40" />}
            title="No matching issues"
            body={`${counts.total} ${counts.total === 1 ? "issue is" : "issues are"} hidden by the current filter.`}
            action={
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setMutedSeverities(new Set());
                }}
                className="text-xs font-medium text-primary hover:underline cursor-pointer"
              >
                Clear filters
              </button>
            }
          />
        ) : (
          <div className="p-2 space-y-2">
            {groups.map((group) => {
              const isCollapsed = collapsed.has(group.key);
              return (
                <div key={group.key} className="border border-border">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.key)}
                    aria-expanded={!isCollapsed}
                    className="w-full flex items-center gap-2 p-2 bg-card text-left select-none hover:bg-accent transition-colors cursor-pointer"
                  >
                      {isCollapsed ? (
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-sm font-medium truncate">{group.label}</span>
                      <span className="ml-auto shrink-0 flex items-center gap-1.5 pl-2">
                        {SEVERITIES.map((severity) => {
                          const n = group.issues.filter(
                            (i) => i.severity === severity
                          ).length;
                          if (n === 0) return null;
                          const Icon = SEVERITY_STYLES[severity].icon;
                          return (
                            <span
                              key={severity}
                              className={cn(
                                "inline-flex items-center gap-0.5 text-xs tabular-nums",
                                SEVERITY_STYLES[severity].text
                              )}
                            >
                              <Icon className="w-3 h-3" />
                              {n}
                            </span>
                          );
                        })}
                    </span>
                  </button>

                  {!isCollapsed && (
                    <ul className="border-t border-border">
                      {group.issues.map((issue) => (
                        <IssueRow
                          key={issue.id}
                          issue={issue}
                          isActive={issue.id === activeIssueId}
                          showScope={groupBy !== "table"}
                          onSelect={handleIssueClick}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}

            {isFiltered && (
              <p className="px-1 py-2 text-xs text-muted-foreground">
                Showing {visibleIssues.length} of {counts.total}.{" "}
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setMutedSeverities(new Set());
                  }}
                  className="font-medium text-primary hover:underline cursor-pointer"
                >
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

function IssueRow({
  issue,
  isActive,
  showScope,
  onSelect,
}: {
  issue: Issue;
  isActive: boolean;
  showScope: boolean;
  onSelect: (issue: Issue) => void;
}) {
  const style = SEVERITY_STYLES[issue.severity];
  const Icon = style.icon;

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(issue)}
        className={cn(
          "w-full text-left px-2 py-2 border-l-2 text-sm transition-colors hover:bg-accent cursor-pointer",
          style.accent,
          isActive ? "bg-accent" : "bg-background"
        )}
      >
        <div className="flex items-start gap-2">
          <Icon className={cn("w-4 h-4 shrink-0 mt-0.5", style.text)} />
          <div className="min-w-0 flex-1">
            <p className="text-foreground/90 break-words">{issue.message}</p>
            {issue.hint && (
              <p className="mt-0.5 text-xs text-muted-foreground break-words">
                {issue.hint}
              </p>
            )}
            {showScope && (
              <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground/70">
                {issue.groupLabel}
              </p>
            )}
          </div>
        </div>
      </button>
    </li>
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
    <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
      {icon}
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground max-w-[34ch]">{body}</p>
      {action}
    </div>
  );
}
