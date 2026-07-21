import type { DiagramData, Table, Relationship } from "@/store/useCanvasStore";
import { generateDbmlFromCanvas } from "@/lib/generator/dbml-generator";
import { DIAGRAM_ENVELOPE_VERSION, parseDiagramEnvelope } from "@/lib/diagram-envelope";

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
    const envelope = { v: DIAGRAM_ENVELOPE_VERSION, ...diagram };
    downloadBlob(JSON.stringify(envelope, null, 2), "application/json", `${sanitizeFileName(name)}.json`);
}

export function exportDiagramAsDbml(tables: Table[], relationships: Relationship[], name: string): void {
    const dbml = generateDbmlFromCanvas(tables, relationships);
    downloadBlob(dbml, "text/plain", `${sanitizeFileName(name)}.dbml`);
}

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
    return parseDiagramEnvelope(parsed, "Imported diagram");
}
