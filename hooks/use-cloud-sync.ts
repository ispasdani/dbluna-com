"use client";

import { useCallback, useRef, useState } from "react";
import { useCanvasStore } from "@/store/useCanvasStore";
import { useEditorStore } from "@/store/useEditorStore";
import { createCloudDiagram, pullCloudDiagram, softDeleteCloudDiagram } from "@/lib/diagram-persistence";

// "Save to cloud" / "Make local-only" actions for a single local diagram id.
// Opt-in, per-diagram — see release-1-0/paid-editing-access-plan.md's
// Phase 3 plan for why this isn't automatic for every Pro diagram.
export function useCloudSync(localId: string) {
  const storage = useCanvasStore((s) => s.diagrams[localId]?.storage ?? "local");
  const busyRef = useRef(false);
  const [isBusy, setIsBusy] = useState(false);

  const saveToCloud = useCallback(async () => {
    if (busyRef.current) return;
    const diagram = useCanvasStore.getState().diagrams[localId];
    // Idempotent: covers the double-click race where a second click's handler
    // fires before the first one's async createCloudDiagram has resolved and
    // patched storage — by the time this reads, storage is already "cloud".
    if (!diagram || diagram.storage === "cloud") return;

    busyRef.current = true;
    setIsBusy(true);
    try {
      const camera = useEditorStore.getState().cameras[localId] ?? { x: 0, y: 0, zoom: 1 };
      const result = await createCloudDiagram(diagram.name, {
        name: diagram.name,
        tables: diagram.tables,
        notes: diagram.notes,
        areas: diagram.areas,
        relationships: diagram.relationships,
        enums: diagram.enums,
        tableGroups: diagram.tableGroups,
        project: diagram.project,
        camera,
      });
      if (result.ok) {
        useCanvasStore.getState().setDiagramCloudLink(localId, result.cloudId, result.remoteUpdatedAt);
      } else {
        alert(
          result.reason === "not-pro"
            ? "Upgrade to Pro to save diagrams to the cloud."
            : "Couldn't save to the cloud — please try again."
        );
      }
    } finally {
      busyRef.current = false;
      setIsBusy(false);
    }
  }, [localId]);

  const makeLocalOnly = useCallback(async () => {
    if (busyRef.current) return;
    const diagram = useCanvasStore.getState().diagrams[localId];
    if (!diagram || diagram.storage !== "cloud" || !diagram.cloudId) return;

    busyRef.current = true;
    setIsBusy(true);
    const cloudId = diagram.cloudId;
    try {
      // Best-effort: pull one last time so a newer remote edit (pushed from
      // another device that reconciliation on THIS device hasn't seen yet)
      // isn't lost the moment the cloud link is severed. If the pull fails,
      // proceed with whatever's locally cached — local is the presumed
      // source of truth per the sync design.
      const pulled = await pullCloudDiagram(cloudId);
      if (pulled.ok && pulled.remoteUpdatedAt > diagram.updatedAt) {
        useCanvasStore.getState().importDiagram(localId, {
          ...pulled.data,
          background: diagram.background,
          snapToGrid: diagram.snapToGrid,
          isFocusModeEnabled: diagram.isFocusModeEnabled,
          storage: "cloud",
          cloudId,
          lastSyncedAt: pulled.remoteUpdatedAt,
        });
        useEditorStore.getState().setCameraForDiagram(localId, pulled.camera);
      }
      await softDeleteCloudDiagram(cloudId);
    } finally {
      useCanvasStore.getState().clearDiagramCloudLink(localId);
      busyRef.current = false;
      setIsBusy(false);
    }
  }, [localId]);

  return { storage, isBusy, saveToCloud, makeLocalOnly };
}
