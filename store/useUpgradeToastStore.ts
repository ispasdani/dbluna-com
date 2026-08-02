import { create } from "zustand";

interface UpgradeToastState {
  visible: boolean;
  // Bumped on every trigger so the toast can restart its auto-dismiss timer
  // even when re-triggered while already visible (rapid repeated clicks).
  nonce: number;
  trigger: () => void;
  dismiss: () => void;
}

export const useUpgradeToastStore = create<UpgradeToastState>((set) => ({
  visible: false,
  nonce: 0,
  trigger: () => set((s) => ({ visible: true, nonce: s.nonce + 1 })),
  dismiss: () => set({ visible: false }),
}));
