import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UIMessage } from "ai";
import { createDebouncedStorage } from "./debounced-storage";

// Local-only for v1, consistent with the rest of the app's local-first
// philosophy (see ai-chat-implementation-plan.md). Keyed by diagram id, same
// "Record<diagramId, ...>" shape useEditorStore uses for per-diagram cameras.
type AiChatState = {
  hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
  chatsByDiagram: Record<string, UIMessage[]>;
  getMessages: (diagramId: string) => UIMessage[];
  setMessages: (diagramId: string, messages: UIMessage[]) => void;
  clearMessages: (diagramId: string) => void;
};

export const useAiChatStore = create<AiChatState>()(
  persist(
    (set, get) => ({
      hasHydrated: false,
      setHasHydrated: (v) => set({ hasHydrated: v }),
      chatsByDiagram: {},
      getMessages: (diagramId) => get().chatsByDiagram[diagramId] ?? [],
      setMessages: (diagramId, messages) =>
        set((s) => ({
          chatsByDiagram: { ...s.chatsByDiagram, [diagramId]: messages },
        })),
      clearMessages: (diagramId) =>
        set((s) => {
          const next = { ...s.chatsByDiagram };
          delete next[diagramId];
          return { chatsByDiagram: next };
        }),
    }),
    {
      name: "ai-chat-storage",
      // Debounced: persisting on every streamed token would otherwise mean a
      // stringify + write per chunk (same reasoning as editor-storage's camera).
      storage: createDebouncedStorage(500),
      onRehydrateStorage: () => (_state, error) => {
        if (error) console.error("Failed to rehydrate ai-chat-storage:", error);
        useAiChatStore.setState({ hasHydrated: true });
      },
      partialize: (state) => ({ chatsByDiagram: state.chatsByDiagram }),
    }
  )
);
