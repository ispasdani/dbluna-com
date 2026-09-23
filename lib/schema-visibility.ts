import type { Relationship, Table } from "@/store/useCanvasStore";
import { NO_SCHEMA_KEY, schemaKey, schemaLabel, splitSchemaName } from "@/lib/schema-namespace";

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

export interface SchemaCount {
  schema: string | null;
  /** The hidden-set key: `schemaKey(schema)`. */
  key: string;
  tableCount: number;
}

/**
 * Table count per schema, from table names alone, in `groupTablesBySchema`
 * order — named schemas case-insensitively, the unqualified bucket last and
 * only when non-empty — so every list of schemas reads in the same order.
 */
export function countTablesBySchema(names: readonly string[]): SchemaCount[] {
  const named = new Map<string, number>();
  let unqualified = 0;
  for (const name of names) {
    const { schema } = splitSchemaName(name);
    if (schema === null) unqualified++;
    else named.set(schema, (named.get(schema) ?? 0) + 1);
  }
  const out: SchemaCount[] = [...named.entries()]
    .sort(([a], [b]) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .map(([schema, tableCount]) => ({ schema, key: schemaKey(schema), tableCount }));
  if (unqualified > 0) out.push({ schema: null, key: schemaKey(null), tableCount: unqualified });
  return out;
}

// ─── Cross-schema stubs ──────────────────────────────────────────────────

export interface CrossSchemaStubTarget {
  tableId: string;
  name: string;
  schemaKey: string;
}

/**
 * A hint drawn where a relationship leaves the view: one per visible column
 * that is joined to a table in a hidden schema. Several hidden tables on one
 * column share one stub, so a heavily referenced key draws one hint, not dozens.
 */
export interface CrossSchemaStub {
  /** The visible end. */
  tableId: string;
  columnId: string;
  /** The hidden ends, deduplicated, in relationship order. */
  targets: CrossSchemaStubTarget[];
}

/**
 * Where relationships cross into hidden schemas. Reads only ids and names, so
 * callers can memoise it on a name signature rather than on positions — it
 * then runs on a rename or a visibility change, never during a drag.
 * Relationships with both ends visible, both ends hidden, or a dangling end
 * produce nothing.
 */
export function buildCrossSchemaStubs(
  tables: readonly Pick<Table, "id" | "name">[],
  relationships: readonly Pick<Relationship, "sourceTableId" | "sourceColumnId" | "targetTableId" | "targetColumnId">[],
  hidden: readonly string[]
): CrossSchemaStub[] {
  if (hidden.length === 0 || relationships.length === 0) return [];
  const hiddenSet = new Set(hidden);
  const byId = new Map(tables.map((t) => [t.id, t]));
  const stubs = new Map<string, CrossSchemaStub>();

  const add = (visibleTableId: string, columnId: string, target: Pick<Table, "id" | "name">, key: string) => {
    const id = `${visibleTableId}\u0000${columnId}`;
    let stub = stubs.get(id);
    if (!stub) {
      stub = { tableId: visibleTableId, columnId, targets: [] };
      stubs.set(id, stub);
    }
    if (!stub.targets.some((t) => t.tableId === target.id)) {
      stub.targets.push({ tableId: target.id, name: target.name, schemaKey: key });
    }
  };

  for (const rel of relationships) {
    const a = byId.get(rel.sourceTableId);
    const b = byId.get(rel.targetTableId);
    if (!a || !b) continue;
    const aKey = tableSchemaKey(a);
    const bKey = tableSchemaKey(b);
    const aHidden = hiddenSet.has(aKey);
    const bHidden = hiddenSet.has(bKey);
    if (aHidden === bHidden) continue;
    if (bHidden) add(a.id, rel.sourceColumnId, b, bKey);
    else add(b.id, rel.targetColumnId, a, aKey);
  }
  return [...stubs.values()];
}

/** The short text on a stub: the table itself when there is one, else a count. */
export function crossSchemaStubLabel(stub: CrossSchemaStub): string {
  const { targets } = stub;
  if (targets.length === 1) return targets[0].name;
  const schemas = new Set(targets.map((t) => t.schemaKey));
  if (schemas.size === 1) {
    const key = targets[0].schemaKey;
    return `${targets.length} in ${schemaLabel(key === NO_SCHEMA_KEY ? null : key)}`;
  }
  return `${targets.length} hidden tables`;
}
