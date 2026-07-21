import { useCanvasStore } from "@/store/useCanvasStore";
import { useEditorStore } from "@/store/useEditorStore";

// True only once both persisted stores have finished rehydrating from
// IndexedDB. Both back a diagram's on-screen state (canvas data + camera),
// so acting on either before both are ready risks reading/writing stale
// pre-hydration defaults.
export function useStoreHydration(): boolean {
  const canvasHydrated = useCanvasStore((s) => s.hasHydrated);
  const editorHydrated = useEditorStore((s) => s.hasHydrated);
  return canvasHydrated && editorHydrated;
}
