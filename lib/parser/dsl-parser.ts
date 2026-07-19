import { Parser } from "@dbml/core";
import type {
  Table,
  CanvasEnum,
  CanvasTableGroup,
  CanvasProject,
} from "@/store/useCanvasStore";

// ─────────────────────────────────────────────────────
//  Typed structures extracted from the DBML AST
// ─────────────────────────────────────────────────────

export interface ParsedColumn {
  id: number;
  name: string;
  type: { type_name: string };
  pk: boolean;
  unique: boolean;
  not_null: boolean;
  increment: boolean;
  dbdefault?: { value: any };
  note?: { value: string };
}

export interface ParsedTable {
  id: number;
  name: string;
  schema?: { name: string };
  fields: ParsedColumn[];
  note?: { value: string };
}

export interface ParsedEnumValue {
  name: string;
  note?: { value: string };
}

export interface ParsedEnum {
  id: number;
  name: string;
  schema?: { name: string };
  values: ParsedEnumValue[];
  note?: { value: string };
}

export interface ParsedTableGroup {
  id: number;
  name: string;
  tables: Array<{ tableName: string; schemaName?: string }>;
}

export interface ParsedProject {
  name: string;
  note?: string;
  databaseType?: string;
}

export interface ParsedDbmlResult {
  raw: any; // the full database AST from @dbml/core
  project: ParsedProject | null;
  tables: ParsedTable[];
  enums: ParsedEnum[];
  tableGroups: ParsedTableGroup[];
}

// ─────────────────────────────────────────────────────
//  Parser
// ─────────────────────────────────────────────────────

/**
 * Parses a DBML string and returns a strongly-typed, enriched result.
 * Handles errors gracefully and returns null if parsing fails.
 */
export const parseDbml = (dbmlString: string): ParsedDbmlResult | null => {
  if (!dbmlString || dbmlString.trim() === "") return null;

  try {
    const database = Parser.parse(dbmlString, "dbml");

    // ── Project ──────────────────────────────────────
    let project: ParsedProject | null = null;
    // @dbml/core flattens the `Project { ... }` block onto the database root as
    // `name` / `databaseType` / `note` (there is no `db.project`). `note` may be
    // a bare string or a `{ value }` object depending on version.
    const db = database as any;
    if (db.name || db.note || db.databaseType) {
      const note = typeof db.note === "string" ? db.note : db.note?.value;
      project = {
        name: db.name || "Database Documentation",
        note: note || undefined,
        databaseType: db.databaseType || undefined,
      };
    }

    // ── Tables (flattened across all schemas) ─────────
    const tables: ParsedTable[] = [];
    if (database.schemas) {
      database.schemas.forEach((schema: any) => {
        if (schema.tables) {
          schema.tables.forEach((t: any) => {
            tables.push(t);
          });
        }
      });
    }

    // ── Enums (flattened across all schemas) ──────────
    const enums: ParsedEnum[] = [];
    if (database.schemas) {
      database.schemas.forEach((schema: any) => {
        if (schema.enums) {
          schema.enums.forEach((e: any) => {
            enums.push(e);
          });
        }
      });
    }

    // ── TableGroups ───────────────────────────────────
    const tableGroups: ParsedTableGroup[] = [];
    if (database.schemas) {
      database.schemas.forEach((schema: any) => {
        if (schema.tableGroups) {
          schema.tableGroups.forEach((tg: any) => {
            tableGroups.push({
              id: tg.id,
              name: tg.name,
              tables: (tg.tables || []).map((t: any) => ({
                tableName: t.tableName || t.name,
                schemaName: t.schemaName,
              })),
            });
          });
        }
      });
    }

    return {
      raw: database,
      project,
      tables,
      enums,
      tableGroups,
    };
  } catch (error) {
    console.error("Failed to parse DBML:", error);
    return null;
  }
};

// ─────────────────────────────────────────────────────
//  Parsed DBML → Canvas mapping
// ─────────────────────────────────────────────────────

// @dbml/core assigns tables without an explicit schema to the "public" schema.
// We must not fold that synthetic prefix into canvas table names, otherwise a
// plain `Table users {}` would become "public.users".
const DEFAULT_PARSE_SCHEMA = "public";

const DEFAULT_TABLE_COLOR = "#6366f1";

