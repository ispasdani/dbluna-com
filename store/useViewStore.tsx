import { create } from "zustand";

type ViewState = {
  isTopNavbarVisible: boolean;
  isLeftDockVisible: boolean;

  toggleTopNavbar: () => void;
  toggleLeftDock: () => void;
};

export const useViewStore = create<ViewState>((set) => ({
  isTopNavbarVisible: true,
  isLeftDockVisible: true,

  toggleTopNavbar: () =>
    set((s) => ({ isTopNavbarVisible: !s.isTopNavbarVisible })),
  toggleLeftDock: () =>
    set((s) => ({ isLeftDockVisible: !s.isLeftDockVisible })),
}));
