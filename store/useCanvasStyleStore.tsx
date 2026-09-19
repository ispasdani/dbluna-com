// store/useCanvasStyleStore.tsx
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  CANVAS_STYLES,
  DEFAULT_CANVAS_STYLE,
  TABLE_GEOMETRY,
  isCanvasStyleId,
  type CanvasStyle,
  type CanvasStyleId,
  type TableGeometry,
} from "@/components/diagram-sections/canvas/canvas-style";

/**
 * The canvas look (table cards, relationship lines, handles) is a personal
 * viewing preference, not part of the diagram — so it lives in localStorage
 * per browser rather than in the per-diagram, cloud-synced canvas store.
 */
type CanvasStyleState = {
  styleId: CanvasStyleId;
  setStyleId: (id: CanvasStyleId) => void;
};

export const useCanvasStyleStore = create<CanvasStyleState>()(
  persist(
    (set) => ({
      styleId: DEFAULT_CANVAS_STYLE,
      setStyleId: (id) => set({ styleId: id }),
    }),
    {
      name: "dbluna-canvas-style",
      // Drop an unknown id (e.g. a style that was later removed).
      merge: (persisted, current) => {
        const id = (persisted as Partial<CanvasStyleState> | undefined)?.styleId;
        return { ...current, styleId: isCanvasStyleId(id) ? id : DEFAULT_CANVAS_STYLE };
      },
    }
  )
);

export function useCanvasStyle(): CanvasStyle {
  return CANVAS_STYLES[useCanvasStyleStore((s) => s.styleId)];
}

/** Non-hook read for code outside React (placement, export, camera focus). */
export function getCanvasStyle(): CanvasStyle {
  return CANVAS_STYLES[useCanvasStyleStore.getState().styleId];
}

export function getTableGeometry(): TableGeometry {
  return TABLE_GEOMETRY[getCanvasStyle().table];
}
