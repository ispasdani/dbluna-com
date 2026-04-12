"use client";

import { useState } from "react";
import { Eye, ChevronDown, PanelLeft, Layout, Magnet, StickyNote, Square, Table, Database, FolderInput } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useViewStore } from "@/store/useViewStore";
import { useCanvasStore } from "@/store/useCanvasStore";
import { ZoomMenu } from "../diagram-general/zoom-menu";
import { TabsDropdown } from "../diagram-general/tabs-dropdown";
import { PlatformPaletteToggle } from "../diagram-general/platform-palette-toggle";
import { ErdGenerationDialog } from "./erd-generation-dialog";
import { ImportSchemaDialog } from "./import-schema-dialog";

export function TabLauncherBar() {
  const {
    isLeftDockVisible,
    isTopNavbarVisible,
    toggleLeftDock,
    toggleTopNavbar,
  } = useViewStore();
  const { background, setBackground, snapToGrid, toggleSnapToGrid, addTable, addNote, addArea } =
    useCanvasStore();
  const [showErdDialog, setShowErdDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);

  return (
    <div className="h-12 border-b border-border bg-dock-header flex items-center justify-start px-3 gap-2">
      {/* Left side: Toolbar actions */}
      <div className="flex items-center gap-2">
        {/* View Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-foreground hover:bg-panel-hover gap-2"
            >
              <Eye className="h-4 w-4" />
              View
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Panels
            </DropdownMenuLabel>

            <DropdownMenuItem onClick={toggleLeftDock} className="gap-2">
              <PanelLeft className="h-4 w-4" />
              <span className="flex-1">Left Dock</span>
              {isLeftDockVisible && (
                <span className="text-xs text-muted-foreground">✓</span>
              )}
            </DropdownMenuItem>

            <DropdownMenuItem onClick={toggleTopNavbar} className="gap-2">
              <Layout className="h-4 w-4" />
              <span className="flex-1">Top Navbar</span>
              {isTopNavbarVisible && (
                <span className="text-xs text-muted-foreground">✓</span>
              )}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Zoom actions should call useCanvasStore (add later) */}
            {/* <DropdownMenuSeparator />
            <DropdownMenuItem onClick={zoomIn}>Zoom In</DropdownMenuItem>
            ... */}
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Canvas
            </DropdownMenuLabel>

            <DropdownMenuItem onClick={toggleSnapToGrid} className="gap-2">
              <Magnet className="h-4 w-4" />
              <span className="flex-1">Snap to Grid</span>
              {snapToGrid && (
                <span className="text-xs text-muted-foreground">✓</span>
              )}
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => setBackground("grid")}
              className="gap-2"
            >
              <span className="flex-1">Grid</span>
              {background === "grid" && (
                <span className="text-xs text-muted-foreground">✓</span>
              )}
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => setBackground("dots")}
              className="gap-2"
            >
              <span className="flex-1">Dots</span>
              {background === "dots" && (
                <span className="text-xs text-muted-foreground">✓</span>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-4 w-px bg-border mx-1" />

        {/* Add Table Button */}
        <Button
          variant="ghost"
          size="sm"
          className="text-foreground hover:bg-panel-hover gap-2"
          onClick={addTable}
        >
          <Table className="h-4 w-4" />
          Add Table
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="text-foreground hover:bg-panel-hover gap-2"
          onClick={addNote}
        >
          <StickyNote className="h-4 w-4" />
          Add Note
        </Button>

        {/* Add Area Button */}
        <Button
          variant="ghost"
          size="sm"
          className="text-foreground hover:bg-panel-hover gap-2"
          onClick={addArea}
        >
          <Square className="h-4 w-4" />
          Add Area
        </Button>

        {/* Generate ERD Button */}
        {typeof window !== "undefined" && (window as any).electron && (
            <Button
              variant="outline"
              size="sm"
              className="text-white hover:text-white border-blue-500/50 bg-blue-500/10 hover:bg-blue-500/20 gap-2 ml-2 transition-colors"
              onClick={() => setShowErdDialog(true)}
            >
              <Database className="h-4 w-4 text-blue-400" />
              Generate ERD
            </Button>
        )}

        {/* Import Schema Button */}
        <Button
          variant="outline"
          size="sm"
          className="text-white hover:text-white border-teal-500/50 bg-teal-500/10 hover:bg-teal-500/20 gap-2 ml-1 transition-colors"
          onClick={() => setShowImportDialog(true)}
        >
          <FolderInput className="h-4 w-4 text-teal-400" />
          Import
        </Button>
      </div>

      <ZoomMenu />

      <TabsDropdown side="left" />

      {/* Palette Selector */}
      <PlatformPaletteToggle />

      {/* Right side: optional area (future) */}
      <div className="w-[48px]" />
      
      <ErdGenerationDialog open={showErdDialog} onOpenChange={setShowErdDialog} />
      <ImportSchemaDialog open={showImportDialog} onOpenChange={setShowImportDialog} />
    </div>
  );
}
