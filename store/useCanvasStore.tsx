import { create } from "zustand";

export type CanvasBackground = "grid" | "dots";

type CanvasState = {
  background: CanvasBackground;
  setBackground: (bg: CanvasBackground) => void;
  toggleBackground: () => void;
};

export const useCanvasStore = create<CanvasState>((set) => ({
  background: "grid",
  setBackground: (bg) => set({ background: bg }),
  toggleBackground: () =>
    set((s) => ({ background: s.background === "grid" ? "dots" : "grid" })),
}));
