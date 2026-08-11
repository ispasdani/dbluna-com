// app/(whatever)/diagram/page.tsx
"use client";

import { useRef, use } from "react";
import { useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useCanvasStore } from "@/store/useCanvasStore";
import { useDockStore } from "@/store/useDockStore";
import { useViewStore } from "@/store/useViewStore";
import { TopNavbar } from "@/components/diagram-sections/top-navbar/top-navbar";
import { DockPanel } from "@/components/diagram-general/dock-panel";
import { TabLauncherBar } from "@/components/diagram-sections/toolbar";
import { CanvasStage } from "@/components/diagram-sections/canvas/canvas";
import { useDiagramAutoSave } from "@/hooks/use-diagram-autosave";
import { useCloudAutoSave } from "@/hooks/use-cloud-autosave";
import { useCloudReconciliation } from "@/hooks/use-cloud-reconciliation";
import { usePresence } from "@/hooks/use-presence";
import { useStoreHydration } from "@/hooks/use-store-hydration";
import { DocsLayout } from "@/components/documentation/docs-layout";
import { UpgradeToast } from "@/components/diagram-general/upgrade-toast";
import { ConflictBanner } from "@/components/diagram-general/conflict-banner";
import { EDITING_GATE_ENABLED } from "@/lib/feature-flags";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function DiagramPage({ params }: PageProps) {
  const { id } = use(params);
  const hasHydrated = useStoreHydration();
  const { ready: cloudReady } = useCloudReconciliation(id);
  useDiagramAutoSave();
  useCloudAutoSave();
  usePresence(useCanvasStore((s) => s.diagrams[id]?.cloudId));

  // Off while EDITING_GATE_ENABLED is false (default) — see lib/feature-flags.ts.
  // While loading (or if the flag is off), default to "not pro" so a
  // free-tier user is never briefly shown edit affordances before the real
  // plan resolves.
  const planQuery = useQuery(api.users.getCurrentUserPlan);
  const isPro = planQuery?.isPro ?? false;
  const editingReadOnly = EDITING_GATE_ENABLED && !isPro;
  const { leftTabs, activeLeftTab } = useDockStore();
  const {
    isTopNavbarVisible,
    isLeftDockVisible,
    leftDockWidth,
    setLeftDockWidth,
    workspaceMode,
  } = useViewStore();

  const dragRef = useRef<{ active: boolean; startX: number; startW: number }>({
    active: false,
    startX: 0,
    startW: leftDockWidth,
  });

  const onHandlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startW: leftDockWidth,
    };
  };

  const onHandlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    setLeftDockWidth(clamp(dragRef.current.startW + dx, 260, 720));
  };

  const onHandlePointerUp = () => {
    dragRef.current.active = false;
  };

  if (!hasHydrated || !cloudReady) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {isTopNavbarVisible && <TopNavbar readOnly={editingReadOnly} />}
      <TabLauncherBar readOnly={editingReadOnly} />

      {/* Work area */}
      <div className="relative flex-1 overflow-hidden w-full flex">
        {workspaceMode === "diagram" && (
          <>
            {/* Canvas is ALWAYS full size (fixed) */}
            <div className="absolute inset-0">
              <CanvasStage diagramId={id} readOnly={editingReadOnly} />
            </div>

            {/* Left dock overlays the canvas */}
            {isLeftDockVisible && (
              <div
                className="absolute inset-y-0 left-0 z-20 min-w-[260px] max-w-[720px]"
                style={{ width: leftDockWidth }}
              >
                <div className="h-full bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-r">
                  <DockPanel
                    side="left"
                    tabs={leftTabs}
                    activeTab={activeLeftTab}
                    readOnly={editingReadOnly}
                  />
                </div>

                {/* Drag handle */}
                <div
                  className="absolute right-0 top-0 h-full w-2 cursor-col-resize"
                  onPointerDown={onHandlePointerDown}
                  onPointerMove={onHandlePointerMove}
                  onPointerUp={onHandlePointerUp}
                  title="Resize"
                >
                  {/* optional visible grip */}
                  <div className="mx-auto h-full w-[1px] bg-border/70" />
                </div>
              </div>
            )}
          </>
        )}
        {workspaceMode === "docs" && <DocsLayout readOnly={editingReadOnly} />}
      </div>

      <UpgradeToast />
      <ConflictBanner />
    </div>
  );
}
