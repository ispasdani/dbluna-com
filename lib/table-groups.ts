import type { CanvasTableGroup, Table } from "@/store/useCanvasStore";

export interface ResolvedGroupMember {
  /** The stored `tableNames` entry, verbatim. */
  name: string;
  /** The canvas table it refers to, or null when nothing matches. */
  table: Table | null;
}

/**
 * Resolves a table group's members against the canvas tables.
 *
 * The match is **exact and case-sensitive**, unlike enum-type matching. Both
 * sides come from the same schema-qualification rule and neither is case-folded
 * on the way through DBML:
 *
 *   - `generateDbmlFromCanvas` emits `"dbo"."Users"` for the canvas name `dbo.Users`
 *   - `parsedTablesToCanvasTables` rebuilds `dbo.Users` via `qualifiedTableName`
 *   - `parsedToCanvasSchemaMeta` rebuilds the member ref via `qualifiedGroupRef`
 *
 * `components/documentation/docs-sidebar.tsx` resolves the same references with
 * the same exact compare, so loosening it here would make the Schema tab and
 * Docs disagree about what a group contains.
 *
 * Unresolvable entries are returned with `table: null` rather than dropped —
 * hand-written DBML can reference a table that doesn't exist, and silently
 * discarding it would rewrite the user's schema on the next regenerate.
 */
export function resolveGroupMembers(
  tableNames: string[],
  tables: Table[]
): ResolvedGroupMember[] {
  const byName = new Map<string, Table>();
  // First writer wins, matching the `tables.find(...)` the Docs sidebar uses:
  // duplicate table names are reachable (the Issues tab reports them) and both
  // surfaces must pick the same one.
  for (const table of tables) {
    if (!byName.has(table.name)) byName.set(table.name, table);
  }

  return tableNames.map((name) => ({ name, table: byName.get(name) ?? null }));
}

/** Adds or removes a table name from a group's member list, preserving order. */
export function toggleGroupMember(tableNames: string[], name: string): string[] {
  return tableNames.includes(name)
    ? tableNames.filter((n) => n !== name)
    : [...tableNames, name];
}

/**
 * Every table name currently claimed by some group, so the picker can show
 * which tables already belong elsewhere. Groups may legitimately overlap; this
 * is for display, not enforcement.
 */
export function claimedTableNames(groups: CanvasTableGroup[]): Set<string> {
  const claimed = new Set<string>();
  for (const group of groups) {
    for (const name of group.tableNames) claimed.add(name);
  }
  return claimed;
}
