import type { DiagramData } from "@/store/useCanvasStore";
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import { DIAGRAM_ENVELOPE_VERSION, parseDiagramEnvelope } from "@/lib/diagram-envelope";

// `updatedAt` isn't meaningful in a share link (it's a one-shot snapshot, not
// a persisted diagram) — omit it so the compressed payload stays as small as
// possible; every byte counts against the URL-fragment size cutoff.
function buildShareEnvelope(diagram: DiagramData) {
    return {
        v: DIAGRAM_ENVELOPE_VERSION,
        name: diagram.name,
        tables: diagram.tables,
        notes: diagram.notes,
        areas: diagram.areas,
        relationships: diagram.relationships,
        enums: diagram.enums,
        tableGroups: diagram.tableGroups,
        project: diagram.project,
        background: diagram.background,
        snapToGrid: diagram.snapToGrid,
        isFocusModeEnabled: diagram.isFocusModeEnabled,
    };
}

/** Compresses a diagram into a string safe to place after the `#` in a share URL. */
export function encodeDiagramForShare(diagram: DiagramData): string {
    return compressToEncodedURIComponent(JSON.stringify(buildShareEnvelope(diagram)));
}

/**
 * Inverse of `encodeDiagramForShare`. Returns null for anything malformed,
 * truncated, or from an incompatible envelope version — the viewer shows an
 * "invalid link" state rather than rendering a partial/garbled canvas.
 */
export function decodeDiagramFromShare(fragment: string): DiagramData | null {
    if (!fragment) return null;

    let json: string | null;
    try {
        json = decompressFromEncodedURIComponent(fragment);
    } catch {
        return null;
    }
    if (!json) return null;

    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch {
        return null;
    }

    return parseDiagramEnvelope(parsed, "Shared diagram");
}

/** Compressed byte length of what a share link for this diagram would carry. */
export function estimateShareLinkSize(diagram: DiagramData): number {
    return encodeDiagramForShare(diagram).length;
}
