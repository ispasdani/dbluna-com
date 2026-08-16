"use client";

import { useCallback, useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import type { UIMessage } from "ai";
import { useCanvasStore } from "@/store/useCanvasStore";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type StoredRole = "user" | "assistant" | "system";

function toUIMessage(row: { messageId: string; role: StoredRole; parts: unknown }): UIMessage {
  return { id: row.messageId, role: row.role, parts: row.parts as UIMessage["parts"] };
}

/**
 * Convex sync for AI chat history (ai-chat-credits-and-sync-plan.md, Phase 2).
 * No-op unless the diagram is already cloud-synced (same opt-in
 * `storage === "cloud"` condition hooks/use-cloud-autosave.ts checks) — a
 * diagram that hasn't opted into cloud sync makes zero Convex calls here,
 * exactly as Phase 3 (local IndexedDB only) left it.
 *
 * Deliberately simpler than diagram sync: chat messages are append-only, so
 * there's no conflict to detect, no debounce, no retry-on-stale banner — a
 * dropped push just means that message stays local-only until the next
 * successful one, nothing to reconcile against.
 *
 * Returns a `pushMessages` function the caller invokes once a turn
 * completes; the pull side (subscribing + merging remote history into
 * `setMessages`) runs entirely inside this hook.
 */
export function useCloudAiChatSync(
  diagramId: string,
  setMessages: (updater: (prev: UIMessage[]) => UIMessage[]) => void
) {
  const diagram = useCanvasStore((s) => s.diagrams[diagramId]);
  const cloudId = diagram?.storage === "cloud" ? diagram.cloudId : undefined;

  const remote = useQuery(
    api.aiChatMessages.list,
    cloudId ? { diagramId: cloudId as Id<"diagrams"> } : "skip"
  );
  const appendMessage = useMutation(api.aiChatMessages.append);

  // Shared with pushMessages below: a row pulled FROM Convex is already
  // synced, so marking it here means the push side never redundantly sends
  // it straight back.
  const pushedIdsRef = useRef(new Set<string>());

  // Pull: additive merge only. The functional-updater form means this can
  // never clobber a message this tab just sent locally — it always merges
  // against whatever `messages` currently is, not a stale snapshot.
  useEffect(() => {
    if (!cloudId || remote === undefined) return;
    for (const row of remote) pushedIdsRef.current.add(row.messageId);
    setMessages((prev) => {
      const known = new Set(prev.map((m) => m.id));
      const missing = remote.filter((row) => !known.has(row.messageId));
      return missing.length === 0 ? prev : [...prev, ...missing.map(toUIMessage)];
    });
  }, [cloudId, remote, setMessages]);

  const pushMessages = useCallback(
    (messages: UIMessage[]) => {
      if (!cloudId) return;
      for (const message of messages) {
        if (message.role === "system") continue;
        if (pushedIdsRef.current.has(message.id)) continue;
        pushedIdsRef.current.add(message.id);
        void appendMessage({
          diagramId: cloudId as Id<"diagrams">,
          messageId: message.id,
          role: message.role,
          parts: message.parts,
        }).catch(() => {
          // Best-effort — let a later call retry it instead of giving up for good.
          pushedIdsRef.current.delete(message.id);
        });
      }
    },
    [cloudId, appendMessage]
  );

  return pushMessages;
}
