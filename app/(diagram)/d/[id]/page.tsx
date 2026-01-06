"use client";

import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  pointerWithin,
} from "@dnd-kit/core";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";

import { useState } from "react";
import { TabId, TABS, useDockStore } from "@/store/useDockStore";
import { useViewStore } from "@/store/useViewStore";
import { TopNavbar } from "@/components/diagram-sections/top-navbar/top-navbar";
import { DockPanel, DropZone } from "@/components/diagram-general/dock-panel";
import { CanvasPlaceholder } from "@/components/diagram-sections/canvas";
import { TabLauncherBar } from "@/components/diagram-sections/toolbar";

export default function DiagramPage() {
  const {
    leftTabs,
    rightTabs,
    activeLeftTab,
    openTab,
    activeRightTab,
    moveTab,
  } = useDockStore();

  const { isTopNavbarVisible, isLeftDockVisible } = useViewStore();

  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current as {
      tabId: string;
      fromSide: string;
    };
    const overId = over.id as string;

    let targetSide: "left" | "right" | null = null;

    if (
      overId === "left" ||
      overId === "dropzone-left" ||
      overId.startsWith("left-")
    ) {
      targetSide = "left";
    } else if (
      overId === "right" ||
      overId === "dropzone-right" ||
      overId.startsWith("right-")
    ) {
      targetSide = "right";
    }

    if (!targetSide) return;

    const tabId = activeData.tabId as TabId;
    const fromSide = activeData.fromSide as "left" | "right";

    // ✅ If the tab is not open anywhere (because left header shows ALL tabs),
    // open it on the fromSide first so moveTab has something to move.
    const isOpen = leftTabs.includes(tabId) || rightTabs.includes(tabId);
    if (!isOpen) {
      openTab(tabId, fromSide); // <-- make sure openTab(tabId, preferredSide) exists
    }

    if (targetSide !== fromSide) {
      moveTab(tabId, targetSide);
    }
  };

  const getDraggedTabLabel = () => {
    if (!activeDragId) return null;
    const tabId = activeDragId.split("-").slice(1).join("-");
    const tab = TABS.find((t) => t.id === tabId);
    return tab?.label || null;
  };

  const hasRightTabs = rightTabs.length > 0;
  const isDragging = activeDragId !== null;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {isTopNavbarVisible && <TopNavbar />}
      <TabLauncherBar />

      <DndContext
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 flex overflow-hidden relative">
          {/* Drop zones */}
          {isDragging && isLeftDockVisible === false && (
            <DropZone side="left" />
          )}
          {isDragging && !hasRightTabs && <DropZone side="right" />}

          <ResizablePanelGroup orientation="horizontal" className="flex-1">
            {/* LEFT DOCK: always present unless hidden */}
            {isLeftDockVisible && (
              <>
                <ResizablePanel id="left-dock" defaultSize={25} minSize={20}>
                  <DockPanel
                    side="left"
                    tabs={leftTabs}
                    activeTab={activeLeftTab}
                  />
                </ResizablePanel>
                <ResizableHandle withHandle />
              </>
            )}

            {/* CANVAS: always present */}
            <ResizablePanel
              id="canvas"
              defaultSize={isLeftDockVisible && hasRightTabs ? 50 : 75}
            >
              <CanvasPlaceholder />
            </ResizablePanel>

            {/* RIGHT DOCK: only when it has tabs (for now) */}
            {hasRightTabs && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel id="right-dock" defaultSize={25} minSize={20}>
                  <DockPanel
                    side="right"
                    tabs={rightTabs}
                    activeTab={activeRightTab}
                  />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </div>

        <DragOverlay>
          {activeDragId && (
            <div className="px-3 py-1.5 bg-secondary rounded-md border border-primary/50 text-sm font-medium text-foreground shadow-lg glow-accent">
              {getDraggedTabLabel()}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
