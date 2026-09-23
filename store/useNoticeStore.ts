import { create } from "zustand";

/**
 * A short, neutral status message — "Showing schema auth" — for things the app
 * did on the user's behalf. Separate from the upgrade toast, which is a sales
 * surface with its own copy and styling.
 */
interface NoticeState {
  message: string | null;
  // Bumped on every show so the toast restarts its auto-dismiss timer when a
  // new message replaces one that is still visible.
  nonce: number;
  show: (message: string) => void;
  dismiss: () => void;
}

export const useNoticeStore = create<NoticeState>((set) => ({
  message: null,
  nonce: 0,
  show: (message) => set((s) => ({ message, nonce: s.nonce + 1 })),
  dismiss: () => set({ message: null }),
}));
