"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { History, Loader2, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCanvasStore } from "@/store/useCanvasStore";
import { useEditorStore } from "@/store/useEditorStore";
import { useCloudSync } from "@/hooks/use-cloud-sync";

interface HistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  localId: string | null;
}

const KIND_LABEL: Record<string, string> = {
  promotion: "Initial",
  auto: "Auto",
  manual: "Manual",
};

// Cloud + Pro only (release-1-0/version-history-plan.md) — mirrors
// InviteDialog's structure exactly: a local diagram gets a "sync to cloud
// first" step, not a hidden button (matches Export/Share/Invite's existing
// "gate on click, not on visibility" pattern). A Free user hits the same
// "Upgrade to Pro" alert that saveToCloud() already surfaces; a Pro user
// with a cloud diagram whose Pro plan lapsed hits diagramVersions.list's
// own requireProDiagramViewer guard instead, surfaced below as errorMessage.
export function HistoryDialog({ open, onOpenChange, localId }: HistoryDialogProps) {
  const diagram = useCanvasStore((s) => (localId ? s.diagrams[localId] : undefined));
  const { storage, isBusy: isSyncing, saveToCloud } = useCloudSync(localId ?? "");

  // Same fields TopNavbar already reads for currentDiagramData — only the
  // active diagram is ever live-edited in these top-level store fields.
  const tables = useCanvasStore((s) => s.tables);
  const notes = useCanvasStore((s) => s.notes);
  const areas = useCanvasStore((s) => s.areas);
  const relationships = useCanvasStore((s) => s.relationships);
  const enums = useCanvasStore((s) => s.enums);
  const tableGroups = useCanvasStore((s) => s.tableGroups);
  const project = useCanvasStore((s) => s.project);
  const camera = useEditorStore((s) => s.camera);

  const [labelInput, setLabelInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cloudId = diagram?.cloudId as Id<"diagrams"> | null | undefined;
  const updateDiagram = useMutation(api.diagrams.update);
  const restoreVersion = useMutation(api.diagramVersions.restore);
  const versions = useQuery(
    api.diagramVersions.list,
    cloudId ? { diagramId: cloudId } : "skip"
  );

  const reset = () => {
    setLabelInput("");
    setErrorMessage(null);
  };

  const handleSyncToCloud = async () => {
    await saveToCloud();
  };

  const handleSaveVersion = async () => {
    if (!cloudId || !localId || !diagram) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const result = await updateDiagram({
        diagramId: cloudId,
        name: diagram.name,
        tables,
        notes,
        areas,
        relationships,
        enums,
        tableGroups,
        project: project ?? undefined,
        camera,
        expectedUpdatedAt: diagram.lastSyncedAt ?? 0,
        // Always non-empty so the server always creates a manual version on
        // this specific action, even if the user left the label blank.
        versionLabel: labelInput.trim() || `Saved ${new Date().toLocaleString()}`,
      });
      // Keeps use-cloud-autosave.ts's next debounced push from immediately
      // hitting CONFLICT against the updatedAt this just set.
      useCanvasStore.getState().markCloudSynced(localId, result.updatedAt);
      setLabelInput("");
    } catch (err) {
      setErrorMessage(
        err instanceof ConvexError && typeof err.data === "string"
          ? err.data
          : "Couldn't save this version — please try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestore = async (versionId: Id<"diagramVersions">) => {
    if (!cloudId) return;
    const confirmed = window.confirm(
      "Restore this version? Your current state is saved as a new version first, so this can always be undone."
    );
    if (!confirmed) return;

    setRestoringId(versionId);
    setErrorMessage(null);
    try {
      // No local store update here — the reactive cloud-reconciliation
      // subscription (release-1-0/collaboration-plan.md Phase B §2) picks up
      // the resulting updatedAt bump and merges the restored content in on
      // its own, on every connected device.
      await restoreVersion({ diagramId: cloudId, versionId });
    } catch (err) {
      setErrorMessage(
        err instanceof ConvexError && typeof err.data === "string"
          ? err.data
          : "Couldn't restore this version — please try again."
      );
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Version history
          </DialogTitle>
        </DialogHeader>

        {!diagram ? null : storage === "local" ? (
          <div className="py-2 space-y-4">
            <p className="text-sm text-muted-foreground">
              Version history needs <span className="font-medium text-foreground">{diagram.name}</span>{" "}
              to be synced to the cloud. You can still keep it local-only if you skip this.
            </p>
            <Button onClick={handleSyncToCloud} disabled={isSyncing} className="gap-2">
              {isSyncing && <Loader2 className="w-4 h-4 animate-spin" />}
              Sync to cloud & continue
            </Button>
          </div>
        ) : (
          <div className="py-2 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  placeholder="e.g. Before restructuring orders table"
                  onKeyDown={(e) => e.key === "Enter" && handleSaveVersion()}
                />
                <Button onClick={handleSaveVersion} disabled={isSaving} className="gap-2 shrink-0">
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save version
                </Button>
              </div>
              {errorMessage && <p className="text-xs text-destructive">{errorMessage}</p>}
            </div>

            <ScrollArea className="h-[320px] pr-3">
              {versions === undefined ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>
              ) : versions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No versions yet.</p>
              ) : (
                <ul className="space-y-2">
                  {versions.map((version) => (
                    <li
                      key={version._id}
                      className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{KIND_LABEL[version.kind] ?? version.kind}</Badge>
                          {version.label && (
                            <span className="truncate font-medium">{version.label}</span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(version.createdAt).toLocaleString()} · {version.createdByName}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 shrink-0"
                        disabled={restoringId === version._id}
                        onClick={() => handleRestore(version._id)}
                      >
                        {restoringId === version._id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5" />
                        )}
                        Restore
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
