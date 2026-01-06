import { create } from "zustand";

type ViewState = {
  isTopNavbarVisible: boolean;
  isLeftDockVisible: boolean;
  isGridVisible: boolean;

  toggleTopNavbar: () => void;
  toggleLeftDock: () => void;
  toggleGrid: () => void;
};

export const useViewStore = create<ViewState>((set) => ({
  isTopNavbarVisible: true,
  isLeftDockVisible: true,
  isGridVisible: true,

  toggleTopNavbar: () =>
    set((s) => ({ isTopNavbarVisible: !s.isTopNavbarVisible })),
  toggleLeftDock: () =>
    set((s) => ({ isLeftDockVisible: !s.isLeftDockVisible })),
  toggleGrid: () => set((s) => ({ isGridVisible: !s.isGridVisible })),
}));
