// store/useViewStore.ts
import { create } from "zustand";

type ViewState = {
  isTopNavbarVisible: boolean;
  isLeftDockVisible: boolean;
  toggleTopNavbar: () => void;
  leftDockWidth: number;
  setLeftDockWidth: (w: number) => void;
  toggleLeftDock: () => void;

  // Luna AI sidebar: opened from the floating button on the canvas, docked to
  // the right edge of the work area (separate from the left tab dock).
  isAiChatOpen: boolean;
  setAiChatOpen: (open: boolean) => void;
  toggleAiChat: () => void;
  
  workspaceMode: 'diagram' | 'docs';
  setWorkspaceMode: (mode: 'diagram' | 'docs') => void;
};

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

export const useViewStore = create<ViewState>((set, get) => ({
  isTopNavbarVisible: true,
  isLeftDockVisible: true,
  toggleTopNavbar: () =>
    set((s) => ({ isTopNavbarVisible: !s.isTopNavbarVisible })),
  leftDockWidth: 430,
  setLeftDockWidth: (w) => set({ leftDockWidth: clamp(w, 260, 720) }),

  toggleLeftDock: () => set({ isLeftDockVisible: !get().isLeftDockVisible }),

  isAiChatOpen: false,
  setAiChatOpen: (open) => set({ isAiChatOpen: open }),
  toggleAiChat: () => set({ isAiChatOpen: !get().isAiChatOpen }),

  workspaceMode: 'diagram',
  setWorkspaceMode: (mode) => set({ workspaceMode: mode }),
}));
