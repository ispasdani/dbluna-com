"use client";

import { useEditorStore } from "@/store/useEditorStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown, Minus, Plus } from "lucide-react";

const PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3];

export function ZoomMenu() {
  const zoom = useEditorStore((s) => s.camera.zoom);
  const viewport = useEditorStore((s) => s.viewport);
  const setZoomAt = useEditorStore((s) => s.setZoomAt);

  const zoomPct = Math.round(zoom * 100);

  const centerX = viewport.w / 2;
  const centerY = viewport.h / 2;

  const applyZoom = (z: number) => setZoomAt(z, centerX, centerY);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          {zoomPct}%
          <ChevronDown className="h-4 w-4 opacity-70" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Zoom</DropdownMenuLabel>

        <DropdownMenuItem onClick={() => applyZoom(zoom * 1.1)}>
          <Plus className="mr-2 h-4 w-4" />
          Zoom in
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => applyZoom(zoom / 1.1)}>
          <Minus className="mr-2 h-4 w-4" />
          Zoom out
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {PRESETS.map((z) => {
          const pct = Math.round(z * 100);
          const active = Math.abs(z - zoom) < 0.001; // close enough
          return (
            <DropdownMenuItem
              key={z}
              onClick={() => applyZoom(z)}
              className={active ? "font-medium" : undefined}
            >
              {pct}%
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
