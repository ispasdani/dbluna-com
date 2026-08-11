import { create } from "zustand";

interface ConflictBannerState {
  visible: boolean;
  trigger: () => void;
  dismiss: () => void;
}

// Deliberately no auto-dismiss timer (unlike useUpgradeToastStore) — a stale
// local snapshot doesn't resolve itself, so this stays up until the user
// reloads via ConflictBanner's action (release-1-0/collaboration-plan.md
// Phase B §3).
export const useConflictBannerStore = create<ConflictBannerState>((set) => ({
  visible: false,
  trigger: () => set({ visible: true }),
  dismiss: () => set({ visible: false }),
}));
