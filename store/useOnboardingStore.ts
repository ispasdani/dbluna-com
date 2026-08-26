import { create } from "zustand";

// Drives the onboarding / product-tour modal on /d/[id]. The "seen once"
// persistence is a plain localStorage flag handled where the modal is shown
// (see free-tier-code-only-editing-plan.md §8) — this store only tracks the
// live open/closed state so the TopNavbar help icon and the first-mount
// auto-open can share it.
interface OnboardingState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));

export const ONBOARDING_SEEN_KEY = "dbluna:hasSeenOnboarding:v1";