export interface ParsedToCanvasOptions {
  /** Current canvas tables — used to preserve ids, positions, colors and lock state by name. */
  existingTables: Table[];
  /** World-space anchor for laying out brand-new tables (typically the viewport center). */
  originX: number;
  originY: number;
}

/**
 * Reconstructs the canvas table name from a parsed table, re-attaching the
 * schema prefix (e.g. "dbo.Users") that `generateDbmlFromCanvas` emits as
 * `Table "dbo"."Users"`. Tables in the synthetic "public" schema stay unqualified.
 */
const qualifiedTableName = (table: ParsedTable): string => {
  const schema = table.schema?.name;
  return schema && schema !== DEFAULT_PARSE_SCHEMA ? `${schema}.${table.name}` : table.name;
};

/**
 * Maps parsed DBML tables onto canvas `Table[]`. Existing tables (matched by
 * name) keep their id, position, color and lock state so the diagram doesn't
 * jump; new tables are staggered outward from the supplied origin so they're
 * immediately visible. Columns likewise preserve ids when matched by name.
 */
export const parsedTablesToCanvasTables = (
  parsedTables: ParsedTable[],
  { existingTables, originX, originY }: ParsedToCanvasOptions
): Table[] => {
  return parsedTables.map((dbTable, index) => {
    const name = qualifiedTableName(dbTable);
    const existingTable = existingTables.find((t) => t.name === name);

    const columns = dbTable.fields.map((field) => {
      const existingCol = existingTable?.columns.find((c) => c.name === field.name);
      return {
        id: existingCol?.id ?? crypto.randomUUID(),
        name: field.name,
        type: field.type.type_name.toUpperCase(),
        isPrimaryKey: field.pk || false,
        isNotNull: field.not_null || false,
        isUnique: field.unique || false,
        isAutoIncrement: field.increment || false,
      };
    });

    // Use nullish coalescing (??) so x=0 / y=0 are treated as valid positions.
    const defaultX = originX - 110 + index * 40;
    const defaultY = originY - 60 + index * 40;

    return {
      id: existingTable?.id ?? crypto.randomUUID(),
      name,
      x: existingTable?.x ?? defaultX,
      y: existingTable?.y ?? defaultY,
      color: existingTable?.color ?? DEFAULT_TABLE_COLOR,
      isLocked: existingTable?.isLocked ?? false,
      comment: existingTable?.comment,
      columns,
    };
  });
};

export interface CanvasSchemaMeta {
  enums: CanvasEnum[];
  tableGroups: CanvasTableGroup[];
  project: CanvasProject | null;
}

const qualifiedGroupRef = (ref: { tableName: string; schemaName?: string }): string => {
  const schema = ref.schemaName;
  return schema && schema !== DEFAULT_PARSE_SCHEMA ? `${schema}.${ref.tableName}` : ref.tableName;
};

// @dbml/core is inconsistent: notes arrive as a bare string in some places and
// as a `{ value }` object in others. Normalize to a plain string | undefined.
const noteText = (note: unknown): string | undefined => {
  if (typeof note === "string") return note;
  if (note && typeof note === "object" && "value" in note) {
    return (note as { value?: string }).value;
  }
  return undefined;
};

/**
 * Maps the documentation-oriented parts of a parsed DBML result (enums, table
 * groups, project note) onto the canvas model shapes so they can be stored and
 * re-generated. Table/group names use the same schema-qualification rules as
 * `parsedTablesToCanvasTables`.
 */
export const parsedToCanvasSchemaMeta = (parsed: ParsedDbmlResult): CanvasSchemaMeta => {
  const enums: CanvasEnum[] = parsed.enums.map((en) => ({
    id: crypto.randomUUID(),
    name: en.name,
    note: noteText(en.note),
    values: en.values.map((val) => ({ name: val.name, note: noteText(val.note) })),
  }));

  const tableGroups: CanvasTableGroup[] = parsed.tableGroups.map((group) => ({
    id: crypto.randomUUID(),
    name: group.name,
    tableNames: group.tables.map(qualifiedGroupRef),
  }));

  const project: CanvasProject | null = parsed.project
    ? {
        name: parsed.project.name,
        databaseType: parsed.project.databaseType,
        note: parsed.project.note,
      }
    : null;

  return { enums, tableGroups, project };
};
