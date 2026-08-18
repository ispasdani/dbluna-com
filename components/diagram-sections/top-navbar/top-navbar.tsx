"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, Plus, Database, Download, FileText, FolderOpen, Upload, Share2, Sparkles, FileCode, UserPlus, History, FileSpreadsheet, FileArchive } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
import { useCanvasStore } from "@/store/useCanvasStore";
import { SavingIndicator } from "@/components/diagram-general/saving-indicator";
import { MyDiagramsDialog } from "@/components/diagram-sections/top-navbar/my-diagrams-dialog";
import { ShareDialog } from "@/components/diagram-sections/top-navbar/share-dialog";
import { InviteDialog } from "@/components/diagram-sections/top-navbar/invite-dialog";
import { HistoryDialog } from "@/components/diagram-sections/top-navbar/history-dialog";
import { PresenceAvatars } from "@/components/diagram-sections/top-navbar/presence-avatars";
import { UserMenu } from "@/components/diagram-sections/top-navbar/user-menu";
import {
  ImportSchemaDialog,
  type ImportSchemaTab,
} from "@/components/diagram-sections/import-schema-dialog";
import {
  exportDiagramAsJson,
  exportDiagramAsDbml,
  exportDiagramAsSql,
  exportDiagramAsSvg,
  parseImportedDiagramJson,
} from "@/lib/diagram-io";
import { SQL_DIALECTS, type SqlDialect } from "@/lib/generator/sql-generator";
import { useUpgradeToastStore } from "@/store/useUpgradeToastStore";
import DbLuna from "@/components/uiJsxAssets/dbluna-logo";

interface TopNavbarProps {
  readOnly?: boolean;
}

