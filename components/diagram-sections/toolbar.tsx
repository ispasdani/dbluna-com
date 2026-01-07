"use client";

import { useMemo } from "react";
import {
  Code,
  Database,
  AlertCircle,
  LayoutTemplate,
  Table,
  Eye,
  ChevronDown,
  PanelLeft,
  Layout,
  Grid3X3,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { TABS, useDockStore } from "@/store/useDockStore";
import { useViewStore } from "@/store/useViewStore";
import { useCanvasStore } from "@/store/useCanvasStore";

const iconMap = {
  Code,
  Database,
  AlertCircle,
  LayoutTemplate,
  Table,
};

export function TabLauncherBar() {
  const { leftTabs, rightTabs, openTab } = useDockStore();
  const {
    isLeftDockVisible,
    isTopNavbarVisible,
    toggleLeftDock,
    toggleTopNavbar,
  } = useViewStore();
  const { background, setBackground } = useCanvasStore();

  const openSet = useMemo(
    () => new Set([...leftTabs, ...rightTabs]),
    [leftTabs, rightTabs]
  );

  return (
    <div className="h-12 border-b border-border bg-dock-header flex items-center justify-between px-3">
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
      </div>

      {/* Center: Launchers */}
      <div className="flex items-center justify-center gap-2">
        {TABS.map((tab) => {
          const Icon = iconMap[tab.icon as keyof typeof iconMap];
          const isOpen = openSet.has(tab.id);

          return (
            <Button
              key={tab.id}
              variant={isOpen ? "secondary" : "ghost"}
              size="sm"
              onClick={() => openTab(tab.id, "left")}
              className={`gap-2 transition-all duration-200 ${
                isOpen
                  ? "text-primary bg-secondary/80 ring-1 ring-primary/30"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-sm font-medium">{tab.label}</span>
            </Button>
          );
        })}
      </div>

      {/* Right side: optional area (future) */}
      <div className="w-[48px]" />
    </div>
  );
}
