"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { useCanvasStore } from "@/store/useCanvasStore";
import { useEditorStore } from "@/store/useEditorStore";
import { useStoreHydration } from "@/hooks/use-store-hydration";
import { mapCloudDoc } from "@/lib/diagram-persistence";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const INITIAL_LOAD_TIMEOUT_MS = 3000;

/**
 * Live reconciliation for a cloud-synced diagram, called only from the real
 * editor route (app/(diagram)/d/[id]/page.tsx) — never from CanvasStage
 * itself, since that component is reused verbatim by the anonymous
 * share-link viewer, which must never touch Convex.
 *
 * Phase B §2 (release-1-0/collaboration-plan.md): this used to be a one-shot
 * pull-on-mount. It's now a reactive useQuery subscription — a
 * collaborator's push shows up here within one round-trip instead of only at
 * the next time this diagram is opened. CanvasStage's own setDiagramId
 * effect copies diagrams[id] into top-level live state exactly once per id
 * change, so the caller MUST still gate CanvasStage's mount on `ready` —
 * reconciliation's first resolution (or timeout) must land before
 * CanvasStage runs its own setDiagramId for that id. Merges after that first
 * one keep flowing straight into the store; CanvasStage doesn't need to know.
 */
export function useCloudReconciliation(id: string): { ready: boolean } {
  const hasHydrated = useStoreHydration();
  const diagram = useCanvasStore((s) => s.diagrams[id]);
  // Common case, computed during render rather than via effect+setState:
  // local-only (or no entry yet) needs no Convex call at all, ready immediately.
  const needsPull = hasHydrated && diagram?.storage === "cloud";
  const cloudId = diagram?.cloudId;

  const remote = useQuery(
    api.diagrams.get,
    needsPull && cloudId ? { diagramId: cloudId as Id<"diagrams"> } : "skip"
  );

  // Resilience fallback only — local-first means the editor shouldn't hang
  // forever on first load if Convex is slow or unreachable. The subscription
  // stays live in the background regardless of this timing out; if it
  // resolves after, the merge effect below still runs and picks it up.
  const [timedOutId, setTimedOutId] = useState<string | null>(null);
  useEffect(() => {
    if (!needsPull || !cloudId) return;
    const t = setTimeout(() => setTimedOutId(id), INITIAL_LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [id, needsPull, cloudId]);

  // Merge side effect. This mutates the Zustand store directly rather than
  // component state, so it's not the "setState synchronously in an effect"
  // pattern — it's a genuine reaction to `remote` (an external subscription)
  // changing, exactly what effects are for.
  useEffect(() => {
    if (!needsPull || !cloudId) return;
    if (remote === undefined) return; // still loading
    if (remote === null) return; // no access, or the diagram is gone — nothing to merge

    const lastSyncedAt = diagram?.lastSyncedAt ?? 0;
    const localUpdatedAt = diagram?.updatedAt ?? 0;
    // Dirty check: a push is armed or in flight, meaning the local canvas
    // has changes Convex doesn't have yet — merging the remote snapshot in
    // right now would clobber them. use-cloud-autosave.ts flips
    // cloudSyncStatus to "saving" synchronously the moment a change is
    // detected, before its own debounce timer even starts, so this is a
    // reliable-enough proxy for "dirty" without adding a second flag.
    const isDirty = useCanvasStore.getState().cloudSyncStatus === "saving";

    // Both timestamp comparisons matter: a stale lastSyncedAt must not let
    // an older remote value win over a newer local edit made since the last
    // sync.
    if (!isDirty && remote.updatedAt > lastSyncedAt && remote.updatedAt > localUpdatedAt) {
      const { background, snapToGrid, isFocusModeEnabled } = diagram ?? {};
      const mapped = mapCloudDoc(remote);
      useCanvasStore.getState().importDiagram(id, {
        ...mapped.data,
        background: background ?? mapped.data.background,
        snapToGrid: snapToGrid ?? mapped.data.snapToGrid,
        isFocusModeEnabled: isFocusModeEnabled ?? mapped.data.isFocusModeEnabled,
        storage: "cloud",
        cloudId,
        lastSyncedAt: mapped.remoteUpdatedAt,
      });
      useEditorStore.getState().setCameraForDiagram(id, mapped.camera);
    }
  }, [id, needsPull, cloudId, remote, diagram]);

  const ready = !needsPull || remote !== undefined || timedOutId === id;
  return { ready };
}
