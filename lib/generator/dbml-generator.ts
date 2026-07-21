import {
    Table,
    Relationship,
    CanvasEnum,
    CanvasTableGroup,
    CanvasProject,
} from "@/store/useCanvasStore";

export interface DbmlSchemaMeta {
    project?: CanvasProject | null;
    enums?: CanvasEnum[];
    tableGroups?: CanvasTableGroup[];
}

// Splits a canvas table name like "dbo.Users" / "[Ncr].Orders" into its parts.
function splitSchema(name: string): { schema: string | null; table: string } {
    const dotIdx = name.indexOf(".");
    if (dotIdx <= 0) return { schema: null, table: name };
    return {
        schema: name.slice(0, dotIdx).replace(/[\[\]]/g, ""),
        table: name.slice(dotIdx + 1).replace(/[\[\]]/g, ""),
    };
}

// Emits a schema-qualified, quoted table reference: "schema"."table" or "table".
function tableRef(name: string): string {
    const { schema, table } = splitSchema(name);
    return schema ? `"${schema}"."${table}"` : `"${table}"`;
}

const escapeNote = (value: string) => value.replace(/'/g, "\\'");

/**
 * Converts a dbluna Canvas Schema into valid DBML code.
 * Schema prefixes from table names (e.g. "dbo.Users", "[Ncr].Orders") are
 * preserved so the DBML Docs sidebar can auto-group by schema. Project notes,
 * enums, and table groups are emitted when supplied so they surface in Docs.
 */
export function generateDbmlFromCanvas(
    tables: Table[],
    relationships: Relationship[],
    meta: DbmlSchemaMeta = {}
): string {
    const { project, enums = [], tableGroups = [] } = meta;

    let dbml = `// Generated automatically from your workspace schema\n\n`;

    // ── Project (README / overview) ───────────────────────────────
    if (project && (project.name || project.note || project.databaseType)) {
        dbml += `Project "${project.name || "Database Documentation"}" {\n`;
        if (project.databaseType) dbml += `  database_type: '${escapeNote(project.databaseType)}'\n`;
        if (project.note) dbml += `  Note: '${escapeNote(project.note)}'\n`;
        dbml += `}\n\n`;
    }

    // ── Enums ─────────────────────────────────────────────────────
    enums.forEach(en => {
        dbml += `Enum "${en.name}" {\n`;
        en.values.forEach(val => {
            dbml += val.note
                ? `  "${val.name}" [note: '${escapeNote(val.note)}']\n`
                : `  "${val.name}"\n`;
        });
        dbml += `}\n\n`;
    });

    if (tables.length === 0) {
        return dbml + `// No tables currently exist in your canvas.\n// Import a .bacpac file or design tables visually to construct your documentation.`;
    }

    // Process tables — preserve schema prefix in DBML output
    tables.forEach(table => {
        const { schema: schemaName, table: tableName } = splitSchema(table.name);

        // Emit schema-qualified table name: Table "schema"."tablename" { ... }
        dbml += schemaName
            ? `Table "${schemaName}"."${tableName}" {\n`
            : `Table "${tableName}" {\n`;

        table.columns.forEach(col => {
            let line = `  "${col.name}" ${col.type.replace(/\s+/g, '_')}`;
            const settings: string[] = [];

            if (col.isPrimaryKey) settings.push("primary key");
            if (col.isUnique && !col.isPrimaryKey) settings.push("unique");
            if (col.isNotNull && !col.isPrimaryKey) settings.push("not null");
            if (col.isAutoIncrement) settings.push("increment");

            if (settings.length > 0) {
                line += ` [${settings.join(', ')}]`;
            }
            dbml += line + `\n`;
        });

        if (table.comment) {
            dbml += `  Note: '${escapeNote(table.comment)}'\n`;
        }

        dbml += `}\n\n`;
    });

    // Process relationships
    relationships.forEach(rel => {
        const sourceTable = tables.find(t => t.id === rel.sourceTableId);
        const targetTable = tables.find(t => t.id === rel.targetTableId);

        if (sourceTable && targetTable) {
            const sourceCol = sourceTable.columns.find(c => c.id === rel.sourceColumnId);
            const targetCol = targetTable.columns.find(c => c.id === rel.targetColumnId);

            if (sourceCol && targetCol) {
                const srcRef = tableRef(sourceTable.name);
                const tgtRef = tableRef(targetTable.name);

                let op = ">";
                if (rel.cardinality === "One to one") op = "-";
                if (rel.cardinality === "Many to one") op = "<";

                dbml += `Ref: ${srcRef}."${sourceCol.name}" ${op} ${tgtRef}."${targetCol.name}"\n`;
            }
        }
    });

    // ── Table groups ──────────────────────────────────────────────
    if (tableGroups.length > 0) dbml += `\n`;
    tableGroups.forEach(group => {
        dbml += `TableGroup "${group.name}" {\n`;
        group.tableNames.forEach(name => {
            dbml += `  ${tableRef(name)}\n`;
        });
        dbml += `}\n\n`;
    });

    return dbml;
}
