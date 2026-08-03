"use client";

import { useEffect, useRef, useState } from "react";
import { useCanvasStore } from "@/store/useCanvasStore";
import { useEditorStore } from "@/store/useEditorStore";
import { useStoreHydration } from "@/hooks/use-store-hydration";
import { pullCloudDiagram } from "@/lib/diagram-persistence";

const PULL_TIMEOUT_MS = 3000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | { ok: false }> {
  return Promise.race([
    promise,
    new Promise<{ ok: false }>((resolve) => setTimeout(() => resolve({ ok: false }), ms)),
  ]);
}

/**
 * Pull-on-mount reconciliation for a cloud-synced diagram, called only from
 * the real editor route (app/(diagram)/d/[id]/page.tsx) — never from
 * CanvasStage itself, since that component is reused verbatim by the
 * anonymous share-link viewer, which must never touch Convex.
 *
 * CanvasStage's own setDiagramId effect copies diagrams[id] into top-level
 * live state exactly once per id change. If a pulled update landed after that
 * copy, the on-screen canvas would keep showing stale data even though the
 * map entry underneath got corrected. So the caller MUST gate CanvasStage's
 * mount on `ready` — reconciliation always finishes (or times out) before
 * CanvasStage ever runs its own setDiagramId for that id.
 */
export function useCloudReconciliation(id: string): { ready: boolean } {
  const hasHydrated = useStoreHydration();
  const diagram = useCanvasStore((s) => s.diagrams[id]);
  // Common case, computed during render rather than via effect+setState:
  // local-only (or no entry yet) needs no Convex call at all, ready immediately.
  const needsPull = hasHydrated && diagram?.storage === "cloud";

  // Only ever set from inside the async pull's own resolution below — never
  // synchronously in the effect body — since that's a genuine reaction to an
  // external (Convex) operation completing, not a render-derivable value.
  const [pullResolvedId, setPullResolvedId] = useState<string | null>(null);
  const attemptedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!needsPull) return;
    if (attemptedRef.current === id) return; // already ran once for this id this mount
    attemptedRef.current = id;

    let cancelled = false;
    const cloudId = diagram?.cloudId;
    const lastSyncedAt = diagram?.lastSyncedAt ?? 0;
    const localUpdatedAt = diagram?.updatedAt ?? 0;
    const { background, snapToGrid, isFocusModeEnabled } = diagram ?? {};

    (async () => {
      if (!cloudId) {
        if (!cancelled) setPullResolvedId(id);
        return;
      }

      const result = await withTimeout(pullCloudDiagram(cloudId), PULL_TIMEOUT_MS);
      if (cancelled) return;

      // Both comparisons matter: a stale lastSyncedAt must not let an older
      // remote value win over a newer local edit made since the last sync.
      if (result.ok && result.remoteUpdatedAt > lastSyncedAt && result.remoteUpdatedAt > localUpdatedAt) {
        useCanvasStore.getState().importDiagram(id, {
          ...result.data,
          background: background ?? result.data.background,
          snapToGrid: snapToGrid ?? result.data.snapToGrid,
          isFocusModeEnabled: isFocusModeEnabled ?? result.data.isFocusModeEnabled,
          storage: "cloud",
          cloudId,
          lastSyncedAt: result.remoteUpdatedAt,
        });
        useEditorStore.getState().setCameraForDiagram(id, result.camera);
      }
      setPullResolvedId(id);
    })();

    return () => {
      cancelled = true;
    };
  }, [id, needsPull, diagram]);

  const ready = !needsPull || pullResolvedId === id;
  return { ready };
}
