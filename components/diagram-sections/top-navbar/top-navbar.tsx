"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, Database, Download, FileText, Upload, Share2, Sparkles, FileCode, UserPlus, History, FileSpreadsheet, FileArchive, CircleHelp, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DiagramButton } from "@/components/diagram-general/diagram-button";
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
import { SQL_DIALECTS, dialectFromDatabaseType, type SqlDialect } from "@/lib/generator/sql-generator";
import { useUpgradeToastStore } from "@/store/useUpgradeToastStore";
import { useOnboardingStore } from "@/store/useOnboardingStore";
import { useCapabilities } from "@/components/diagram-general/capabilities-context";
import DbLuna, { DbLunaFuturistic } from "@/components/uiJsxAssets/dbluna-logo";

interface TopNavbarProps {
  readOnly?: boolean;
}

export function TopNavbar({ readOnly = false }: TopNavbarProps) {
  const router = useRouter();

  const [isMyDiagramsOpen, setIsMyDiagramsOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  // Schema import (DB / CSV / BACPAC) — the tab is chosen by the Import menu
  // item the user picked, so each item opens straight onto its own source.
  const [isImportSchemaOpen, setIsImportSchemaOpen] = useState(false);
  const [importSchemaTab, setImportSchemaTab] = useState<ImportSchemaTab>("postgresql");

  const { workspaceMode, setWorkspaceMode } = useViewStore();
  const { canUseDocsMode, planResolved } = useCapabilities();

  const activeDiagramId = useCanvasStore((s) => s.activeDiagramId);
  const canvasDiagrams = useCanvasStore((s) => s.diagrams);
  const tables = useCanvasStore((s) => s.tables);
  const notes = useCanvasStore((s) => s.notes);
  const areas = useCanvasStore((s) => s.areas);
  const relationships = useCanvasStore((s) => s.relationships);
  const enums = useCanvasStore((s) => s.enums);
  const tableGroups = useCanvasStore((s) => s.tableGroups);
  const project = useCanvasStore((s) => s.project);
  // Which export dialect the diagram's declared database type corresponds to,
  // or null when it is unset or unrecognized. Display only — every dialect
  // stays selectable.
  const projectDialect = dialectFromDatabaseType(project?.databaseType);
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

  return (
    <>
      <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4">
        {/* Left cluster — logo, diagram name, view helpers */}
        <div className="flex items-center gap-3">
          <DbLuna className="text-foreground w-full max-w-[120px] h-[30px]" />
          <DbLunaFuturistic className="text-foreground w-[110px] h-[15px] shrink-0" />

          {/* Logo / name divider */}
          <div className="w-px h-5 bg-border" />

          {/* Diagram name — opens My Diagrams modal */}
          <DiagramButton
            variant="outlined"
            onClick={() => setIsMyDiagramsOpen(true)}
            className="gap-1.5 max-w-[200px]"
          >
            <span className="truncate">{currentDiagramName}</span>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: "tomato" }} />
          </DiagramButton>

          {planResolved && (
            <Button
              variant={workspaceMode === "docs" && canUseDocsMode ? "secondary" : "ghost"}
              size="sm"
              className="gap-2 cursor-pointer relative"
              onClick={() => {
                if (!canUseDocsMode) {
                  useUpgradeToastStore.getState().trigger();
                  return;
                }
                setWorkspaceMode(workspaceMode === "docs" ? "diagram" : "docs");
              }}
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">DBML Docs</span>
              {!canUseDocsMode && (
                <span className="ml-0.5 text-[9px] font-bold uppercase tracking-wider bg-primary/15 text-primary px-1 py-0.5 rounded leading-none">
                  Pro
                </span>
              )}
            </Button>
          )}

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

        {/* Right cluster — actions + identity */}
        <div className="flex items-center gap-1.5">
          {!readOnly && (
            <>
              {/* Action buttons */}
              <DiagramButton variant="ghost" onClick={handleShareClick}>
                <Share2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Share</span>
              </DiagramButton>

              <DiagramButton variant="ghost" onClick={handleInviteClick}>
                <UserPlus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Invite</span>
              </DiagramButton>

              <DiagramButton variant="ghost" onClick={handleHistoryClick}>
                <History className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">History</span>
              </DiagramButton>

              {/* Separator */}
              <div className="w-px h-5 bg-border mx-0.5" />

              {/* Export dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <DiagramButton variant="outlined">
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Export</span>
                    <ChevronDown className="w-3 h-3 text-muted-foreground" />
                  </DiagramButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
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
                        <DropdownMenuItem
                          key={d.value}
                          onClick={() => handleExportSql(d.value)}
                          className="gap-2"
                        >
                          <span className="flex-1">{d.label}</span>
                          {d.value === projectDialect && (
                            <span className="text-xs text-muted-foreground">✓</span>
                          )}
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

              {/* Import dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <DiagramButton variant="ghost">
                    <Upload className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Import</span>
                    <ChevronDown className="w-3 h-3 text-muted-foreground" />
                  </DiagramButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuItem onClick={handleImportClick} className="gap-2">
                    <FileText className="w-4 h-4" />
                    Import from JSON
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
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
                  <DropdownMenuItem onClick={() => handleImportSchemaClick("sql")} className="gap-2">
                    <Terminal className="w-4 h-4" />
                    Paste SQL Script
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleImportSchemaClick("csv")} className="gap-2">
                    <FileSpreadsheet className="w-4 h-4" />
                    Import from CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleImportSchemaClick("bacpac")} className="gap-2">
                    <FileArchive className="w-4 h-4" />
                    Import from BACPAC
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Separator before identity */}
              <div className="w-px h-5 bg-border mx-0.5" />
            </>
          )}

          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />

          <DiagramButton
            variant="ghost"
            size="icon"
            onClick={() => useOnboardingStore.getState().open()}
            title="How this works"
          >
            <CircleHelp className="w-4 h-4" />
          </DiagramButton>

          {/* Collaborators first, you last */}
          <PresenceAvatars cloudId={currentDiagramData.cloudId} />
          <UserMenu />
        </div>
      </header>

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
