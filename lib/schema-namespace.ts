import type { CanvasTableGroup, Table } from "@/store/useCanvasStore";

/**
 * Schema-namespace helpers for canvas table names.
 *
 * A canvas table name carries its schema inline: `"dbo.Users"`, `"[Ncr].Orders"`.
 * That convention is load-bearing in three places that must agree exactly —
 * `generateDbmlFromCanvas` (emits `Table "dbo"."Users"`), `parsedToCanvasSchemaMeta`
 * (reconstructs the qualified name for table-group members) and the Docs sidebar
 * (groups by prefix). Extracted here so the Schema tab shares one implementation
 * with the generator rather than a lookalike copy that could drift.
 */

export interface SplitSchemaName {
  /** Schema part with any square brackets stripped, or null when unqualified. */
  schema: string | null;
  /** Table part with any square brackets stripped. */
  table: string;
}

/**
 * Splits a canvas table name like "dbo.Users" / "[Ncr].Orders" into its parts.
 *
 * A leading dot (`".Users"`) is not a schema qualifier — `indexOf` returning 0
 * is treated as unqualified, preserving the name verbatim.
 */
export function splitSchemaName(name: string): SplitSchemaName {
  const dotIdx = name.indexOf(".");
  if (dotIdx <= 0) return { schema: null, table: name };
  return {
    schema: name.slice(0, dotIdx).replace(/[[\]]/g, ""),
    table: name.slice(dotIdx + 1).replace(/[[\]]/g, ""),
  };
}

/**
 * The schema @dbml/core assigns to tables declared without one.
 * `parsedTablesToCanvasTables` strips it on the way back in (see
 * `DEFAULT_PARSE_SCHEMA` in lib/parser/dsl-parser.ts), so a canvas table
 * explicitly named `public.Users` does NOT survive a DBML round-trip — it comes
 * back as plain `Users`. That makes "public" unusable as a target schema.
 */
export const DEFAULT_SCHEMA = "public";

/** Re-attaches a schema prefix, or returns the bare table name when unqualified. */
export function qualifySchemaName(schema: string | null, table: string): string {
  return schema ? `${schema}.${table}` : table;
}

export interface SchemaGroup {
  /** null for tables carrying no schema prefix. */
  schema: string | null;
  tables: Table[];
}

/**
 * Groups canvas tables by their schema prefix. Named schemas come first, sorted
 * case-insensitively; unqualified tables land in a trailing `schema: null` group
 * which is omitted when empty.
 *
 * Derived on every call — schemas are not stored anywhere in the model, they
 * exist only as a convention inside table names.
 */
export function groupTablesBySchema(tables: Table[]): SchemaGroup[] {
  const named = new Map<string, Table[]>();
  const unqualified: Table[] = [];

  for (const table of tables) {
    const { schema } = splitSchemaName(table.name);
    if (schema === null) {
      unqualified.push(table);
      continue;
    }
    const bucket = named.get(schema);
    if (bucket) bucket.push(table);
    else named.set(schema, [table]);
  }

  const groups: SchemaGroup[] = [...named.entries()]
    .sort(([a], [b]) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .map(([schema, schemaTables]) => ({ schema, tables: schemaTables }));

  if (unqualified.length > 0) groups.push({ schema: null, tables: unqualified });
  return groups;
}

export interface SchemaEditResult {
  tables: Table[];
  tableGroups: CanvasTableGroup[];
}

export type SchemaEditPlan =
  | { ok: true; result: SchemaEditResult }
  | { ok: false; error: string };

/**
 * Validates a proposed schema name as a rename/move target.
 * Returns null when acceptable, otherwise a user-facing reason.
 */
export function validateSchemaName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Schema name can't be empty.";
  if (trimmed.includes(".")) return "Schema name can't contain a dot.";
  if (trimmed.toLowerCase() === DEFAULT_SCHEMA) {
    return `"${DEFAULT_SCHEMA}" is reserved — DBML drops it on import, so the prefix wouldn't survive a round-trip.`;
  }
  return null;
}

