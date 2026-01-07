import { create } from "zustand";

export type CanvasBackground = "none" | "grid" | "dots";

type CanvasState = {
  background: CanvasBackground;
  setBackground: (bg: CanvasBackground) => void;
};

export const useCanvasStore = create<CanvasState>((set) => ({
  background: "grid",
  setBackground: (bg) => set({ background: bg }),
}));
