import { Table, Relationship } from "@/store/useCanvasStore";

/**
 * Converts a dbluna Canvas Schema into valid DBML code.
 * Schema prefixes from table names (e.g. "dbo.Users", "[Ncr].Orders") are
 * preserved so the DBML Docs sidebar can auto-group by schema.
 */
export function generateDbmlFromCanvas(tables: Table[], relationships: Relationship[]): string {
    let dbml = `// Generated automatically from your workspace schema\n\n`;

    if (tables.length === 0) {
        return dbml + `// No tables currently exist in your canvas.\n// Import a .bacpac file or design tables visually to construct your documentation.`;
    }

    // Process tables — preserve schema prefix in DBML output
    tables.forEach(table => {
        const dotIdx = table.name.indexOf(".");
        const tableName = dotIdx > 0
            ? table.name.slice(dotIdx + 1).replace(/[\[\]]/g, "")
            : table.name;
        const schemaName = dotIdx > 0
            ? table.name.slice(0, dotIdx).replace(/[\[\]]/g, "")
            : null;

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
            dbml += `  Note: '${table.comment.replace(/'/g, "\\'")}'\n`;
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
                const srcDot = sourceTable.name.indexOf(".");
                const tgtDot = targetTable.name.indexOf(".");
                const srcSchema = srcDot > 0 ? sourceTable.name.slice(0, srcDot).replace(/[\[\]]/g, "") : null;
                const tgtSchema = tgtDot > 0 ? targetTable.name.slice(0, tgtDot).replace(/[\[\]]/g, "") : null;
                const srcName = srcDot > 0 ? sourceTable.name.slice(srcDot + 1).replace(/[\[\]]/g, "") : sourceTable.name;
                const tgtName = tgtDot > 0 ? targetTable.name.slice(tgtDot + 1).replace(/[\[\]]/g, "") : targetTable.name;

                const srcRef = srcSchema ? `"${srcSchema}"."${srcName}"` : `"${srcName}"`;
                const tgtRef = tgtSchema ? `"${tgtSchema}"."${tgtName}"` : `"${tgtName}"`;

                let op = ">";
                if (rel.cardinality === "One to one") op = "-";
                if (rel.cardinality === "Many to one") op = "<";

                dbml += `Ref: ${srcRef}."${sourceCol.name}" ${op} ${tgtRef}."${targetCol.name}"\n`;
            }
        }
    });

    return dbml;
}