/**
 * Applies a name -> name mapping across tables and table-group members in one
 * pass, so both stay consistent.
 *
 * Rewriting `tables` without `tableGroups` is the single most dangerous thing
 * this section can do: group members are stored as schema-qualified strings and
 * resolved with an exact compare (lib/table-groups.ts), so a rename that misses
 * them silently empties every affected group — including in the Docs sidebar.
 * Relationships need no rewrite: they key off table *ids*, never names.
 */
function applyRenames(
  renames: Map<string, string>,
  tables: Table[],
  tableGroups: CanvasTableGroup[]
): SchemaEditResult {
  // `tableGroups` keeps its original identity when no member was touched, so
  // the caller can skip a second store write (and the second upgrade toast a
  // blocked write would raise) for the common case of no affected groups.
  let anyGroupChanged = false;
  const nextGroups = tableGroups.map((g) => {
    let memberChanged = false;
    const tableNames = g.tableNames.map((n) => {
      const next = renames.get(n);
      if (next === undefined) return n;
      memberChanged = true;
      return next;
    });
    if (!memberChanged) return g;
    anyGroupChanged = true;
    return { ...g, tableNames };
  });

  return {
    tables: tables.map((t) => {
      const next = renames.get(t.name);
      return next === undefined ? t : { ...t, name: next };
    }),
    tableGroups: anyGroupChanged ? nextGroups : tableGroups,
  };
}

/** Names that would collide once `renames` is applied, as "old -> new" pairs. */
function findCollisions(renames: Map<string, string>, tables: Table[]): string[] {
  const finalNames = new Set<string>();
  const collisions: string[] = [];

  for (const table of tables) {
    const next = renames.get(table.name) ?? table.name;
    if (finalNames.has(next)) collisions.push(next);
    else finalNames.add(next);
  }
  return collisions;
}

/**
 * Renames a schema, rewriting every table carrying that prefix plus any table
 * group that references them. Refuses rather than creating duplicate table
 * names.
 */
export function renameSchema(
  from: string,
  to: string,
  tables: Table[],
  tableGroups: CanvasTableGroup[]
): SchemaEditPlan {
  const invalid = validateSchemaName(to);
  if (invalid) return { ok: false, error: invalid };

  const target = to.trim();
  if (target === from) return { ok: true, result: { tables, tableGroups } };

  const renames = new Map<string, string>();
  for (const table of tables) {
    const { schema, table: bare } = splitSchemaName(table.name);
    if (schema !== from) continue;
    renames.set(table.name, qualifySchemaName(target, bare));
  }

  if (renames.size === 0) return { ok: false, error: `No tables are in "${from}".` };

  const collisions = findCollisions(renames, tables);
  if (collisions.length > 0) {
    return {
      ok: false,
      error: `Renaming to "${target}" would collide with existing table${
        collisions.length === 1 ? "" : "s"
      }: ${collisions.join(", ")}.`,
    };
  }

  return { ok: true, result: applyRenames(renames, tables, tableGroups) };
}

/**
 * Moves one table into a schema (or out of every schema when `toSchema` is
 * null), keeping table-group members in step.
 */
export function moveTableToSchema(
  tableId: string,
  toSchema: string | null,
  tables: Table[],
  tableGroups: CanvasTableGroup[]
): SchemaEditPlan {
  if (toSchema !== null) {
    const invalid = validateSchemaName(toSchema);
    if (invalid) return { ok: false, error: invalid };
  }

  const table = tables.find((t) => t.id === tableId);
  if (!table) return { ok: false, error: "That table is no longer on the canvas." };

  const target = toSchema === null ? null : toSchema.trim();
  const { schema, table: bare } = splitSchemaName(table.name);
  if (schema === target) return { ok: true, result: { tables, tableGroups } };

  const nextName = qualifySchemaName(target, bare);
  const renames = new Map([[table.name, nextName]]);

  const collisions = findCollisions(renames, tables);
  if (collisions.length > 0) {
    return { ok: false, error: `A table named "${nextName}" already exists.` };
  }

  return { ok: true, result: applyRenames(renames, tables, tableGroups) };
}
