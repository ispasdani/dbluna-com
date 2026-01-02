"use client";

import {
  Code,
  Database,
  AlertCircle,
  LayoutTemplate,
  Table,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TabId, TABS, useDockStore } from "@/store/useDockStore";

const iconMap = {
  Code: Code,
  Database: Database,
  AlertCircle: AlertCircle,
  LayoutTemplate: LayoutTemplate,
  Table: Table,
};

export function TabLauncherBar() {
  const { leftTabs, rightTabs, openTab } = useDockStore();

  const isTabOpen = (tabId: TabId) => {
    return leftTabs.includes(tabId) || rightTabs.includes(tabId);
  };

  return (
    <div className="h-12 border-b border-border bg-dock-header flex items-center justify-center gap-2 px-4">
      {TABS.map((tab) => {
        const Icon = iconMap[tab.icon as keyof typeof iconMap];
        const isOpen = isTabOpen(tab.id);

        return (
          <Button
            key={tab.id}
            variant={isOpen ? "secondary" : "ghost"}
            size="sm"
            onClick={() => openTab(tab.id)}
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
  );
}
