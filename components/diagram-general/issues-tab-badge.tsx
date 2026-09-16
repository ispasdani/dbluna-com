"use client";

import { cn } from "@/lib/utils";
import { useDiagramIssues } from "./use-diagram-issues";

/**
 * Error/warning count on the Issues dock tab.
 *
 * Without it the tab is the only place in the app that can tell you something
 * is wrong, and nothing ever points you at it — the same reason drawdb badges
 * its own Issues section. Rendered conditionally by DraggableTabClient so the
 * store subscription exists once, not once per tab.
 */
export function IssuesTabBadge() {
  const { counts } = useDiagramIssues();

  // Suggestions are deliberately not counted: a badge that never clears
  // (every unconnected lookup table raises one) stops meaning anything.
  const count = counts.error + counts.warning;
  if (count === 0) return null;

  const hasErrors = counts.error > 0;

  return (
    <span
      title={`${counts.error} ${counts.error === 1 ? "error" : "errors"}, ${counts.warning} ${
        counts.warning === 1 ? "warning" : "warnings"
      }`}
      className={cn(
        "shrink-0 min-w-4 h-4 px-1 flex items-center justify-center text-[10px] font-semibold leading-none tabular-nums",
        hasErrors
          ? "bg-destructive/15 text-destructive"
          : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
