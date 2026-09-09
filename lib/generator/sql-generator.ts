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

/**
 * Best-effort map from a DBML `database_type` string to an export dialect.
 *
 * `project.databaseType` is free text (DBML places no constraint on it, and the
 * Schema tab offers the labels below only as suggestions), so this matches on
 * substrings rather than exact labels — "Postgres 15" and "Microsoft SQL Server"
 * should both resolve. Returns null when nothing matches; callers treat that as
 * "no project default", never as an error.
 */
export function dialectFromDatabaseType(databaseType?: string | null): SqlDialect | null {
    const value = (databaseType ?? "").toLowerCase();
    if (!value.trim()) return null;

    // Ordered most-specific first: several of these contain the substring "sql".
    if (value.includes("postgres") || value.includes("pgsql")) return "postgres";
    if (value.includes("mysql") || value.includes("maria")) return "mysql";
    if (value.includes("oracle")) return "oracle";
    if (
        value.includes("sql server") ||
        value.includes("sqlserver") ||
        value.includes("mssql") ||
        value.includes("t-sql") ||
        value.includes("transact")
    ) {
        return "mssql";
    }
    return null;
}
