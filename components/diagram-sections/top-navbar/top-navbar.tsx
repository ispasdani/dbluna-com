"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Database,
  Image as ImageIcon,
  Download,
  FileText,
  Upload,
  Share2,
  Sparkles,
  FileCode,
  UserPlus,
  History,
  FileSpreadsheet,
  FileArchive,
  CircleHelp,
  Terminal,
} from "lucide-react";
import { DropdownMenu as Menu } from "radix-ui";
import { DiagramButton } from "@/components/diagram-general/diagram-button";
import menu from "@/components/diagram-general/toolbar-menus.module.scss";
import { cn } from "@/lib/utils";
import { useViewStore } from "@/store/useViewStore";
import { useCanvasStore } from "@/store/useCanvasStore";
import { countRender } from "@/lib/debug-profiler";
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
import {
  SQL_DIALECTS,
  dialectFromDatabaseType,
  type SqlDialect,
} from "@/lib/generator/sql-generator";
import { useUpgradeToastStore } from "@/store/useUpgradeToastStore";
import { useOnboardingStore } from "@/store/useOnboardingStore";
import { useCapabilities } from "@/components/diagram-general/capabilities-context";
import { DbLunaFuturistic } from "@/components/uiJsxAssets/dbluna-logo";

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
  const [importSchemaTab, setImportSchemaTab] =
    useState<ImportSchemaTab>("postgresql");

  const { workspaceMode, setWorkspaceMode } = useViewStore();
  const { canUseDocsMode, planResolved } = useCapabilities();

  countRender("TopNavbar body"); // TEMP diagnostics
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
    (activeDiagramId && canvasDiagrams[activeDiagramId]?.name) ||
    "Untitled diagram";

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Single source of truth for "the currently open diagram" — used by both
  // JSON export and the share dialog so they can never drift out of sync.
  // updatedAt is decorative here (export/share both ignore or drop it) — read
  // the last known value from the store rather than calling Date.now() during
  // render, which React's purity rule flags.
  const currentDiagramData = useMemo(
    () => ({
      name: currentDiagramName,
      updatedAt:
        (activeDiagramId && canvasDiagrams[activeDiagramId]?.updatedAt) || 0,
      storage:
        (activeDiagramId && canvasDiagrams[activeDiagramId]?.storage) ||
        "local",
      cloudId:
        (activeDiagramId && canvasDiagrams[activeDiagramId]?.cloudId) || null,
      lastSyncedAt:
        (activeDiagramId && canvasDiagrams[activeDiagramId]?.lastSyncedAt) ||
        null,
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
    [
      activeDiagramId,
      canvasDiagrams,
      currentDiagramName,
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
    ],
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
    const ok = exportDiagramAsSql(
      tables,
      relationships,
      dialect,
      currentDiagramName,
      {
        project,
        enums,
        tableGroups,
      },
    );
    if (!ok)
      alert(
        "Couldn't generate SQL from this diagram — check the DBML editor for schema errors.",
      );
  };

  const handleExportSvg = async () => {
    if (readOnly) {
      useUpgradeToastStore.getState().trigger();
      return;
    }
    const ok = await exportDiagramAsSvg(
      tables,
      notes,
      areas,
      currentDiagramName,
    );
    if (!ok)
      alert(
        "Couldn't export the diagram — try again after the canvas has finished loading.",
      );
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
          <DbLunaFuturistic
            weight="bold"
            className="text-foreground w-[110px] h-[15px] shrink-0"
          />

          {/* Logo / name divider */}
          <div className="w-px h-5 bg-border" />

          {/* Diagram name — opens My Diagrams modal */}
          <DiagramButton
            variant="outlined"
            onClick={() => setIsMyDiagramsOpen(true)}
            className="gap-1.5 max-w-[200px]"
          >
            <span className="truncate">{currentDiagramName}</span>
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: "tomato" }}
            />
          </DiagramButton>

          {planResolved && (
            <DiagramButton
              variant={
                workspaceMode === "docs" && canUseDocsMode
                  ? "ghost-active"
                  : "ghost"
              }
              onClick={() => {
                if (!canUseDocsMode) {
                  useUpgradeToastStore.getState().trigger();
                  return;
                }
                setWorkspaceMode(workspaceMode === "docs" ? "diagram" : "docs");
              }}
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">DBML Docs</span>
              {!canUseDocsMode && (
                <span className="ml-0.5 text-[9px] font-bold uppercase tracking-wider bg-primary/15 text-primary px-1 py-0.5 rounded leading-none">
                  Pro
                </span>
              )}
            </DiagramButton>
          )}

          {readOnly && (
            <DiagramButton asChild variant="outlined">
              <Link href="/pricing">
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Upgrade to edit</span>
              </Link>
            </DiagramButton>
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

              {/* Export */}
              <Menu.Root>
                <Menu.Trigger asChild>
                  <DiagramButton variant="outlined">
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Export</span>
                    <ChevronDown className="w-3 h-3 text-muted-foreground" />
                  </DiagramButton>
                </Menu.Trigger>
                <Menu.Portal>
                  <Menu.Content align="end" sideOffset={6} className={cn(menu.menu, menu.io)}>
                    <Menu.Label className={menu.group}>Schema</Menu.Label>
                    <Menu.Item className={menu.item} onSelect={handleExportJson}>
                      <span className={menu.icon}>
                        <FileText className="w-4 h-4" />
                      </span>
                      <span className={menu.text}>
                        JSON
                        <small>The whole diagram, re-importable</small>
                      </span>
                    </Menu.Item>
                    <Menu.Item className={menu.item} onSelect={handleExportDbml}>
                      <span className={menu.icon}>
                        <FileCode className="w-4 h-4" />
                      </span>
                      <span className={menu.text}>
                        DBML
                        <small>Schema as code, for dbdiagram and docs</small>
                      </span>
                    </Menu.Item>
                    <Menu.Sub>
                      <Menu.SubTrigger className={menu.item}>
                        <span className={menu.icon}>
                          <Database className="w-4 h-4" />
                        </span>
                        <span className={menu.text}>
                          SQL
                          <small>CREATE TABLE script</small>
                        </span>
                        <span className={menu.value}>
                          {SQL_DIALECTS.find((d) => d.value === projectDialect)?.label}
                          <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </Menu.SubTrigger>
                      <Menu.Portal>
                        <Menu.SubContent sideOffset={8} alignOffset={-6} className={cn(menu.menu, menu.sub)}>
                          <Menu.Label className={menu.group}>Dialect</Menu.Label>
                          {SQL_DIALECTS.map((d) => (
                            <Menu.Item
                              key={d.value}
                              className={cn(menu.item, menu.plain)}
                              onSelect={() => handleExportSql(d.value)}
                            >
                              <span className={menu.text}>{d.label}</span>
                              {d.value === projectDialect && <Check className={cn("w-3.5 h-3.5", menu.tick)} />}
                            </Menu.Item>
                          ))}
                        </Menu.SubContent>
                      </Menu.Portal>
                    </Menu.Sub>

                    <Menu.Separator className={menu.sep} />

                    <Menu.Label className={menu.group}>Image</Menu.Label>
                    <Menu.Item className={menu.item} onSelect={handleExportSvg}>
                      <span className={menu.icon}>
                        <ImageIcon className="w-4 h-4" />
                      </span>
                      <span className={menu.text}>
                        SVG
                        <small>A picture of the canvas, sharp at any size</small>
                      </span>
                    </Menu.Item>
                  </Menu.Content>
                </Menu.Portal>
              </Menu.Root>

              {/* Import */}
              <Menu.Root>
                <Menu.Trigger asChild>
                  <DiagramButton variant="outlined">
                    <Upload className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Import</span>
                    <ChevronDown className="w-3 h-3 text-muted-foreground" />
                  </DiagramButton>
                </Menu.Trigger>
                <Menu.Portal>
                  <Menu.Content align="end" sideOffset={6} className={cn(menu.menu, menu.io)}>
                    <Menu.Label className={menu.group}>From a file</Menu.Label>
                    <Menu.Item className={menu.item} onSelect={handleImportClick}>
                      <span className={menu.icon}>
                        <FileText className="w-4 h-4" />
                      </span>
                      <span className={menu.text}>
                        JSON
                        <small>A diagram exported from dbluna</small>
                      </span>
                    </Menu.Item>
                    <Menu.Item className={menu.item} onSelect={() => handleImportSchemaClick("csv")}>
                      <span className={menu.icon}>
                        <FileSpreadsheet className="w-4 h-4" />
                      </span>
                      <span className={menu.text}>
                        CSV
                        <small>Tables and columns from a spreadsheet</small>
                      </span>
                    </Menu.Item>
                    <Menu.Item className={menu.item} onSelect={() => handleImportSchemaClick("bacpac")}>
                      <span className={menu.icon}>
                        <FileArchive className="w-4 h-4" />
                      </span>
                      <span className={menu.text}>
                        BACPAC
                        <small>A SQL Server export file</small>
                      </span>
                    </Menu.Item>

                    <Menu.Separator className={menu.sep} />

                    <Menu.Label className={menu.group}>From a database</Menu.Label>
                    <Menu.Item className={menu.item} onSelect={() => handleImportSchemaClick("postgresql")}>
                      <span className={menu.icon}>
                        <Database className="w-4 h-4" />
                      </span>
                      <span className={menu.text}>
                        PostgreSQL
                        <small>Read the schema from a live database</small>
                      </span>
                    </Menu.Item>
                    <Menu.Item className={menu.item} onSelect={() => handleImportSchemaClick("sqlserver")}>
                      <span className={menu.icon}>
                        <Database className="w-4 h-4" />
                      </span>
                      <span className={menu.text}>
                        SQL Server
                        <small>Read the schema from a live database</small>
                      </span>
                    </Menu.Item>

                    <Menu.Separator className={menu.sep} />

                    <Menu.Label className={menu.group}>From code</Menu.Label>
                    <Menu.Item className={menu.item} onSelect={() => handleImportSchemaClick("sql")}>
                      <span className={menu.icon}>
                        <Terminal className="w-4 h-4" />
                      </span>
                      <span className={menu.text}>
                        SQL script
                        <small>Paste CREATE TABLE statements</small>
                      </span>
                    </Menu.Item>
                  </Menu.Content>
                </Menu.Portal>
              </Menu.Root>

              {/* Separator before identity */}
              <div className="w-px h-5 bg-border mx-0.5" />
            </>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportFile}
          />

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

      <MyDiagramsDialog
        open={isMyDiagramsOpen}
        onOpenChange={setIsMyDiagramsOpen}
        readOnly={readOnly}
      />
      <ShareDialog
        open={isShareOpen}
        onOpenChange={setIsShareOpen}
        diagram={currentDiagramData}
      />
      <InviteDialog
        open={isInviteOpen}
        onOpenChange={setIsInviteOpen}
        localId={activeDiagramId}
      />
      <HistoryDialog
        open={isHistoryOpen}
        onOpenChange={setIsHistoryOpen}
        localId={activeDiagramId}
      />
      <ImportSchemaDialog
        open={isImportSchemaOpen}
        onOpenChange={setIsImportSchemaOpen}
        defaultTab={importSchemaTab}
      />
    </>
  );
}
