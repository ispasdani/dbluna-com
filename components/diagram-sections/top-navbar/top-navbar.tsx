"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, Pencil, Database, Download, FileText, FolderOpen, Upload } from "lucide-react";
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
import { useViewStore } from "@/store/useViewStore";
import { useDockStore } from "@/store/useDockStore";
import { useCanvasStore } from "@/store/useCanvasStore";
import { SavingIndicator } from "@/components/diagram-general/saving-indicator";
import { MyDiagramsDialog } from "@/components/diagram-sections/top-navbar/my-diagrams-dialog";
import { exportDiagramAsJson, exportDiagramAsDbml, parseImportedDiagramJson } from "@/lib/diagram-io";
import DbLuna from "@/components/uiJsxAssets/dbluna-logo";

export function TopNavbar() {
  const router = useRouter();
  const {
    selectedDiagram,
    diagrams,
    setSelectedDiagram,
    createDiagram,
    renameDiagram,
  } = useDockStore();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isMyDiagramsOpen, setIsMyDiagramsOpen] = useState(false);
  const [newDiagramName, setNewDiagramName] = useState("");
  const [diagramToRename, setDiagramToRename] = useState("");
  const [renamedName, setRenamedName] = useState("");

  const { workspaceMode, setWorkspaceMode } = useViewStore();

  const activeDiagramId = useCanvasStore((s) => s.activeDiagramId);
  const canvasDiagrams = useCanvasStore((s) => s.diagrams);
  const tables = useCanvasStore((s) => s.tables);
  const notes = useCanvasStore((s) => s.notes);
  const areas = useCanvasStore((s) => s.areas);
  const relationships = useCanvasStore((s) => s.relationships);
  const enums = useCanvasStore((s) => s.enums);
  const tableGroups = useCanvasStore((s) => s.tableGroups);
  const project = useCanvasStore((s) => s.project);
  const background = useCanvasStore((s) => s.background);
  const snapToGrid = useCanvasStore((s) => s.snapToGrid);
  const isFocusModeEnabled = useCanvasStore((s) => s.isFocusModeEnabled);
  const importDiagram = useCanvasStore((s) => s.importDiagram);

  const currentDiagramName =
    (activeDiagramId && canvasDiagrams[activeDiagramId]?.name) || "Untitled diagram";

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportJson = () => {
    exportDiagramAsJson(
      {
        name: currentDiagramName,
        updatedAt: Date.now(),
        tables,
        notes,
        areas,
        relationships,
        enums,
        tableGroups,
        project,
        background,
        snapToGrid,
        isFocusModeEnabled,
      },
      currentDiagramName
    );
  };

  const handleExportDbml = () => {
    exportDiagramAsDbml(tables, relationships, currentDiagramName);
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const text = await file.text();
    const data = parseImportedDiagramJson(text);
    if (!data) {
      alert("That file doesn't look like a valid diagram export.");
      return;
    }

    // Import always creates a new diagram — never overwrite the one open now.
    const newId = crypto.randomUUID();
    importDiagram(newId, data);
    router.push(`/d/${newId}`);
  };

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

          <Button
            variant={workspaceMode === "docs" ? "secondary" : "ghost"}
            size="sm"
            className="gap-2"
            onClick={() => setWorkspaceMode(workspaceMode === "docs" ? "diagram" : "docs")}
          >
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">DBML Docs</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => setIsMyDiagramsOpen(true)}
          >
            <FolderOpen className="w-4 h-4" />
            <span className="hidden sm:inline">My Diagrams</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={handleExportJson} className="gap-2">
                <FileText className="w-4 h-4" />
                Export as JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportDbml} className="gap-2">
                <Database className="w-4 h-4" />
                Export as DBML
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" size="sm" className="gap-2" onClick={handleImportClick}>
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Import</span>
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportFile}
          />

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

      <MyDiagramsDialog open={isMyDiagramsOpen} onOpenChange={setIsMyDiagramsOpen} />
    </>
  );
}
