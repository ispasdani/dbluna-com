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

/**
 * The dock panel look is a personal viewing preference, like the canvas style,
 * but stored under its own key so the two never influence each other.
 */
type PanelStyleState = {
  styleId: PanelStyleId;
  setStyleId: (id: PanelStyleId) => void;
};

export const usePanelStyleStore = create<PanelStyleState>()(
  persist(
    (set) => ({
      styleId: DEFAULT_PANEL_STYLE,
      setStyleId: (id) => set({ styleId: id }),
    }),
    {
      name: "dbluna-panel-style",
      // Drop an unknown id (e.g. a style that was later removed).
      merge: (persisted, current) => {
        const id = (persisted as Partial<PanelStyleState> | undefined)?.styleId;
        return { ...current, styleId: isPanelStyleId(id) ? id : DEFAULT_PANEL_STYLE };
      },
    }
  )
);

export function usePanelStyle(): PanelStyle {
  return PANEL_STYLES[usePanelStyleStore((s) => s.styleId)];
}
