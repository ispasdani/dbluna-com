import type { DiagramData, Table, Relationship } from "@/store/useCanvasStore";
import { generateDbmlFromCanvas } from "@/lib/generator/dbml-generator";

// Versioned envelope so a future export shape can reject or migrate an older
// file instead of silently misinterpreting it.
const DIAGRAM_EXPORT_VERSION = 1;

function sanitizeFileName(name: string): string {
    return name.trim().replace(/[\\/:*?"<>|]+/g, "_") || "diagram";
}

function downloadBlob(content: string, mimeType: string, filename: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

export function exportDiagramAsJson(diagram: DiagramData, name: string): void {
    const envelope = { v: DIAGRAM_EXPORT_VERSION, ...diagram };
    downloadBlob(JSON.stringify(envelope, null, 2), "application/json", `${sanitizeFileName(name)}.json`);
}

export function exportDiagramAsDbml(tables: Table[], relationships: Relationship[], name: string): void {
    const dbml = generateDbmlFromCanvas(tables, relationships);
    downloadBlob(dbml, "text/plain", `${sanitizeFileName(name)}.dbml`);
}

const REQUIRED_ARRAY_KEYS = ["tables", "notes", "areas", "relationships"] as const;

/**
 * Parses a previously-exported diagram JSON file back into DiagramData.
 * Rejects anything that doesn't look like a real export rather than
 * guessing — an unknown `v` or a missing array is treated as invalid.
 */
export function parseImportedDiagramJson(text: string): DiagramData | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return null;
    }
    if (typeof parsed !== "object" || parsed === null) return null;
    const obj = parsed as Record<string, unknown>;

    if ("v" in obj && obj.v !== DIAGRAM_EXPORT_VERSION) return null;
    if (!REQUIRED_ARRAY_KEYS.every((key) => Array.isArray(obj[key]))) return null;

    return {
        name: typeof obj.name === "string" && obj.name.trim() ? obj.name : "Imported diagram",
        updatedAt: Date.now(),
        tables: obj.tables as DiagramData["tables"],
        notes: obj.notes as DiagramData["notes"],
        areas: obj.areas as DiagramData["areas"],
        relationships: obj.relationships as DiagramData["relationships"],
        // Older exports (from before enums/tableGroups/project existed) won't
        // have these — default them in rather than rejecting the import.
        enums: Array.isArray(obj.enums) ? (obj.enums as DiagramData["enums"]) : [],
        tableGroups: Array.isArray(obj.tableGroups) ? (obj.tableGroups as DiagramData["tableGroups"]) : [],
        project: (obj.project as DiagramData["project"]) ?? null,
        background: obj.background === "dots" ? "dots" : "grid",
        snapToGrid: Boolean(obj.snapToGrid),
        isFocusModeEnabled: obj.isFocusModeEnabled !== false,
    };
}
