"use client";

import { Table, StickyNote, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCanvasStore } from "@/store/useCanvasStore";
import { ZoomMenu } from "./zoom-menu";
import { PlatformPaletteToggle } from "./platform-palette-toggle";

interface CanvasFloatingToolbarProps {
  readOnly?: boolean;
}

export function CanvasFloatingToolbar({ readOnly = false }: CanvasFloatingToolbarProps) {
  const { addTable, addNote, addArea } = useCanvasStore();

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 px-2 py-1.5 bg-dock-header border border-border rounded-2xl shadow-lg">
      {!readOnly && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 cursor-pointer"
            onClick={addTable}
            title="Add Table"
          >
            <Table className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 cursor-pointer"
            onClick={addNote}
            title="Add Note"
          >
            <StickyNote className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 cursor-pointer"
            onClick={addArea}
            title="Add Area"
          >
            <Square className="h-4 w-4" />
          </Button>

          <div className="h-4 w-px bg-border mx-1" />
        </>
      )}

      <ZoomMenu />

      <div className="h-4 w-px bg-border mx-1" />

      <PlatformPaletteToggle />
    </div>
  );
}
