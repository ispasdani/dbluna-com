"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { AlertCircle, Cloud, History, Loader2, RotateCcw, Save } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCanvasStore } from "@/store/useCanvasStore";
import { useEditorStore } from "@/store/useEditorStore";
import { useCloudSync } from "@/hooks/use-cloud-sync";
import { cn } from "@/lib/utils";
import styles from "./small-dialog.module.scss";

interface HistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  localId: string | null;
}

const KIND_LABEL: Record<string, string> = {
  promotion: "First save",
  auto: "Auto",
  manual: "Saved",
};

/** "12 min ago", "3 h ago", "yesterday", then a date. */
function relativeTime(t: number): string {
  const minutes = Math.round((Date.now() - t) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(t).toLocaleDateString();
}

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
  // The version whose Restore was clicked once and now awaits a confirm.
  const [confirmId, setConfirmId] = useState<string | null>(null);
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
    setConfirmId(null);
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
          : "Couldn't save this version. Try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestore = async (versionId: Id<"diagramVersions">) => {
    if (!cloudId) return;
    setConfirmId(null);
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
          : "Couldn't restore this version. Try again."
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
      <DialogContent className={cn(styles.content, styles.wide)}>
        <DialogHeader className={styles.header}>
          <span className={styles.badge}>
            <History className="size-4" />
          </span>
          <div className="min-w-0">
            <DialogTitle className={styles.title}>Version history</DialogTitle>
            <DialogDescription className={styles.subtitle}>
              {diagram ? <b>{diagram.name}</b> : "Save and restore versions"}
            </DialogDescription>
          </div>
        </DialogHeader>

        {!diagram ? null : storage === "local" ? (
          <>
            <div className={styles.body}>
              <div className={styles.gate}>
                <span className={styles.gateIcon}>
                  <Cloud className="size-5" />
                </span>
                <span className={styles.gateTitle}>Sync to the cloud first</span>
                <p>
                  Version history needs <b>{diagram.name}</b> to be synced to the cloud. If you skip this, you can keep
                  it on this device only.
                </p>
              </div>
            </div>
            <div className={styles.foot}>
              <span className={styles.spacer} />
              <button type="button" className={styles.primary} onClick={handleSyncToCloud} disabled={isSyncing}>
                {isSyncing ? <Loader2 className="size-4 animate-spin" /> : <Cloud className="size-4" />}
                Sync to cloud and continue
              </button>
            </div>
          </>
        ) : (
          <div className={styles.body}>
            <div className={styles.field}>
              <span className={styles.label}>Save the current state</span>
              <div className={styles.inline}>
                <Input
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  placeholder="Before restructuring the orders table"
                  aria-label="Version name"
                  className={styles.input}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveVersion()}
                />
                <button type="button" className={styles.primary} onClick={handleSaveVersion} disabled={isSaving}>
                  {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Save version
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className={cn(styles.note, styles.noteError)} role="alert">
                <AlertCircle className="size-4" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className={styles.field}>
              <span className={styles.label}>
                Versions{versions && versions.length > 0 ? ` · ${versions.length}` : ""}
              </span>
              {versions === undefined ? (
                <p className={styles.empty}>
                  <Loader2 className="mx-auto mb-1 size-4 animate-spin" />
                  Loading versions…
                </p>
              ) : versions.length === 0 ? (
                <p className={styles.empty}>No versions yet. Save one above to have a point to come back to.</p>
              ) : (
                <ul className={styles.timeline}>
                  {versions.map((version) => {
                    const isConfirming = confirmId === version._id;
                    const isRestoring = restoringId === version._id;
                    return (
                      <li key={version._id} className={styles.version}>
                        <span
                          className={cn(
                            styles.versionDot,
                            version.kind === "manual" && styles.dotManual,
                            version.kind === "promotion" && styles.dotInitial
                          )}
                          aria-hidden
                        />
                        <span className={styles.versionText}>
                          <span className={styles.versionTitle}>
                            <span className={cn(styles.tag, version.kind === "manual" && styles.tagAccent, version.kind === "promotion" && styles.tagOk)}>
                              {KIND_LABEL[version.kind] ?? version.kind}
                            </span>
                            {version.label && <span title={version.label}>{version.label}</span>}
                          </span>
                          <small title={new Date(version.createdAt).toLocaleString()}>
                            {isConfirming
                              ? "Your current state is saved as a new version first, so this can be undone."
                              : `${relativeTime(version.createdAt)} · ${version.createdByName}`}
                          </small>
                        </span>
                        <span className={styles.versionActions}>
                          {isConfirming ? (
                            <>
                              <button
                                type="button"
                                className={cn(styles.secondary, styles.small)}
                                onClick={() => setConfirmId(null)}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                className={cn(styles.primary, styles.small)}
                                onClick={() => handleRestore(version._id)}
                              >
                                Restore
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className={cn(styles.secondary, styles.small)}
                              disabled={isRestoring}
                              onClick={() => setConfirmId(version._id)}
                            >
                              {isRestoring ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <RotateCcw className="size-3.5" />
                              )}
                              {isRestoring ? "Restoring…" : "Restore"}
                            </button>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
