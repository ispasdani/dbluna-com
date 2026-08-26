"use client";

import { forwardRef } from "react";
import { useDroppable } from "@dnd-kit/core";
import dynamic from "next/dynamic";

import { cn } from "@/lib/utils";
import { DockSide, TabId, TABS } from "@/store/useDockStore";
import { useCapabilities } from "./capabilities-context";
import { DockTabsHeader } from "./dock-tabs-header";
import { TablesPanel } from "./tables-panel";
import { NotesPanel } from "./notes-panel";
import { AreasPanel } from "./areas-panel";
import { RelationshipsPanel } from "./relationships-panel";
import { CodeEditor } from "./code-editor";
import { IssuesPanel } from "./issues-panel";
import { TemplatesPanel } from "./templates-panel";
import { AiChatPanel } from "./ai-chat-panel";

const DraggableTab = dynamic(
  () => import("./draggable-tab-client").then((m) => m.DraggableTabClient),
  { ssr: false }
);

interface DockPanelProps {
  side: DockSide;
  tabs: TabId[];
  activeTab: TabId | null;
  readOnly?: boolean;
}

export const DockPanel = forwardRef<HTMLDivElement, DockPanelProps>(
  ({ side, tabs, activeTab, readOnly = false }, ref) => {
    const { setNodeRef, isOver } = useDroppable({
      id: side,
      data: { side },
    });

    const { visibleTabs, canEditCode } = useCapabilities();

    // Render-time gate only: the dock store still tracks open/closed/side for
    // every tab (so drag/drop and persistence are untouched), but a tab the
    // current plan can't see is never rendered. See
    // free-tier-code-only-editing-plan.md §2.
    const filteredTabs = tabs.filter((t) => visibleTabs.includes(t));
    const effectiveActiveTab =
      activeTab && filteredTabs.includes(activeTab)
        ? activeTab
        : (filteredTabs[0] ?? null);

    const activeTabInfo = TABS.find((t) => t.id === effectiveActiveTab);
    const openSet = new Set(filteredTabs);

    // Header shows tabs docked on this side
    const headerTabIds: TabId[] = filteredTabs;

    return (
      <div
        ref={(node) => {
          setNodeRef(node);
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        className={cn(
          "h-full min-h-0 min-w-0 bg-dock-bg flex flex-col transition-all duration-200",
          side === "left" ? "border-r border-border" : "border-l border-border",
          isOver && "ring-2 ring-primary/50 ring-inset bg-primary/5"
        )}
      >
        {/* Tab Headers */}
        <DockTabsHeader
          tabs={headerTabIds}
          renderTab={(tabId) => (
            <DraggableTab
              key={tabId}
              tabId={tabId}
              isActive={tabId === effectiveActiveTab}
              side={side}
              isOpen={openSet.has(tabId)}
            />
          )}
        />

        {/* Tab Content */}
        <div className="flex-1 min-h-0 p-4 overflow-auto">
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
          ) : effectiveActiveTab === "issues" ? (
            <IssuesPanel />
          ) : effectiveActiveTab === "templates" ? (
            <TemplatesPanel />
          ) : effectiveActiveTab === "ai-chat" ? (
            <AiChatPanel readOnly={readOnly} />
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
  }
);

DockPanel.displayName = "DockPanel";

interface DropZoneProps {
  side: DockSide;
}

export function DropZone({ side }: DropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `dropzone-${side}`,
    data: { side },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "absolute top-0 bottom-0 w-48 z-50 flex items-center justify-center transition-all duration-200",
        side === "left" ? "left-0" : "right-0",
        isOver
          ? "bg-primary/15 border-primary"
          : "bg-background/80 backdrop-blur-sm"
      )}
      style={{
        borderLeft: side === "right" ? "2px dashed" : undefined,
        borderRight: side === "left" ? "2px dashed" : undefined,
        borderColor: isOver
          ? "hsl(var(--primary))"
          : "hsl(var(--muted-foreground) / 0.4)",
      }}
    >
      <div
        className={cn(
          "flex flex-col items-center gap-2 transition-all duration-200",
          isOver ? "text-primary scale-110" : "text-muted-foreground"
        )}
      >
        <div
          className={cn(
            "w-14 h-14 rounded-xl border-2 border-dashed flex items-center justify-center transition-all",
            isOver
              ? "border-primary bg-primary/20"
              : "border-muted-foreground/40"
          )}
        >
          <span className="text-2xl font-light">+</span>
        </div>
        <span className="text-xs font-medium uppercase tracking-wider">
          {side === "left" ? "Dock Left" : "Dock Right"}
        </span>
      </div>
    </div>
  );
}