export function TopNavbar({ readOnly = false }: TopNavbarProps) {
  const router = useRouter();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isMyDiagramsOpen, setIsMyDiagramsOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [newDiagramName, setNewDiagramName] = useState("");
  // Schema import (DB / CSV / BACPAC) — the tab is chosen by the Import menu
  // item the user picked, so each item opens straight onto its own source.
  const [isImportSchemaOpen, setIsImportSchemaOpen] = useState(false);
  const [importSchemaTab, setImportSchemaTab] = useState<ImportSchemaTab>("postgresql");

  const { workspaceMode, setWorkspaceMode } = useViewStore();

  const activeDiagramId = useCanvasStore((s) => s.activeDiagramId);
  const canvasDiagrams = useCanvasStore((s) => s.diagrams);
  const createDiagram = useCanvasStore((s) => s.createDiagram);
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

  // Single source of truth for "the currently open diagram" — used by both
  // JSON export and the share dialog so they can never drift out of sync.
  // updatedAt is decorative here (export/share both ignore or drop it) — read
  // the last known value from the store rather than calling Date.now() during
  // render, which React's purity rule flags.
  const currentDiagramData = useMemo(
    () => ({
      name: currentDiagramName,
      updatedAt: (activeDiagramId && canvasDiagrams[activeDiagramId]?.updatedAt) || 0,
      storage: (activeDiagramId && canvasDiagrams[activeDiagramId]?.storage) || "local",
      cloudId: (activeDiagramId && canvasDiagrams[activeDiagramId]?.cloudId) || null,
      lastSyncedAt: (activeDiagramId && canvasDiagrams[activeDiagramId]?.lastSyncedAt) || null,
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
    }),
    [activeDiagramId, canvasDiagrams, currentDiagramName, tables, notes, areas, relationships, enums, tableGroups, project, background, snapToGrid, isFocusModeEnabled]
  );

  const handleExportJson = () => {
    if (readOnly) {
      useUpgradeToastStore.getState().trigger();
      return;
    }
    exportDiagramAsJson(currentDiagramData, currentDiagramName);
  };

  const handleExportDbml = () => {
    if (readOnly) {
      useUpgradeToastStore.getState().trigger();
      return;
    }
    exportDiagramAsDbml(tables, relationships, currentDiagramName);
  };

  const handleExportSql = (dialect: SqlDialect) => {
    if (readOnly) {
      useUpgradeToastStore.getState().trigger();
      return;
    }
    const ok = exportDiagramAsSql(tables, relationships, dialect, currentDiagramName, {
      project,
      enums,
      tableGroups,
    });
    if (!ok) alert("Couldn't generate SQL from this diagram — check the DBML editor for schema errors.");
  };

  const handleExportSvg = async () => {
    if (readOnly) {
      useUpgradeToastStore.getState().trigger();
      return;
    }
    const ok = await exportDiagramAsSvg(tables, notes, areas, currentDiagramName);
    if (!ok) alert("Couldn't export the diagram — try again after the canvas has finished loading.");
  };

  const handleShareClick = () => {
    if (readOnly) {
      useUpgradeToastStore.getState().trigger();
      return;
    }
    setIsShareOpen(true);
  };

  const handleInviteClick = () => {
    if (readOnly) {
      useUpgradeToastStore.getState().trigger();
      return;
    }
    setIsInviteOpen(true);
  };

  const handleHistoryClick = () => {
    if (readOnly) {
      useUpgradeToastStore.getState().trigger();
      return;
    }
    setIsHistoryOpen(true);
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleImportSchemaClick = (tab: ImportSchemaTab) => {
    setImportSchemaTab(tab);
    setIsImportSchemaOpen(true);
  };

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
    if (readOnly) {
      useUpgradeToastStore.getState().trigger();
      return;
    }
    setNewDiagramName("");
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = () => {
    if (!newDiagramName.trim()) return;
    const newId = createDiagram(newDiagramName.trim());
    setIsCreateOpen(false);
    setNewDiagramName("");
    if (newId) router.push(`/d/${newId}`);
  };

  const handleSwitchDiagram = (id: string) => {
    router.push(`/d/${id}`);
  };

  return (
    <>
      <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4">
        {/* Logo */}
        <div className="flex items-center gap-6">
          <DbLuna className="text-foreground w-full max-w-[120px] h-[30px]" />

          {/* Diagram Selector — backed by the real canvas store (each entry is
              an actual diagram you own), not placeholder data. Renaming lives
              solely in the My Diagrams dialog to avoid two places doing it. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="gap-2 min-w-[180px] justify-between font-mono text-sm cursor-pointer"
              >
                <span className="truncate">{currentDiagramName}</span>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-[220px]">
              {!readOnly && (
                <>
                  <DropdownMenuItem onClick={handleCreateNew} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Create new diagram
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {Object.entries(canvasDiagrams).map(([id, diagram]) => (
                <DropdownMenuItem
                  key={id}
                  onClick={() => handleSwitchDiagram(id)}
                  className={`font-mono text-sm justify-between ${id === activeDiagramId ? "bg-secondary text-primary" : ""
                    }`}
                >
                  <span className="truncate">{diagram.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant={workspaceMode === "docs" ? "secondary" : "ghost"}
            size="sm"
            className="gap-2 cursor-pointer"
            onClick={() => setWorkspaceMode(workspaceMode === "docs" ? "diagram" : "docs")}
          >
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">DBML Docs</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="gap-2 cursor-pointer"
            onClick={() => setIsMyDiagramsOpen(true)}
          >
            <FolderOpen className="w-4 h-4" />
            <span className="hidden sm:inline">My Diagrams</span>
          </Button>

          {!readOnly && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 cursor-pointer"
              onClick={handleShareClick}
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">Share</span>
            </Button>
          )}

          {!readOnly && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 cursor-pointer"
              onClick={handleInviteClick}
            >
              <UserPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Invite</span>
            </Button>
          )}

          {!readOnly && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 cursor-pointer"
              onClick={handleHistoryClick}
            >
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">History</span>
            </Button>
          )}

          {!readOnly && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 cursor-pointer">
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
              </DropdownMenuTrigger>
              {/* Width matches the Import menu beside it — see the note there
                  on the inherited trigger-width clamp. */}
              <DropdownMenuContent align="start" className="w-60">
                <DropdownMenuItem onClick={handleExportJson} className="gap-2">
                  <FileText className="w-4 h-4" />
                  Export as JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportDbml} className="gap-2">
                  <Database className="w-4 h-4" />
                  Export as DBML
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="gap-2">
                    <Database className="w-4 h-4" />
                    Export as SQL
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="min-w-40">
                    {SQL_DIALECTS.map((d) => (
                      <DropdownMenuItem key={d.value} onClick={() => handleExportSql(d.value)}>
                        {d.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleExportSvg} className="gap-2">
                  <FileCode className="w-4 h-4" />
                  Export as SVG
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {!readOnly && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 cursor-pointer">
                  <Upload className="w-4 h-4" />
                  <span className="hidden sm:inline">Import</span>
                </Button>
              </DropdownMenuTrigger>
              {/* Explicit width: DropdownMenuContent otherwise inherits
                  w-(--radix-dropdown-menu-trigger-width), which clamps the menu
                  to the narrow "Import" ghost button and wraps the labels. */}
              <DropdownMenuContent align="start" className="w-60">
                {/* Diagram-level: opens a dbluna export as a brand-new diagram. */}
                <DropdownMenuItem onClick={handleImportClick} className="gap-2">
                  <FileText className="w-4 h-4" />
                  Import from JSON
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {/* Canvas-level: appends tables/relationships to this diagram. */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="gap-2">
                    <Database className="w-4 h-4" />
                    Import from Database
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="min-w-40">
                    <DropdownMenuItem onClick={() => handleImportSchemaClick("postgresql")}>
                      PostgreSQL
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleImportSchemaClick("sqlserver")}>
                      SQL Server
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuItem
                  onClick={() => handleImportSchemaClick("csv")}
                  className="gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Import from CSV
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleImportSchemaClick("bacpac")}
                  className="gap-2"
                >
                  <FileArchive className="w-4 h-4" />
                  Import from BACPAC
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportFile}
          />

          {readOnly && (
            <Button asChild size="sm" variant="outline" className="gap-2 cursor-pointer">
              <Link href="/pricing">
                <Sparkles className="w-4 h-4" />
                <span className="hidden sm:inline">Upgrade to edit</span>
              </Link>
            </Button>
          )}

          <SavingIndicator />
        </div>

        {/* Right cluster — identity lives here, opposite the logo. The header
            has always been justify-between; until now it had a single child,
            so the split did nothing. */}
        <div className="flex items-center gap-3">
          {/* Collaborators first, you last — your own avatar anchors the far
              right, so the stack beside it reads as "other people". */}
          <PresenceAvatars cloudId={currentDiagramData.cloudId} />
          <UserMenu />
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

      <MyDiagramsDialog open={isMyDiagramsOpen} onOpenChange={setIsMyDiagramsOpen} readOnly={readOnly} />
      <ShareDialog open={isShareOpen} onOpenChange={setIsShareOpen} diagram={currentDiagramData} />
      <InviteDialog open={isInviteOpen} onOpenChange={setIsInviteOpen} localId={activeDiagramId} />
      <HistoryDialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen} localId={activeDiagramId} />
      <ImportSchemaDialog
        open={isImportSchemaOpen}
        onOpenChange={setIsImportSchemaOpen}
        defaultTab={importSchemaTab}
      />
    </>
  );
}
