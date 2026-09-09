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
