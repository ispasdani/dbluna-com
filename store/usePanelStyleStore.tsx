// store/usePanelStyleStore.tsx
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_PANEL_STYLE,
  PANEL_STYLES,
  isPanelStyleId,
  type PanelStyle,
  type PanelStyleId,
} from "@/components/diagram-general/panel-style";

/** Dock tabs that have their own panel style. */
export type StyledPanel = "tables" | "relationships" | "notes" | "areas" | "enums" | "templates" | "issues" | "database";
export const STYLED_PANELS: { id: StyledPanel; label: string }[] = [
  { id: "tables", label: "Tables" },
  { id: "relationships", label: "Relationships" },
  { id: "notes", label: "Notes" },
  { id: "areas", label: "Areas" },
  { id: "enums", label: "Enums" },
  { id: "templates", label: "Templates" },
  { id: "issues", label: "Issues" },
  { id: "database", label: "Database" },
];

type PanelStyles = Record<StyledPanel, PanelStyleId>;

const DEFAULTS: PanelStyles = {
  tables: DEFAULT_PANEL_STYLE,
  relationships: DEFAULT_PANEL_STYLE,
  notes: DEFAULT_PANEL_STYLE,
  areas: DEFAULT_PANEL_STYLE,
  enums: DEFAULT_PANEL_STYLE,
  templates: DEFAULT_PANEL_STYLE,
  issues: DEFAULT_PANEL_STYLE,
  database: DEFAULT_PANEL_STYLE,
};

/**
 * Dock panel looks are a personal viewing preference, like the canvas style,
 * stored under their own key so they never influence the canvas. Each tab has
 * its own style so users can mix them freely.
 */
/** Typeface of the Code tab's editor. Inter matches the rest of the app. */
export type CodeFont = "sans" | "mono";
export const CODE_FONTS: { id: CodeFont; label: string; description: string }[] = [
  { id: "sans", label: "Inter", description: "Same typeface as the rest of the app" },
  { id: "mono", label: "Monospace", description: "Fixed-width, columns line up" },
];
const isCodeFont = (v: unknown): v is CodeFont => v === "sans" || v === "mono";

type PanelStyleState = {
  styles: PanelStyles;
  setStyle: (panel: StyledPanel, id: PanelStyleId) => void;
  codeFont: CodeFont;
  setCodeFont: (font: CodeFont) => void;
};

export const usePanelStyleStore = create<PanelStyleState>()(
  persist(
    (set) => ({
      styles: DEFAULTS,
      setStyle: (panel, id) => set((s) => ({ styles: { ...s.styles, [panel]: id } })),
      codeFont: "sans",
      setCodeFont: (codeFont) => set({ codeFont }),
    }),
    {
      name: "dbluna-panel-style",
      // Drops unknown ids, and upgrades the old single `styleId` (one style for
      // every tab) by applying it to each tab.
      merge: (persisted, current) => {
        const p = persisted as
          | { styles?: Partial<Record<string, unknown>>; styleId?: unknown; codeFont?: unknown }
          | undefined;
        const legacy = isPanelStyleId(p?.styleId) ? p.styleId : null;
        const styles = { ...DEFAULTS };
        for (const key of Object.keys(DEFAULTS) as StyledPanel[]) {
          const id = p?.styles?.[key];
          styles[key] = isPanelStyleId(id) ? id : legacy ?? DEFAULT_PANEL_STYLE;
        }
        return { ...current, styles, codeFont: isCodeFont(p?.codeFont) ? p.codeFont : "sans" };
      },
    }
  )
);

export function usePanelStyle(panel: StyledPanel): PanelStyle {
  return PANEL_STYLES[usePanelStyleStore((s) => s.styles[panel])];
}
