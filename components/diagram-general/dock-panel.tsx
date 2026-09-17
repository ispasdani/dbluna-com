"use client";

import { forwardRef } from "react";

import { cn } from "@/lib/utils";
import { DockSide, TabId, TABS } from "@/store/useDockStore";
import { useCapabilities } from "./capabilities-context";
import { DockTab } from "./dock-tab";
import { DockTabsHeader } from "./dock-tabs-header";
import { TablesPanel } from "./tables-panel";
import { NotesPanel } from "./notes-panel";
import { AreasPanel } from "./areas-panel";
import { RelationshipsPanel } from "./relationships-panel";
import { CodeEditor } from "./code-editor";
import { DatabasePanel } from "./database-panel";
import { EnumsPanel } from "./enums-panel";
import { IssuesPanel } from "./issues-panel";
import { TemplatesPanel } from "./templates-panel";

interface DockPanelProps {
  side: DockSide;
  tabs: TabId[];
  activeTab: TabId | null;
}

export const DockPanel = forwardRef<HTMLDivElement, DockPanelProps>(
  ({ side, tabs, activeTab }, ref) => {
    const { visibleTabs, canEditCode } = useCapabilities();

    // Render-time gate only: the dock store still tracks open/closed/side for
    // every tab (so persistence is untouched), but a tab the
    // current plan can't see is never rendered. See
    // free-tier-code-only-editing-plan.md §2.
    const filteredTabs = tabs.filter((t) => visibleTabs.includes(t));
    const effectiveActiveTab =
      activeTab && filteredTabs.includes(activeTab)
        ? activeTab
        : (filteredTabs[0] ?? null);

    const activeTabInfo = TABS.find((t) => t.id === effectiveActiveTab);

    // Header shows tabs docked on this side
    const headerTabIds: TabId[] = filteredTabs;

    return (
      <div
        ref={ref}
        className={cn(
          "h-full min-h-0 min-w-0 bg-dock-bg flex flex-col",
          side === "left" ? "border-r border-border" : "border-l border-border",
        )}
      >
        {/* Tab Headers */}
        <DockTabsHeader
          tabs={headerTabIds}
          renderTab={(tabId) => (
            <DockTab
              key={tabId}
              tabId={tabId}
              isActive={tabId === effectiveActiveTab}
              side={side}
            />
          )}
        />

        {/* Tab Content */}
        <div className="flex-1 min-h-0 overflow-auto">
          {effectiveActiveTab === "tables" ? (
            <TablesPanel />
          ) : effectiveActiveTab === "relationships" ? (
            <RelationshipsPanel />
          ) : effectiveActiveTab === "notes" ? (
            <NotesPanel />
          ) : effectiveActiveTab === "areas" ? (
            <AreasPanel />
          ) : effectiveActiveTab === "code" ? (
            <CodeEditor readOnly={!canEditCode} />
          ) : effectiveActiveTab === "database" ? (
            <DatabasePanel />
          ) : effectiveActiveTab === "enums" ? (
            <EnumsPanel />
          ) : effectiveActiveTab === "issues" ? (
            <IssuesPanel />
          ) : effectiveActiveTab === "templates" ? (
            <TemplatesPanel />
          ) : activeTabInfo ? (
            <div className="animate-fade-in">
              <h3 className="font-medium text-foreground mb-2">
                {activeTabInfo.label} Panel
              </h3>
              <p className="text-sm text-muted-foreground">
                Content for {activeTabInfo.label.toLowerCase()} will appear
                here.
              </p>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Select a panel from the tabs above.
            </div>
          )}
        </div>
      </div>
    );
  },
);

DockPanel.displayName = "DockPanel";
