"use client";

import { useState } from "react";
import { ChevronDown, Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDockStore } from "@/store/useDockStore";
import { PlatformPaletteToggle } from "@/components/diagram-general/platform-palette-toggle";
import { SavingIndicator } from "@/components/diagram-general/saving-indicator";
import DbLuna from "@/components/uiJsxAssets/dbluna-logo";

export function TopNavbar() {
  const {
    selectedDiagram,
    diagrams,
    setSelectedDiagram,
    createDiagram,
    renameDiagram,
  } = useDockStore();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [newDiagramName, setNewDiagramName] = useState("");
  const [diagramToRename, setDiagramToRename] = useState("");
  const [renamedName, setRenamedName] = useState("");

  const handleCreateNew = () => {
    setNewDiagramName("");
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = () => {
    if (newDiagramName.trim()) {
      createDiagram(newDiagramName.trim());
      setIsCreateOpen(false);
      setNewDiagramName("");
    }
  };

  const handleRenameClick = (diagram: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDiagramToRename(diagram);
    setRenamedName(diagram);
    setIsRenameOpen(true);
  };

  const handleRenameSubmit = () => {
    if (renamedName.trim() && renamedName !== diagramToRename) {
      renameDiagram(diagramToRename, renamedName.trim());
    }
    setIsRenameOpen(false);
    setDiagramToRename("");
    setRenamedName("");
  };

  return (
    <>
      <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4">
        {/* Logo */}
        <div className="flex items-center gap-6">
          <DbLuna className="text-foreground w-full max-w-[120px] h-[30px]" />

          {/* Diagram Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="gap-2 min-w-[180px] justify-between font-mono text-sm"
              >
                <span className="truncate">{selectedDiagram}</span>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-[220px]">
              <DropdownMenuItem onClick={handleCreateNew} className="gap-2">
                <Plus className="w-4 h-4" />
                Create new diagram
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {diagrams.map((diagram) => (
                <DropdownMenuItem
                  key={diagram}
                  onClick={() => setSelectedDiagram(diagram)}
                  className={`font-mono text-sm justify-between group ${diagram === selectedDiagram
                    ? "bg-secondary text-primary"
                    : ""
                    }`}
                >
                  <span className="truncate">{diagram}</span>
                  <button
                    onClick={(e) => handleRenameClick(diagram, e)}
                    className="w-6 h-6 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <SavingIndicator />
        </div>
      </header>

      {/* Create Diagram Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Create New Diagram</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="diagram-name" className="text-sm font-medium">
              Diagram Name
            </Label>
            <Input
              id="diagram-name"
              value={newDiagramName}
              onChange={(e) => setNewDiagramName(e.target.value)}
              placeholder="Enter diagram name..."
              className="mt-2"
              onKeyDown={(e) => e.key === "Enter" && handleCreateSubmit()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateSubmit}
              disabled={!newDiagramName.trim()}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Diagram Dialog */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Rename Diagram</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="rename-diagram" className="text-sm font-medium">
              New Name
            </Label>
            <Input
              id="rename-diagram"
              value={renamedName}
              onChange={(e) => setRenamedName(e.target.value)}
              placeholder="Enter new name..."
              className="mt-2"
              onKeyDown={(e) => e.key === "Enter" && handleRenameSubmit()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRenameSubmit}
              disabled={!renamedName.trim() || renamedName === diagramToRename}
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
