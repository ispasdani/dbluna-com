import { Table, Relationship } from "@/store/useCanvasStore";

/**
 * Converts a dbluna Canvas Schema into valid DBML code
 */
export function generateDbmlFromCanvas(tables: Table[], relationships: Relationship[]): string {
    let dbml = `// Generated automatically from your workspace schema\n\n`;

    if (tables.length === 0) {
        return dbml += `// No tables currently exist in your canvas.\n// Import a .bacpac file or design tables visually to construct your documentation.`;
    }

    // Process tables
    tables.forEach(table => {
        dbml += `Table "${table.name}" {\n`;
        table.columns.forEach(col => {
            let line = `  "${col.name}" ${col.type.replace(/\s+/g, '_')}`;
            let settings = [];
            
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
                let op = ">"; // One to many (Many orders, One user: orders.user_id > users.id)
                if (rel.cardinality === "One to one") op = "-";
                if (rel.cardinality === "Many to one") op = "<";
                
                dbml += `Ref: "${sourceTable.name}"."${sourceCol.name}" ${op} "${targetTable.name}"."${targetCol.name}"\n`;
            }
        }
    });

    return dbml;
}
