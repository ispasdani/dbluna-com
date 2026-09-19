"use client";

import { Eye, ChevronDown, PanelLeft, Layout, Magnet, Palette } from "lucide-react";

import { DiagramButton } from "@/components/diagram-general/diagram-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useViewStore } from "@/store/useViewStore";
import { useCanvasStore } from "@/store/useCanvasStore";
import { TabsDropdown } from "../diagram-general/tabs-dropdown";
import { useCanvasStyleStore } from "@/store/useCanvasStyleStore";
import {
  CANVAS_STYLES,
  CANVAS_STYLE_ORDER,
  isCanvasStyleId,
} from "./canvas/canvas-style";
import { usePanelStyleStore } from "@/store/usePanelStyleStore";
import {
  PANEL_STYLES,
  PANEL_STYLE_ORDER,
  isPanelStyleId,
} from "../diagram-general/panel-style";

/**
 * Switches the look of the canvas (tables, relationship lines) and, in its own
 * section, of the dock panels. The two are separate settings that never
 * affect each other; they only share a menu to keep the toolbar narrow.
 */
function CanvasStyleMenu() {
  const styleId = useCanvasStyleStore((s) => s.styleId);
  const setStyleId = useCanvasStyleStore((s) => s.setStyleId);
  const panelStyleId = usePanelStyleStore((s) => s.styleId);
  const setPanelStyleId = usePanelStyleStore((s) => s.setStyleId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <DiagramButton variant="ghost" title="Canvas style">
          <Palette className="w-3.5 h-3.5" />
          Style: {CANVAS_STYLES[styleId].label}
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </DiagramButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Canvas style
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={styleId}
          onValueChange={(v) => isCanvasStyleId(v) && setStyleId(v)}
        >
          {CANVAS_STYLE_ORDER.map((id) => (
            <DropdownMenuRadioItem key={id} value={id} className="items-start py-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm">{CANVAS_STYLES[id].label}</span>
                <span className="text-xs text-muted-foreground">
                  {CANVAS_STYLES[id].description}
                </span>
              </div>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Panel style
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={panelStyleId}
          onValueChange={(v) => isPanelStyleId(v) && setPanelStyleId(v)}
        >
          {PANEL_STYLE_ORDER.map((id) => (
            <DropdownMenuRadioItem key={id} value={id} className="items-start py-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm">{PANEL_STYLES[id].label}</span>
                <span className="text-xs text-muted-foreground">
                  {PANEL_STYLES[id].description}
                </span>
              </div>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TabLauncherBar() {
  const {
    isLeftDockVisible,
    isTopNavbarVisible,
    toggleLeftDock,
    toggleTopNavbar,
  } = useViewStore();
  const { background, setBackground, snapToGrid, toggleSnapToGrid } =
    useCanvasStore();

  return (
    <div className="h-12 border-b border-border bg-dock-header flex items-center justify-start px-3 gap-2">
      {/* Left side: Toolbar actions */}
      <div className="flex items-center gap-2">
        {/* View Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <DiagramButton variant="ghost">
              <Eye className="w-3.5 h-3.5" />
              View
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </DiagramButton>
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

            <DropdownMenuItem onClick={useCanvasStore.getState().toggleFocusMode} className="gap-2">
              <Eye className="h-4 w-4" />
              <span className="flex-1">Focus Mode</span>
              {useCanvasStore((s) => s.isFocusModeEnabled) && (
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

        <CanvasStyleMenu />
      </div>

      <TabsDropdown side="left" />

    </div>
  );
}
