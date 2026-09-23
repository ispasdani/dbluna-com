import type { Table } from "@/store/useCanvasStore";
import { schemaKey, splitSchemaName } from "@/lib/schema-namespace";

/**
 * Schema visibility — which schemas the canvas shows. View state, not content:
 * the hidden set is keyed by schema *key* (`schemaKey`, so the unqualified
 * bucket is `NO_SCHEMA_KEY`), lives in `useEditorStore`, and never reaches the
 * model, the DBML or the cloud. See release-1-0/schemas-tab-and-visibility-plan.md D2.
 *
 * Store-free so it can be unit-tested under vitest's `node` environment.
 */

/** The hidden-set key of the schema a table belongs to. */
export const tableSchemaKey = (table: Pick<Table, "name">): string =>
  schemaKey(splitSchemaName(table.name).schema);

/**
 * Table id → schema key. `splitSchemaName` runs a regex, so callers on the drag
 * path memoise this on a name signature rather than calling it per frame.
 */
export function buildSchemaIndex(tables: Table[]): Map<string, string> {
  return new Map(tables.map((t) => [t.id, tableSchemaKey(t)]));
}

/**
 * The tables the canvas draws.
 *
 * Returns `tables` itself — same identity — when nothing is hidden, and also
 * when every hidden name is stale (its schema no longer exists), so every memo
 * downstream behaves exactly as it would with no filter at all. Stale names are
 * ignored here rather than pruned from the store: pruning on read needs no
 * migration and no store write as a side effect of rendering.
 */
export function filterVisibleTables(
  tables: Table[],
  hidden: readonly string[],
  index?: ReadonlyMap<string, string>
): Table[] {
  if (hidden.length === 0) return tables;
  const hiddenSet = new Set(hidden);
  const keyOf = (t: Table) => index?.get(t.id) ?? tableSchemaKey(t);
  const visible = tables.filter((t) => !hiddenSet.has(keyOf(t)));
  return visible.length === tables.length ? tables : visible;
}

/**
 * The schema keys, among `tableIds`, that are currently hidden — what has to be
 * revealed before the camera can land on those tables. Unknown ids are skipped.
 */
export function hiddenSchemasOf(
  tableIds: readonly string[],
  tables: Table[],
  hidden: readonly string[]
): string[] {
  if (hidden.length === 0) return [];
  const hiddenSet = new Set(hidden);
  const out = new Set<string>();
  for (const id of tableIds) {
    const table = tables.find((t) => t.id === id);
    if (!table) continue;
    const key = tableSchemaKey(table);
    if (hiddenSet.has(key)) out.add(key);
  }
  return [...out];
}

/**
 * The hidden set after a schema rename. Returns `hidden` itself when `from`
 * isn't in it, so a rename with nothing hidden writes nothing.
 */
export function renameInHiddenSet(hidden: readonly string[], from: string, to: string): readonly string[] {
  if (!hidden.includes(from)) return hidden;
  const next = hidden.filter((k) => k !== from && k !== to);
  next.push(to);
  return next;
}
