
import { Table, Column } from "@/store/useCanvasStore";

// --- JSON Converter ---
export function tablesToJSON(tables: Table[]): string {
    // Use 2 spaces indentation
    return JSON.stringify(tables, null, 2);
}

export function jsonToTables(jsonCode: string): Table[] {
    try {
        const data = JSON.parse(jsonCode);
        if (!Array.isArray(data)) throw new Error("Root must be an array");
        // Basic validation can be added here if needed
        return data as Table[];
    } catch (e) {
        // If invalid JSON, just return empty or rethrow. 
        // The editor loop will define how to handle errors.
        throw e;
    }
}

// --- Mermaid Converter ---
export function tablesToMermaid(tables: Table[]): string {
    const parts = tables.map((table) => {
        // Mermaid ER syntax:
        // TABLE_NAME {
        //   type name PK,FK "comment"
        // }

        // Clean table name (remove spaces or handle them?)
        // Mermaid doesn't like spaces in names usually, but we can quote or replace.
        // For now, let's assume valid names or replace spaces with underscores.
        const safeName = table.name.replace(/\s+/g, "_");

        const cols = table.columns.map((col) => {
            const type = col.type.replace(/\s+/g, "_") || "string";
            const name = col.name.replace(/\s+/g, "_");

            const constraints = [];
            if (col.isPrimaryKey) constraints.push("PK");
            // Foreign keys would be here if we tracked them on columns directly for mermaid
            // but usually relationships are separate.
            // Unique/NotNull not standard in simple Mermaid ER, but we can add as comment or ignore.

            // Mermaid syntax: <type> <name> <PK/FK>
            return `    ${type} ${name} ${constraints.join(" ")}`;
        });

        return `${safeName} {\n${cols.join("\n")}\n}`;
    });

    return `erDiagram\n\n${parts.join("\n\n")}`;
}

export function mermaidToTables(mermaidCode: string): Table[] {
    // Parsing Mermaid is complex. 
    // For now, we return existing tables or null to indicate "Not Supported"
    // If we return null/undefined, the caller should know not to update the store.
    throw new Error("Mermaid import is not supported yet.");
}
