import type { CanvasTableGroup, Relationship, Table } from "@/store/useCanvasStore";
import { schemaKey, schemaLabel, splitSchemaName } from "@/lib/schema-namespace";
import { findFkClusters } from "@/lib/fk-clusters";

/**
 * What "a group of tables" means for visibility, the schema graph and the
 * toolbar's switcher. Three sources, one shape, one visibility model — see
 * release-1-0/schemas-tab-and-visibility-plan.md D6 and Phase 6:
 *
 * - `schema`     — the `schema.` prefix on table names (derived, from the database)
 * - `tableGroup` — DBML `TableGroup` blocks (explicit, authored in the Code tab)
 * - `fkCluster`  — clusters of tables joined by foreign keys (computed, for
 *                  databases with no schemas, like MySQL)
 *
 * Every source produces groups and a table-id → group-key index. Keys live in
 * one hidden set per diagram, so they are namespaced per source: schema keys
 * are the bare `schemaKey` (unchanged from before there were sources) and the
 * others carry a control-character prefix no schema name can contain. Switching
 * source therefore keeps each source's hidden set: another source's keys just
 * match no table, and stale keys are ignored rather than pruned.
 *
 * Store-free so it can be unit-tested under vitest's `node` environment.
 */

export type GroupSource = "schema" | "tableGroup" | "fkCluster";

export const GROUP_SOURCES: { id: GroupSource; label: string; noun: string; plural: string }[] = [
  { id: "schema", label: "Schemas", noun: "schema", plural: "schemas" },
  { id: "tableGroup", label: "Table groups", noun: "group", plural: "groups" },
  { id: "fkCluster", label: "Relationships", noun: "cluster", plural: "clusters" },
];

export const sourceInfo = (source: GroupSource) => GROUP_SOURCES.find((s) => s.id === source)!;

const TG_PREFIX = "\u0001tg:";
const FK_PREFIX = "\u0001fk:";
/** Tables in no TableGroup. */
export const TG_NONE_KEY = `${TG_PREFIX}\u0000none`;
/** Tables with no relationship to any other table. */
export const FK_NONE_KEY = `${FK_PREFIX}\u0000none`;

export interface TableGroupInfo {
  key: string;
  label: string;
  tableIds: string[];
  /** The catch-all bucket — "(no schema)", "Not in a group", "No relationships". */
  isRemainder: boolean;
  /** For the `schema` source: the schema name, `null` for unqualified tables. */
  schema?: string | null;
}

export interface TableGrouping {
  source: GroupSource;
  groups: TableGroupInfo[];
  /** Every table's group key. A table missing here (added since) counts as visible. */
  keyByTableId: Map<string, string>;
  labelOf: (key: string) => string;
}

type TableLike = Pick<Table, "id" | "name">;

export function buildGrouping(
  source: GroupSource,
  tables: readonly TableLike[],
  relationships: readonly Pick<Relationship, "sourceTableId" | "targetTableId">[],
  tableGroups: readonly CanvasTableGroup[]
): TableGrouping {
  const groups =
    source === "tableGroup"
      ? byTableGroup(tables, tableGroups)
      : source === "fkCluster"
        ? byFkCluster(tables, relationships)
        : bySchema(tables);

  const keyByTableId = new Map<string, string>();
  const labels = new Map<string, string>();
  for (const g of groups) {
    labels.set(g.key, g.label);
    for (const id of g.tableIds) keyByTableId.set(id, g.key);
  }
  return { source, groups, keyByTableId, labelOf: (key) => labels.get(key) ?? key };
}

/** `groupTablesBySchema` order: named schemas case-insensitively, unqualified last. */
function bySchema(tables: readonly TableLike[]): TableGroupInfo[] {
  const named = new Map<string, string[]>();
  const unqualified: string[] = [];
  for (const t of tables) {
    const { schema } = splitSchemaName(t.name);
    if (schema === null) unqualified.push(t.id);
    else {
      const bucket = named.get(schema);
      if (bucket) bucket.push(t.id);
      else named.set(schema, [t.id]);
    }
  }
  const out: TableGroupInfo[] = [...named.entries()]
    .sort(([a], [b]) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .map(([schema, tableIds]) => ({ key: schemaKey(schema), label: schema, tableIds, isRemainder: false, schema }));
  if (unqualified.length > 0) {
    out.push({ key: schemaKey(null), label: schemaLabel(null), tableIds: unqualified, isRemainder: true, schema: null });
  }
  return out;
}

/**
 * Declared order, like the Docs sidebar. Members are qualified table names; a
 * table listed in two groups belongs to the first (DBML allows one), and a
 * group none of whose members exist is left out.
 */
function byTableGroup(tables: readonly TableLike[], tableGroups: readonly CanvasTableGroup[]): TableGroupInfo[] {
  const idByName = new Map(tables.map((t) => [t.name, t.id]));
  const taken = new Set<string>();
  const out: TableGroupInfo[] = [];
  for (const group of tableGroups) {
    const tableIds: string[] = [];
    for (const name of group.tableNames) {
      const id = idByName.get(name);
      if (id === undefined || taken.has(id)) continue;
      taken.add(id);
      tableIds.push(id);
    }
    if (tableIds.length > 0) {
      out.push({ key: `${TG_PREFIX}${group.name}`, label: group.name, tableIds, isRemainder: false });
    }
  }
  const rest = tables.filter((t) => !taken.has(t.id)).map((t) => t.id);
  if (rest.length > 0) out.push({ key: TG_NONE_KEY, label: "Not in a group", tableIds: rest, isRemainder: true });
  return out;
}

/**
 * Largest cluster first. Each is named after its most connected table — the
 * one the rest hang off — and keyed by that table's id, so the key survives a
 * rename; it moves only if the clustering itself changes.
 */
function byFkCluster(
  tables: readonly TableLike[],
  relationships: readonly Pick<Relationship, "sourceTableId" | "targetTableId">[]
): TableGroupInfo[] {
  const nameById = new Map(tables.map((t) => [t.id, t.name]));
  const { clusters, isolated } = findFkClusters(
    tables.map((t) => t.id),
    relationships
  );
  const out: TableGroupInfo[] = clusters
    .map((tableIds) => ({
      key: `${FK_PREFIX}${tableIds[0]}`,
      label: nameById.get(tableIds[0]) ?? "",
      tableIds,
      isRemainder: false,
    }))
    .sort((a, b) => b.tableIds.length - a.tableIds.length || a.label.toLowerCase().localeCompare(b.label.toLowerCase()));
  if (isolated.length > 0) out.push({ key: FK_NONE_KEY, label: "No relationships", tableIds: isolated, isRemainder: true });
  return out;
}
