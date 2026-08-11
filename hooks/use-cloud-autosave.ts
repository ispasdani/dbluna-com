"use client";

import { useEffect, useRef } from "react";
import { useCanvasStore } from "@/store/useCanvasStore";
import { useEditorStore } from "@/store/useEditorStore";
import { useUpgradeToastStore } from "@/store/useUpgradeToastStore";
import { useConflictBannerStore } from "@/store/useConflictBannerStore";
import { pushCloudDiagram, type CloudDiagramPayload } from "@/lib/diagram-persistence";

const DEBOUNCE_MS = 1500;

// Module-scope, not component state — mirrors debounced-storage.ts's own
// pattern. Only one diagram is ever active at a time, so a single shared
// "retry the last push" slot is enough, and it lets the SavingIndicator's
// Retry button call this from a completely different component instance
// than the one that armed the debounce.
let retryCurrentPush: (() => void) | null = null;

// Set once a push is rejected as stale (Phase B §1) and only cleared once the
// diagram has actually been reloaded with a fresh server snapshot — see
// clearCloudSyncConflict, called from ConflictBanner's Reload action. Without
// this, every further local edit would keep re-arming a push that's
// guaranteed to fail again with the same conflict until the reload happens.
let conflicted = false;

export function retryCloudAutoSaveNow() {
  retryCurrentPush?.();
}

export function clearCloudSyncConflict() {
  conflicted = false;
}

function buildPayload(): CloudDiagramPayload | null {
  const canvas = useCanvasStore.getState();
  const { activeDiagramId } = canvas;
  if (!activeDiagramId) return null;
  const diagram = canvas.diagrams[activeDiagramId];
  if (!diagram || diagram.storage !== "cloud" || !diagram.cloudId) return null;

  const camera = useEditorStore.getState().camera;
  return {
    name: diagram.name,
    tables: canvas.tables,
    notes: canvas.notes,
    areas: canvas.areas,
    relationships: canvas.relationships,
    enums: canvas.enums,
    tableGroups: canvas.tableGroups,
    project: canvas.project,
    camera,
  };
}

async function doPush() {
  const canvas = useCanvasStore.getState();
  const { activeDiagramId } = canvas;
  if (!activeDiagramId) return;
  const diagram = canvas.diagrams[activeDiagramId];
  const cloudId = diagram?.cloudId;
  const payload = buildPayload();
  if (!cloudId || !payload) return;

  const result = await pushCloudDiagram(cloudId, payload, diagram?.lastSyncedAt ?? 0);
  // Bail if the user navigated to a different diagram while the push was in flight.
  if (useCanvasStore.getState().activeDiagramId !== activeDiagramId) return;

  if (result.ok) {
    useCanvasStore.getState().setCloudSyncStatus("synced");
    useCanvasStore.getState().markCloudSynced(activeDiagramId, result.remoteUpdatedAt);
    return;
  }

  useCanvasStore.getState().setCloudSyncStatus("error");
  useCanvasStore.getState().setCloudSyncErrorReason(result.reason === "unauthorized" ? "unknown" : result.reason);

  if (result.reason === "not-pro") {
    // Pro lapsed mid-session — reuse the exact read-only guard + toast the
    // paid-editing gate already built, rather than inventing new UI.
    useCanvasStore.getState().setReadOnly(true);
    useUpgradeToastStore.getState().trigger();
  }

  if (result.reason === "conflict") {
    // Retrying would just fail again with the same stale expectedUpdatedAt —
    // this needs a reload, not a retry, so halt the loop and hand off to the
    // blocking banner instead (Phase B §3).
    conflicted = true;
    useConflictBannerStore.getState().trigger();
  }
}

// Cloud sync's opt-in enforcement is structural, not a flag: this hook is a
// complete no-op unless the active diagram's storage === "cloud". Called
// once from app/(diagram)/d/[id]/page.tsx alongside the existing, untouched
// useDiagramAutoSave (which drives local IndexedDB persistence and has
// nothing to do with Convex — cloud is additive, never a replacement).
export function useCloudAutoSave() {
  const activeDiagramId = useCanvasStore((s) => s.activeDiagramId);
  const storage = useCanvasStore((s) => (s.activeDiagramId ? s.diagrams[s.activeDiagramId]?.storage : undefined));
  const tables = useCanvasStore((s) => s.tables);
  const notes = useCanvasStore((s) => s.notes);
  const areas = useCanvasStore((s) => s.areas);
  const relationships = useCanvasStore((s) => s.relationships);
  const enums = useCanvasStore((s) => s.enums);
  const tableGroups = useCanvasStore((s) => s.tableGroups);
  const project = useCanvasStore((s) => s.project);
  const camera = useEditorStore((s) => s.camera);

  const isInitialMount = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPushedSignatureRef = useRef<string | null>(null);

  const armPush = () => {
    if (conflicted) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    useCanvasStore.getState().setCloudSyncStatus("saving");
    timerRef.current = setTimeout(() => {
      const payload = buildPayload();
      if (!payload) return;
      const signature = JSON.stringify(payload);
      // Skip the network call if nothing actually changed since the last
      // successful push — covers reconciliation's own importDiagram call
      // triggering a spurious push-back of data that was just pulled.
      if (signature === lastPushedSignatureRef.current) {
        useCanvasStore.getState().setCloudSyncStatus("synced");
        return;
      }
      lastPushedSignatureRef.current = signature;
      void doPush();
    }, DEBOUNCE_MS);
  };

  useEffect(() => {
    const retry = () => {
      if (conflicted) return; // needs a reload, see clearCloudSyncConflict
      if (timerRef.current) clearTimeout(timerRef.current);
      lastPushedSignatureRef.current = null; // force the push through even if unchanged
      armPush();
    };
    retryCurrentPush = retry;
    return () => {
      if (retryCurrentPush === retry) retryCurrentPush = null;
    };
  }, []);

  useEffect(() => {
    // Skip the first run after mount/diagram-switch so opening a cloud
    // diagram doesn't immediately re-push it.
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (storage !== "cloud") return;
    armPush();
  }, [tables, notes, areas, relationships, enums, tableGroups, project, camera, storage]);

  // Reset the "skip first run" flag whenever the active diagram changes, and
  // clear any pending timer from the diagram being left. A conflict is
  // specific to the diagram that hit it, so switching away clears it too —
  // the new diagram's own sync loop starts clean.
  useEffect(() => {
    isInitialMount.current = true;
    lastPushedSignatureRef.current = null;
    conflicted = false;
    if (timerRef.current) clearTimeout(timerRef.current);
  }, [activeDiagramId]);

  useEffect(() => {
    const flush = () => {
      if (!timerRef.current || conflicted) return;
      clearTimeout(timerRef.current);
      timerRef.current = null;
      void doPush(); // best-effort, fire-and-forget — can't reliably await inside pagehide
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);
}
