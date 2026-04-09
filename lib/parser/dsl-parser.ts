import { Parser } from "@dbml/core";

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
    // @dbml/core's Database type doesn't expose `project` in its TS types but it exists at runtime
    const db = database as any;
    if (db.project) {
      project = {
        name: db.project.name || "Database Documentation",
        note: db.project.note?.value || undefined,
        databaseType: db.project.database_type || undefined,
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
