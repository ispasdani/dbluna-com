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
export type StyledPanel = "tables" | "relationships" | "notes" | "areas" | "enums" | "templates" | "issues";
export const STYLED_PANELS: { id: StyledPanel; label: string }[] = [
  { id: "tables", label: "Tables" },
  { id: "relationships", label: "Relationships" },
  { id: "notes", label: "Notes" },
  { id: "areas", label: "Areas" },
  { id: "enums", label: "Enums" },
  { id: "templates", label: "Templates" },
  { id: "issues", label: "Issues" },
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
};

/**
 * Dock panel looks are a personal viewing preference, like the canvas style,
 * stored under their own key so they never influence the canvas. Each tab has
 * its own style so users can mix them freely.
 */
type PanelStyleState = {
  styles: PanelStyles;
  setStyle: (panel: StyledPanel, id: PanelStyleId) => void;
};

export const usePanelStyleStore = create<PanelStyleState>()(
  persist(
    (set) => ({
      styles: DEFAULTS,
      setStyle: (panel, id) => set((s) => ({ styles: { ...s.styles, [panel]: id } })),
    }),
    {
      name: "dbluna-panel-style",
      // Drops unknown ids, and upgrades the old single `styleId` (one style for
      // every tab) by applying it to each tab.
      merge: (persisted, current) => {
        const p = persisted as { styles?: Partial<Record<string, unknown>>; styleId?: unknown } | undefined;
        const legacy = isPanelStyleId(p?.styleId) ? p.styleId : null;
        const styles = { ...DEFAULTS };
        for (const key of Object.keys(DEFAULTS) as StyledPanel[]) {
          const id = p?.styles?.[key];
          styles[key] = isPanelStyleId(id) ? id : legacy ?? DEFAULT_PANEL_STYLE;
        }
        return { ...current, styles };
      },
    }
  )
);

export function usePanelStyle(panel: StyledPanel): PanelStyle {
  return PANEL_STYLES[usePanelStyleStore((s) => s.styles[panel])];
}
