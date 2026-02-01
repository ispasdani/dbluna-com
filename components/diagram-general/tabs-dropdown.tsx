"use client";

import React, { useMemo } from "react";
import {
  Code,
  Database,
  AlertCircle,
  LayoutTemplate,
  Table,
  ChevronDown,
  Link,
  StickyNote,
  Square,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { TABS, useDockStore } from "@/store/useDockStore";

const iconMap = {
  Code,
  Database,
  AlertCircle,
  LayoutTemplate,
  Table,
  Link,
  StickyNote,
  Square,
};

export function TabsDropdown({ side = "left" }: { side?: "left" | "right" }) {
  const { leftTabs, rightTabs, openTab } = useDockStore();

  const openSet = useMemo(
    () => new Set([...leftTabs, ...rightTabs]),
    [leftTabs, rightTabs]
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          Tabs
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="center" className="w-56">
        <DropdownMenuLabel className="text-muted-foreground">
          Open a tab
        </DropdownMenuLabel>

        {TABS.map((tab) => {
          const Icon = iconMap[tab.icon as keyof typeof iconMap];
          const isOpen = openSet.has(tab.id);

          return (
            <DropdownMenuItem
              key={tab.id}
              onClick={() => openTab(tab.id, side)}
              className="gap-2"
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{tab.label}</span>
              {isOpen && (
                <span className="text-xs text-muted-foreground">✓</span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
