"use client";

import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";

import { useDockStore } from "@/store/useDockStore";
import { useViewStore } from "@/store/useViewStore";
import { TopNavbar } from "@/components/diagram-sections/top-navbar/top-navbar";
import { DockPanel } from "@/components/diagram-general/dock-panel";
import { TabLauncherBar } from "@/components/diagram-sections/toolbar";
import { CanvasStage } from "@/components/diagram-sections/canvas/canvas";

export default function DiagramPage() {
  const { leftTabs, activeLeftTab } = useDockStore();
  const { isTopNavbarVisible, isLeftDockVisible } = useViewStore();

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {isTopNavbarVisible && <TopNavbar />}
      <TabLauncherBar />

      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup orientation="horizontal" className="h-full">
          {isLeftDockVisible && (
            <>
              <ResizablePanel
                id="left-dock"
                defaultSize={25}
                className="min-w-[260px]"
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

          {/* Canvas always fills the rest */}
          <ResizablePanel id="canvas" defaultSize={75} minSize={30}>
            <CanvasStage />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
