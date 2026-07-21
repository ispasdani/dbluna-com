import type { DiagramData } from "@/store/useCanvasStore";

// Shared by file export/import (lib/diagram-io.ts) and share links
// (lib/share-link.ts) — one envelope shape, one validation path, so a future
// shape change (or the next merge that adds a DiagramData field) only needs
// updating here instead of drifting between the two.
export const DIAGRAM_ENVELOPE_VERSION = 1;

const REQUIRED_ARRAY_KEYS = ["tables", "notes", "areas", "relationships"] as const;

/**
 * Validates and normalizes a parsed envelope back into DiagramData. Rejects
 * anything that doesn't look like a real envelope (unknown `v`, missing
 * required arrays) rather than guessing. Fields added after older envelopes
 * were created (enums/tableGroups/project) default in rather than failing.
 */
export function parseDiagramEnvelope(parsed: unknown, fallbackName: string): DiagramData | null {
    if (typeof parsed !== "object" || parsed === null) return null;
    const obj = parsed as Record<string, unknown>;

    if ("v" in obj && obj.v !== DIAGRAM_ENVELOPE_VERSION) return null;
    if (!REQUIRED_ARRAY_KEYS.every((key) => Array.isArray(obj[key]))) return null;

    return {
        name: typeof obj.name === "string" && obj.name.trim() ? obj.name : fallbackName,
        updatedAt: Date.now(),
        tables: obj.tables as DiagramData["tables"],
        notes: obj.notes as DiagramData["notes"],
        areas: obj.areas as DiagramData["areas"],
        relationships: obj.relationships as DiagramData["relationships"],
        enums: Array.isArray(obj.enums) ? (obj.enums as DiagramData["enums"]) : [],
        tableGroups: Array.isArray(obj.tableGroups) ? (obj.tableGroups as DiagramData["tableGroups"]) : [],
        project: (obj.project as DiagramData["project"]) ?? null,
        background: obj.background === "dots" ? "dots" : "grid",
        snapToGrid: Boolean(obj.snapToGrid),
        isFocusModeEnabled: obj.isFocusModeEnabled !== false,
    };
}
