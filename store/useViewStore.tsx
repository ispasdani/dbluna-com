// store/useViewStore.ts
import { create } from "zustand";

type ViewState = {
  isTopNavbarVisible: boolean;
  isLeftDockVisible: boolean;
  toggleTopNavbar: () => void;
  leftDockWidth: number;
  setLeftDockWidth: (w: number) => void;

  toggleLeftDock: () => void;
};

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

export const useViewStore = create<ViewState>((set, get) => ({
  isTopNavbarVisible: true,
  isLeftDockVisible: true,
  toggleTopNavbar: () =>
    set((s) => ({ isTopNavbarVisible: !s.isTopNavbarVisible })),
  leftDockWidth: 320,
  setLeftDockWidth: (w) => set({ leftDockWidth: clamp(w, 260, 720) }),

  toggleLeftDock: () => set({ isLeftDockVisible: !get().isLeftDockVisible }),
}));
