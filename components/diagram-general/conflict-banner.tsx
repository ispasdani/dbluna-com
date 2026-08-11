"use client";

import { useState } from "react";
import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { useConflictBannerStore } from "@/store/useConflictBannerStore";
import { useCanvasStore } from "@/store/useCanvasStore";
import { useEditorStore } from "@/store/useEditorStore";
import { pullCloudDiagram } from "@/lib/diagram-persistence";
import { clearCloudSyncConflict } from "@/hooks/use-cloud-autosave";

// Deliberately no auto-merge (release-1-0/collaboration-plan.md Phase B §3) —
// this is the one place a rejected push (diagrams.update's "CONFLICT") ends
// up visible to the user, since use-cloud-autosave.ts halts its own debounce
// loop the moment it sees one rather than silently overwriting a
// collaborator's edit.
export function ConflictBanner() {
  const visible = useConflictBannerStore((s) => s.visible);
  const dismiss = useConflictBannerStore((s) => s.dismiss);
  const [isReloading, setIsReloading] = useState(false);

  const handleReload = async () => {
    const { activeDiagramId, diagrams } = useCanvasStore.getState();
    const diagram = activeDiagramId ? diagrams[activeDiagramId] : undefined;
    if (!activeDiagramId || !diagram?.cloudId) {
      dismiss();
      return;
    }

    setIsReloading(true);
    const result = await pullCloudDiagram(diagram.cloudId);
    if (result.ok) {
      useCanvasStore.getState().importDiagram(activeDiagramId, {
        ...result.data,
        background: diagram.background,
        snapToGrid: diagram.snapToGrid,
        isFocusModeEnabled: diagram.isFocusModeEnabled,
        storage: "cloud",
        cloudId: diagram.cloudId,
        lastSyncedAt: result.remoteUpdatedAt,
      });
      useEditorStore.getState().setCameraForDiagram(activeDiagramId, result.camera);
      useCanvasStore.getState().setCloudSyncStatus("synced");
      useCanvasStore.getState().setCloudSyncErrorReason(null);
      clearCloudSyncConflict();
      dismiss();
    }
    setIsReloading(false);
  };

  if (!visible) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-6 left-1/2 z-[200] -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-neutral-950/95 px-5 py-4 shadow-[0_0_50px_-10px_rgba(245,158,11,0.6)] backdrop-blur">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
        </div>

        <div className="pr-1">
          <p className="text-sm font-medium text-white">Someone else changed this diagram</p>
          <p className="text-xs text-white/60">
            Reload to see their changes — your local changes will be lost if you continue editing
            without reloading.
          </p>
        </div>

        <button
          type="button"
          onClick={handleReload}
          disabled={isReloading}
          className="ml-2 flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-neutral-950 transition-transform hover:scale-105 disabled:opacity-60 disabled:hover:scale-100"
        >
          <RefreshCw className={`h-3 w-3 ${isReloading ? "animate-spin" : ""}`} />
          Reload
        </button>

        <button
          onClick={dismiss}
          className="ml-1 shrink-0 rounded-md p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
