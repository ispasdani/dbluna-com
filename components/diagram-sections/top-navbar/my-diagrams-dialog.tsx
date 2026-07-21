"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Copy, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useCanvasStore, getEffectiveDiagrams } from "@/store/useCanvasStore";

interface MyDiagramsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MyDiagramsDialog({ open, onOpenChange }: MyDiagramsDialogProps) {
  const router = useRouter();
  const diagrams = useCanvasStore(getEffectiveDiagrams);
  const activeDiagramId = useCanvasStore((s) => s.activeDiagramId);
  const renameDiagram = useCanvasStore((s) => s.renameDiagram);
  const duplicateDiagram = useCanvasStore((s) => s.duplicateDiagram);
  const deleteDiagram = useCanvasStore((s) => s.deleteDiagram);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const rows = Object.entries(diagrams).sort(
    ([, a], [, b]) => b.updatedAt - a.updatedAt
  );

  const handleOpen = (id: string) => {
    onOpenChange(false);
    router.push(`/d/${id}`);
  };

  const startRename = (id: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
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
    duplicateDiagram(id);
  };

  const confirmDelete = () => {
    if (!deleteTargetId) return;
    if (deleteTargetId === activeDiagramId) {
      // Navigate away first so the canvas never re-renders against a
      // just-deleted active diagram id (which would silently recreate it).
      onOpenChange(false);
      router.push("/");
    }
    deleteDiagram(deleteTargetId);
    setDeleteTargetId(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>My Diagrams</DialogTitle>
          </DialogHeader>

          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No diagrams yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Tables</TableHead>
                  <TableHead>Last modified</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(([id, diagram]) => (
                  <TableRow
                    key={id}
                    className="cursor-pointer"
                    onClick={() => renamingId !== id && handleOpen(id)}
                  >
                    <TableCell className="font-medium">
                      {renamingId === id ? (
                        <div
                          className="flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitRename();
                              if (e.key === "Escape") cancelRename();
                            }}
                            className="h-7 text-sm"
                            autoFocus
                          />
                          <Button size="icon-sm" variant="ghost" onClick={commitRename}>
                            <Check className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon-sm" variant="ghost" onClick={cancelRename}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <span className="truncate">
                          {diagram.name}
                          {id === activeDiagramId && (
                            <span className="ml-2 text-xs text-muted-foreground">(current)</span>
                          )}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{diagram.tables.length}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(diagram.updatedAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={(e) => startRename(id, diagram.name, e)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={(e) => handleDuplicate(id, e)}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTargetId(id);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTargetId !== null} onOpenChange={(v) => !v && setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this diagram?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes it from local storage permanently. This can&apos;t be undone.
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
