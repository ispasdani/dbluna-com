/**
 * Dock panel styles — how the side tabs (Relationships first, others to
 * follow) draw their lists and editors.
 *
 * Deliberately independent of the canvas style: the names mirror the canvas
 * looks so the two feel related, but each is picked and persisted on its own.
 */

export type PanelVariant = "soft" | "chips" | "dense" | "header";
/** How the mini-canvas line in an inspector is drawn. */
export type PanelLine = "flow" | "gradient" | "sharp" | "tinted";

export type PanelStyleId = "recommended" | "expressive" | "compact" | "bold";

export interface PanelStyle {
  id: PanelStyleId;
  label: string;
  description: string;
  variant: PanelVariant;
  line: PanelLine;
}

export const PANEL_STYLES: Record<PanelStyleId, PanelStyle> = {
  recommended: {
    id: "recommended",
    label: "Recommended",
    description: "Soft cards, tinted editor, flowing lines",
    variant: "soft",
    line: "flow",
  },
  expressive: {
    id: "expressive",
    label: "Expressive",
    description: "Type chips, pill buttons, gradient lines",
    variant: "chips",
    line: "gradient",
  },
  compact: {
    id: "compact",
    label: "Compact",
    description: "Dense rows and square corners",
    variant: "dense",
    line: "sharp",
  },
  bold: {
    id: "bold",
    label: "Bold",
    description: "Colour headers, lines in each table's colour",
    variant: "header",
    line: "tinted",
  },
};

export const PANEL_STYLE_ORDER: PanelStyleId[] = ["recommended", "expressive", "compact", "bold"];
export const DEFAULT_PANEL_STYLE: PanelStyleId = "recommended";

export function isPanelStyleId(v: unknown): v is PanelStyleId {
  return typeof v === "string" && v in PANEL_STYLES;
}
