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
import { TopNavbar } from "./TopNavbar";
import { TabLauncherBar } from "./TabLauncherBar";
import { DockPanel, DropZone } from "./DockPanel";
import { CanvasPlaceholder } from "./CanvasPlaceholder";
import { useState } from "react";
import { useDockStore } from "@/store/useDockStore";

export function DiagramPage() {
  const { leftTabs, rightTabs, activeLeftTab, activeRightTab, moveTab } =
    useDockStore();
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

    // Determine target side
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

    if (targetSide && targetSide !== activeData.fromSide) {
      moveTab(activeData.tabId as TabId, targetSide);
    }
  };

  const getDraggedTabLabel = () => {
    if (!activeDragId) return null;
    const tabId = activeDragId.split("-").slice(1).join("-");
    const tab = TABS.find((t) => t.id === tabId);
    return tab?.label || null;
  };

  const hasLeftTabs = leftTabs.length > 0;
  const hasRightTabs = rightTabs.length > 0;
  const isDragging = activeDragId !== null;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <TopNavbar />
      <TabLauncherBar />

      <DndContext
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 flex overflow-hidden relative">
          {/* Drop zones - shown when dragging and no tabs on that side */}
          {isDragging && !hasLeftTabs && <DropZone side="left" />}
          {isDragging && !hasRightTabs && <DropZone side="right" />}

          {/* Main content layout */}
          {hasLeftTabs || hasRightTabs ? (
            <ResizablePanelGroup direction="horizontal" className="flex-1">
              {hasLeftTabs && (
                <>
                  <ResizablePanel
                    id="left-dock"
                    order={1}
                    defaultSize={25}
                    minSize={15}
                    maxSize={40}
                  >
                    <DockPanel
                      side="left"
                      tabs={leftTabs}
                      activeTab={activeLeftTab}
                    />
                  </ResizablePanel>
                  <ResizableHandle withHandle />
                </>
              )}

              <ResizablePanel
                id="canvas"
                order={2}
                defaultSize={hasLeftTabs && hasRightTabs ? 50 : 75}
              >
                <CanvasPlaceholder />
              </ResizablePanel>

              {hasRightTabs && (
                <>
                  <ResizableHandle withHandle />
                  <ResizablePanel
                    id="right-dock"
                    order={3}
                    defaultSize={25}
                    minSize={15}
                    maxSize={40}
                  >
                    <DockPanel
                      side="right"
                      tabs={rightTabs}
                      activeTab={activeRightTab}
                    />
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          ) : (
            /* No tabs at all - just canvas */
            <CanvasPlaceholder />
          )}
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
