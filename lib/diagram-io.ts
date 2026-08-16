import type { DiagramData, Table, Relationship, Note, Area } from "@/store/useCanvasStore";
import { generateDbmlFromCanvas, type DbmlSchemaMeta } from "@/lib/generator/dbml-generator";
import { generateSqlFromCanvas, type SqlDialect } from "@/lib/generator/sql-generator";
import { DIAGRAM_ENVELOPE_VERSION, parseDiagramEnvelope } from "@/lib/diagram-envelope";
import { computeDiagramBounds, serializeCanvasSvg } from "@/lib/canvas-export";
import { useEditorStore } from "@/store/useEditorStore";

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

export function exportDiagramAsSql(
    tables: Table[],
    relationships: Relationship[],
    dialect: SqlDialect,
    name: string,
    meta: DbmlSchemaMeta = {}
): boolean {
    const sql = generateSqlFromCanvas(tables, relationships, dialect, meta);
    if (sql === null) return false;
    downloadBlob(sql, "text/plain", `${sanitizeFileName(name)}.sql`);
    return true;
}

// Waits two animation frames — enough for React to commit a state change
// (like flipping isExporting) and the browser to paint it, before we read
// the DOM.
function waitForRender(): Promise<void> {
    return new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
}

// Temporarily disables viewport culling (see useEditorStore.isExporting)
// so the live canvas SVG renders every table/note/area, then serializes it
// cropped to the diagram's content bounds. Always restores culling
// afterwards, even on failure.
async function captureCanvasSvg(tables: Table[], notes: Note[], areas: Area[]): Promise<{ svg: string; bounds: ReturnType<typeof computeDiagramBounds> } | null> {
    const { setIsExporting } = useEditorStore.getState();
    setIsExporting(true);
    try {
        await waitForRender();
        const bounds = computeDiagramBounds(tables, notes, areas);
        const svg = serializeCanvasSvg(bounds);
        if (!svg) return null;
        return { svg, bounds };
    } finally {
        setIsExporting(false);
    }
}

export async function exportDiagramAsSvg(
    tables: Table[],
    notes: Note[],
    areas: Area[],
    name: string
): Promise<boolean> {
    const captured = await captureCanvasSvg(tables, notes, areas);
    if (!captured) return false;
    downloadBlob(captured.svg, "image/svg+xml", `${sanitizeFileName(name)}.svg`);
    return true;
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
