import { useCanvasStore } from "@/store/useCanvasStore";
import { useEditorStore } from "@/store/useEditorStore";
import { useAiChatStore } from "@/store/useAiChatStore";

// True only once all persisted stores have finished rehydrating from
// IndexedDB. These back a diagram's on-screen state (canvas data, camera,
// AI chat history), so acting on any of them before all are ready risks
// reading/writing stale pre-hydration defaults.
export function useStoreHydration(): boolean {
  const canvasHydrated = useCanvasStore((s) => s.hasHydrated);
  const editorHydrated = useEditorStore((s) => s.hasHydrated);
  const aiChatHydrated = useAiChatStore((s) => s.hasHydrated);
  return canvasHydrated && editorHydrated && aiChatHydrated;
}
