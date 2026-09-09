import type { CanvasEnum, Table } from "@/store/useCanvasStore";

export interface EnumUsageSite {
  tableId: string;
  tableName: string;
  columnId: string;
  columnName: string;
}

/**
 * Normalizes a type name for enum matching.
 *
 * Docs mode gets away with an exact `e.name === field.type.type_name` compare
 * (see `components/documentation/table-view.tsx`) because it reads the parsed
 * DBML directly. The canvas model has been through two lossy transforms:
 *
 *   - `generateDbmlFromCanvas` emits `col.type.replace(/\s+/g, "_")`
 *   - `parsedTablesToCanvasTables` stores `field.type.type_name.toUpperCase()`
 *
 * So a canvas column typed `order_status` comes back as `ORDER_STATUS` after a
 * single Code-tab round-trip, while the enum stays `order_status`. Matching
 * case-sensitively here would report "unused" for essentially every schema that
 * has ever been through the Code tab.
 */
const normalizeTypeName = (value: string): string =>
  value.trim().replace(/\s+/g, "_").toLowerCase();

/**
 * Every column across the canvas whose type refers to `enumName`.
 * Order follows table order, then column order within a table.
 */
export function findEnumUsage(tables: Table[], enumName: string): EnumUsageSite[] {
  const target = normalizeTypeName(enumName);
  if (!target) return [];

  const sites: EnumUsageSite[] = [];
  for (const table of tables) {
    for (const column of table.columns) {
      if (normalizeTypeName(column.type) === target) {
        sites.push({
          tableId: table.id,
          tableName: table.name,
          columnId: column.id,
          columnName: column.name,
        });
      }
    }
  }
  return sites;
}

/**
 * Usage sites for every enum, keyed by enum id. One pass over the columns
 * rather than one pass per enum, so this stays O(tables x columns) with a
 * constant-time lookup per column instead of O(tables x columns x enums).
 *
 * Callers must memoize this on a structural signature of `tables`, never on the
 * array identity: `updateTablePos` / `moveTables` replace `tables` on every
 * pointermove of a canvas drag. See release-1-0/schema-tab-plan.md §6.
 */
export function buildEnumUsageIndex(
  tables: Table[],
  enums: CanvasEnum[]
): Map<string, EnumUsageSite[]> {
  const index = new Map<string, EnumUsageSite[]>();
  // Normalized enum name -> enum ids. A list, not a single id, so duplicate
  // enum names (possible via hand-written DBML) both light up rather than one
  // silently swallowing the other's usages.
  const byName = new Map<string, string[]>();

  for (const en of enums) {
    index.set(en.id, []);
    const key = normalizeTypeName(en.name);
    if (!key) continue;
    const ids = byName.get(key);
    if (ids) ids.push(en.id);
    else byName.set(key, [en.id]);
  }

  for (const table of tables) {
    for (const column of table.columns) {
      const ids = byName.get(normalizeTypeName(column.type));
      if (!ids) continue;
      const site: EnumUsageSite = {
        tableId: table.id,
        tableName: table.name,
        columnId: column.id,
        columnName: column.name,
      };
      for (const id of ids) index.get(id)!.push(site);
    }
  }

  return index;
}

/**
 * Cheap structural fingerprint of the canvas tables for memo dependencies:
 * changes when a name, column or type changes, but NOT when a table moves.
 * Deliberately excludes x/y so canvas drags don't invalidate derived state.
 */
export function tablesStructureSignature(tables: Table[]): string {
  // Control characters as delimiters: a user-supplied name or type can contain
  // any printable separator we might pick, and an ambiguous join would let two
  // structurally different schemas produce the same signature.
  const F = "\u0001";
  const R = "\u0002";
  let out = "";
  for (const table of tables) {
    out += table.id + F + table.name + F;
    for (const column of table.columns) {
      out += column.id + F + column.name + F + column.type + F;
    }
    out += R;
  }
  return out;
}
