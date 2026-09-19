"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Cloud,
  CloudOff,
  Copy,
  Laptop,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useCanvasStore } from "@/store/useCanvasStore";
import { useUpgradeToastStore } from "@/store/useUpgradeToastStore";
import { useCapabilities } from "@/components/diagram-general/capabilities-context";
import { useCloudSync } from "@/hooks/use-cloud-sync";
import { softDeleteCloudDiagram } from "@/lib/diagram-persistence";
import { api } from "@/convex/_generated/api";
import { SchemaThumb } from "@/components/diagram-general/schema-thumb";
import { splitSchemaName } from "@/lib/schema-namespace";
import { cn } from "@/lib/utils";
import styles from "./my-diagrams-dialog.module.scss";

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

// Cloud action for the selected diagram — a subcomponent so useCloudSync (a
// hook) runs for exactly the diagram shown.
function CloudAction({ id }: { id: string }) {
  const { storage, isBusy, saveToCloud, makeLocalOnly } = useCloudSync(id);

  if (storage === "cloud") {
    return (
      <button
        type="button"
        className={styles.btn}
        disabled={isBusy}
        title="Stop syncing and keep it on this device only"
        onClick={() => {
          void makeLocalOnly().then((result) => {
            if (!result.ok && result.message) alert(result.message);
          });
        }}
      >
        <CloudOff className="w-3.5 h-3.5" />
        Make local-only
      </button>
    );
  }

  return (
    <button type="button" className={styles.btn} disabled={isBusy} onClick={() => void saveToCloud()}>
      <Cloud className="w-3.5 h-3.5" />
      Save to cloud
    </button>
  );
}

interface MyDiagramsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  readOnly?: boolean;
}

