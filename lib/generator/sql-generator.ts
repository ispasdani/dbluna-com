import { exporter } from "@dbml/core";
import type { Table, Relationship } from "@/store/useCanvasStore";
import { generateDbmlFromCanvas, type DbmlSchemaMeta } from "@/lib/generator/dbml-generator";

export type SqlDialect = "postgres" | "mysql" | "mssql" | "oracle";

export const SQL_DIALECTS: { value: SqlDialect; label: string }[] = [
    { value: "postgres", label: "PostgreSQL" },
    { value: "mysql", label: "MySQL" },
    { value: "mssql", label: "SQL Server" },
    { value: "oracle", label: "Oracle" },
];

/**
 * Canvas schema -> SQL DDL, via the existing canvas -> DBML generator
 * piped through @dbml/core's own exporter (already a dependency used for
 * DBML parsing elsewhere in the app). Returns null if the schema doesn't
 * parse as valid DBML (e.g. a malformed manual edit slipped through).
 */
export function generateSqlFromCanvas(
    tables: Table[],
    relationships: Relationship[],
    dialect: SqlDialect,
    meta: DbmlSchemaMeta = {}
): string | null {
    const dbml = generateDbmlFromCanvas(tables, relationships, meta);
    try {
        return exporter.export(dbml, dialect);
    } catch {
        return null;
    }
}