export function MyDiagramsDialog({ open, onOpenChange, readOnly = false }: MyDiagramsDialogProps) {
  const router = useRouter();
  const rawDiagrams = useCanvasStore((s) => s.diagrams);
  const activeDiagramId = useCanvasStore((s) => s.activeDiagramId);
  const createDiagram = useCanvasStore((s) => s.createDiagram);
  const renameDiagram = useCanvasStore((s) => s.renameDiagram);
  const duplicateDiagram = useCanvasStore((s) => s.duplicateDiagram);
  const deleteDiagram = useCanvasStore((s) => s.deleteDiagram);

  const { diagramCap } = useCapabilities();

  // Live canvas fields for the active diagram, so it shows up-to-date in the
  // list even before a diagram switch writes it back into `diagrams`. Selected
  // individually (instead of via a selector that builds a new object) so each
  // stays referentially stable unless actually mutated.
  const activeTables = useCanvasStore((s) => s.tables);
  const activeNotes = useCanvasStore((s) => s.notes);
  const activeAreas = useCanvasStore((s) => s.areas);
  const activeRelationships = useCanvasStore((s) => s.relationships);
  const activeEnums = useCanvasStore((s) => s.enums);
  const activeTableGroups = useCanvasStore((s) => s.tableGroups);
  const activeProject = useCanvasStore((s) => s.project);
  const activeBackground = useCanvasStore((s) => s.background);
  const activeSnapToGrid = useCanvasStore((s) => s.snapToGrid);
  const activeFocusMode = useCanvasStore((s) => s.isFocusModeEnabled);

  const [isCreating, setIsCreating] = useState(false);
  const [createName, setCreateName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isCloudSectionOpen, setIsCloudSectionOpen] = useState(false);
  const [query, setQuery] = useState("");
  // The diagram shown on the right; null falls back to the open one.
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const diagramCount = Object.keys(rawDiagrams).length;
  const atDiagramCap = diagramCap != null && diagramCount >= diagramCap;

  const handleCreateNew = () => {
    if (readOnly) { useUpgradeToastStore.getState().trigger(); return; }
    if (atDiagramCap) { useUpgradeToastStore.getState().trigger(); return; }
    setCreateName("");
    setIsCreating(true);
  };

  const commitCreate = () => {
    if (!createName.trim()) { setIsCreating(false); return; }
    if (atDiagramCap) { useUpgradeToastStore.getState().trigger(); setIsCreating(false); return; }
    const newId = createDiagram(createName.trim());
    setIsCreating(false);
    onOpenChange(false);
    if (newId) router.push(`/d/${newId}`);
  };

  const cancelCreate = () => { setIsCreating(false); setCreateName(""); };

  // Cross-device discovery: cloud diagrams this account owns that this
  // browser hasn't seen locally yet — see app/(diagram)/d/cloud/[cloudId]/page.tsx.
  const cloudDiagrams = useQuery(api.diagrams.list);
  const localCloudIds = useMemo(
    () => new Set(Object.values(rawDiagrams).map((d) => d.cloudId).filter((v): v is string => v !== null)),
    [rawDiagrams]
  );
  const undiscoveredCloudDiagrams = useMemo(
    () =>
      (cloudDiagrams ?? [])
        .filter((d): d is NonNullable<typeof d> => d !== null)
        .filter((d) => !localCloudIds.has(d._id)),
    [cloudDiagrams, localCloudIds]
  );

  const diagrams = useMemo(() => {
    const existing = activeDiagramId ? rawDiagrams[activeDiagramId] : undefined;
    if (!activeDiagramId || !existing) return rawDiagrams;
    return {
      ...rawDiagrams,
      [activeDiagramId]: {
        ...existing,
        tables: activeTables,
        notes: activeNotes,
        areas: activeAreas,
        relationships: activeRelationships,
        enums: activeEnums,
        tableGroups: activeTableGroups,
        project: activeProject,
        background: activeBackground,
        snapToGrid: activeSnapToGrid,
        isFocusModeEnabled: activeFocusMode,
      },
    };
  }, [
    rawDiagrams,
    activeDiagramId,
    activeTables,
    activeNotes,
    activeAreas,
    activeRelationships,
    activeEnums,
    activeTableGroups,
    activeProject,
    activeBackground,
    activeSnapToGrid,
    activeFocusMode,
  ]);

  const rows = Object.entries(diagrams).sort(([, a], [, b]) => b.updatedAt - a.updatedAt);
  const needle = query.trim().toLowerCase();
  const visibleRows = needle ? rows.filter(([, d]) => d.name.toLowerCase().includes(needle)) : rows;

  const shownId =
    (selectedId && diagrams[selectedId] ? selectedId : null) ??
    (activeDiagramId && diagrams[activeDiagramId] ? activeDiagramId : null) ??
    rows[0]?.[0] ??
    null;
  const shown = shownId ? diagrams[shownId] : null;
  const shownSchemas = shown
    ? new Set(shown.tables.map((t) => splitSchemaName(t.name).schema).filter(Boolean)).size
    : 0;

  const handleOpen = (id: string) => {
    onOpenChange(false);
    router.push(`/d/${id}`);
  };

  const startRename = (id: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (readOnly) {
      useUpgradeToastStore.getState().trigger();
      return;
    }
    setRenamingId(id);
    setRenameValue(currentName);
  };

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      renameDiagram(renamingId, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue("");
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue("");
  };

  const handleDuplicate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (readOnly) {
      useUpgradeToastStore.getState().trigger();
      return;
    }
    const copyId = duplicateDiagram(id);
    if (copyId) setSelectedId(copyId);
  };

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (readOnly) {
      useUpgradeToastStore.getState().trigger();
      return;
    }
    setDeleteTargetId(id);
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    const target = diagrams[deleteTargetId];
    if (target?.storage === "cloud" && target.cloudId) {
      const result = await softDeleteCloudDiagram(target.cloudId);
      if (!result.ok) {
        // The orphan guard (release-1-0/collaboration-plan.md Phase A §6) is a
        // deliberate rejection, not a reachability problem — removing the
        // local entry anyway would strand the owner's own access to a
        // diagram that's still fully alive in the cloud with active
        // collaborators. Stop here instead of the network-failure fallback.
        if (result.message.includes("collaborators")) {
          alert(result.message);
          setDeleteTargetId(null);
          return;
        }
        // Genuine best-effort case (Convex unreachable, etc.): don't trap the
        // user unable to clean up their local list — proceed and flag that
        // the cloud copy may need manual cleanup.
        alert("Removed locally; couldn't reach the cloud copy — it may need manual cleanup.");
      }
    }
    if (deleteTargetId === activeDiagramId) {
      // Navigate away first so the canvas never re-renders against a
      // just-deleted active diagram id (which would silently recreate it).
      onOpenChange(false);
      router.push("/");
    }
    deleteDiagram(deleteTargetId);
    if (selectedId === deleteTargetId) setSelectedId(null);
    setDeleteTargetId(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={styles.content}>
          <div className={styles.header}>
            <DialogTitle className={styles.title}>My diagrams</DialogTitle>
            <DialogDescription className="sr-only">
              Pick a diagram to see its details, then open, rename, duplicate or delete it.
            </DialogDescription>
            <span className={styles.spacer} />
            {diagramCap != null && (
              <span className={cn(styles.meter, atDiagramCap && styles.full)}>
                <span className={styles.bar}>
                  <i style={{ width: `${Math.min(100, (diagramCount / diagramCap) * 100)}%` }} />
                </span>
                {diagramCount} of {diagramCap} diagrams
                {atDiagramCap && (
                  <button type="button" className={styles.link} onClick={() => useUpgradeToastStore.getState().trigger()}>
                    Upgrade
                  </button>
                )}
              </span>
            )}
          </div>

          <div className={styles.split}>
            {/* ── List ── */}
            <div className={styles.left}>
              <label className={styles.search}>
                <Search className="w-3.5 h-3.5 shrink-0" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search diagrams"
                  aria-label="Search diagrams"
                />
              </label>

              <div className={styles.rows} role="listbox" aria-label="Diagrams">
                {isCreating && (
                  <div className={styles.createRow}>
                    <Input
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitCreate();
                        if (e.key === "Escape") cancelCreate();
                      }}
                      placeholder="Name your diagram"
                      aria-label="New diagram name"
                      className={styles.nameInput}
                      autoFocus
                    />
                    <button type="button" className={styles.btn} onClick={commitCreate} aria-label="Create">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" className={styles.btn} onClick={cancelCreate} aria-label="Cancel">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {visibleRows.map(([id, diagram]) => (
                  <button
                    key={id}
                    type="button"
                    role="option"
                    aria-selected={id === shownId}
                    className={cn(styles.row, id === shownId && styles.rowOn)}
                    onClick={() => {
                      setSelectedId(id);
                      if (renamingId && renamingId !== id) cancelRename();
                    }}
                    onDoubleClick={() => handleOpen(id)}
                    title="Double-click to open"
                  >
                    <span className={styles.mini}>
                      <SchemaThumb
                        tables={diagram.tables}
                        relationships={diagram.relationships}
                        height={28}
                        padding={120}
                        columns={false}
                      />
                    </span>
                    <span className={styles.rowText}>
                      <b>{diagram.name}</b>
                      <small>
                        {diagram.tables.length} table{diagram.tables.length === 1 ? "" : "s"} ·{" "}
                        {relativeTime(diagram.updatedAt)}
                      </small>
                    </span>
                    {diagram.storage === "cloud" && (
                      <span className={styles.rowCloud} title="Saved to cloud">
                        <Cloud className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </button>
                ))}

                {rows.length === 0 && !isCreating && <p className={styles.emptyList}>No diagrams yet.</p>}
                {rows.length > 0 && visibleRows.length === 0 && (
                  <p className={styles.emptyList}>No diagrams match “{query.trim()}”.</p>
                )}
              </div>

              {!readOnly && (
                <div className={styles.newRow}>
                  <button
                    type="button"
                    className={styles.primary}
                    onClick={handleCreateNew}
                    disabled={atDiagramCap}
                    title={atDiagramCap ? `${diagramCount}/${diagramCap} diagrams used — upgrade to Pro for unlimited` : undefined}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New diagram
                  </button>
                </div>
              )}

              {undiscoveredCloudDiagrams.length > 0 && (
                <div className={cn(styles.cloudSection, !isCloudSectionOpen && styles.cloudClosed)}>
                  <button
                    type="button"
                    className={styles.cloudToggle}
                    aria-expanded={isCloudSectionOpen}
                    onClick={() => setIsCloudSectionOpen((v) => !v)}
                  >
                    <ChevronDown className={cn("w-3.5 h-3.5", styles.chev)} />
                    <Cloud className="w-3.5 h-3.5" />
                    Cloud diagrams not on this device ({undiscoveredCloudDiagrams.length})
                  </button>
                  {isCloudSectionOpen && (
                    <div className={styles.cloudItems}>
                      {undiscoveredCloudDiagrams.map((d) => (
                        <button
                          key={d._id}
                          type="button"
                          className={styles.cloudItem}
                          onClick={() => {
                            onOpenChange(false);
                            router.push(`/d/cloud/${d._id}`);
                          }}
                        >
                          <Cloud className="w-3.5 h-3.5" />
                          <span>{d.name}</span>
                          <span className={styles.cloudDate}>{relativeTime(d.updatedAt)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Detail ── */}
            <div className={styles.right}>
              {shown && shownId ? (
                <>
                  <SchemaThumb
                    tables={shown.tables}
                    relationships={shown.relationships}
                    height={220}
                    className={styles.preview}
                  />

                  <div className={styles.detailTitle}>
                    {renamingId === shownId ? (
                      <Input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename();
                          if (e.key === "Escape") cancelRename();
                        }}
                        aria-label="Diagram name"
                        className={styles.nameInput}
                        autoFocus
                      />
                    ) : (
                      <h4 title={shown.name}>{shown.name}</h4>
                    )}
                    {shownId === activeDiagramId && <span className={cn(styles.tag, styles.current)}>Open now</span>}
                  </div>

                  <div className={styles.stats}>
                    <div>
                      <b>{shown.tables.length}</b>tables
                    </div>
                    <div>
                      <b>{shown.relationships.length}</b>relationships
                    </div>
                    <div>
                      <b>{shownSchemas}</b>schemas
                    </div>
                    <div>
                      <b>{shown.notes.length}</b>notes
                    </div>
                  </div>

                  <dl className={styles.kv}>
                    <dt>Storage</dt>
                    <dd>
                      {shown.storage === "cloud" ? (
                        <span className={cn(styles.tag, styles.cloud)}>
                          <Cloud className="w-3 h-3" />
                          Cloud
                        </span>
                      ) : (
                        <span className={cn(styles.tag, styles.local)}>
                          <Laptop className="w-3 h-3" />
                          This device
                        </span>
                      )}
                    </dd>
                    <dt>Last edited</dt>
                    <dd>
                      {relativeTime(shown.updatedAt)} ·{" "}
                      {new Date(shown.updatedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                    </dd>
                  </dl>

                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.primary}
                      onClick={() => (shownId === activeDiagramId ? onOpenChange(false) : handleOpen(shownId))}
                    >
                      {shownId === activeDiagramId ? "Back to diagram" : "Open diagram"}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    {!readOnly && (
                      <>
                        <button type="button" className={styles.btn} onClick={(e) => startRename(shownId, shown.name, e)}>
                          <Pencil className="w-3.5 h-3.5" />
                          Rename
                        </button>
                        <button type="button" className={styles.btn} onClick={(e) => handleDuplicate(shownId, e)}>
                          <Copy className="w-3.5 h-3.5" />
                          Duplicate
                        </button>
                        <CloudAction id={shownId} />
                        <button
                          type="button"
                          className={cn(styles.btn, styles.danger)}
                          onClick={(e) => handleDeleteClick(shownId, e)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <p className={styles.emptyDetail}>Create a diagram to get started.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTargetId !== null} onOpenChange={(v) => !v && setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this diagram?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTargetId && diagrams[deleteTargetId]?.storage === "cloud"
                ? "It's removed from this device and moved to trash in the cloud. This can't be undone here."
                : "It's removed from this device permanently. This can't be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
