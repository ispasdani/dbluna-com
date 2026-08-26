// app/(whatever)/diagram/page.tsx
"use client";

import { useRef, use, useEffect, useMemo } from "react";
import { useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useCanvasStore } from "@/store/useCanvasStore";
import { useDockStore, TABS, type TabId } from "@/store/useDockStore";
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
import { OnboardingModal } from "@/components/diagram-general/onboarding-modal";
import {
  CapabilitiesProvider,
  type DiagramCapabilities,
} from "@/components/diagram-general/capabilities-context";
import { useOnboardingStore, ONBOARDING_SEEN_KEY } from "@/store/useOnboardingStore";
import { EDITING_GATE_ENABLED } from "@/lib/feature-flags";
import { FREE_MAX_TABLES_PER_DIAGRAM, FREE_MAX_DIAGRAMS } from "@/lib/plan-limits";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

const ALL_TAB_IDS = TABS.map((t) => t.id) as TabId[];
// Free plan sees only the DBML Code tab. Everything else is hidden, not just
// disabled — see free-tier-code-only-editing-plan.md Goals.
const FREE_TAB_IDS: TabId[] = ["code"];

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

  // While EDITING_GATE_ENABLED is false, the whole plan gate is off and every
  // signed-in user gets the full (Pro) capability set — same escape hatch the
  // old `editingReadOnly` computation had. `getCurrentUserPlan` is undefined
  // until it resolves; treat that (and pre-hydration) as "not Pro" so a Free
  // user is never briefly shown Pro affordances. See
  // free-tier-code-only-editing-plan.md §2.
  const planQuery = useQuery(api.users.getCurrentUserPlan);
  const gateActive = EDITING_GATE_ENABLED;
  const planResolved = planQuery !== undefined;
  const isPro = planQuery?.isPro ?? false;
  const effectivePro = !gateActive || (planResolved && isPro);

  const capabilities = useMemo<DiagramCapabilities>(
    () => ({
      isPro: effectivePro,
      canEditCanvas: effectivePro,
      // Both tiers may type in the Code tab and commit parsed DBML.
      canEditCode: true,
      tableCap: effectivePro ? null : FREE_MAX_TABLES_PER_DIAGRAM,
      diagramCap: effectivePro ? null : FREE_MAX_DIAGRAMS,
      visibleTabs: effectivePro ? ALL_TAB_IDS : FREE_TAB_IDS,
      canUseDocsMode: effectivePro,
    }),
    [effectivePro]
  );

  // Mirror canEditCode into the store's Code-tab kill-switch. CanvasStage
  // separately mirrors `readOnly` (canvas gestures) from its own prop below.
  const setCodeReadOnly = useCanvasStore((s) => s.setCodeReadOnly);
  useEffect(() => {
    setCodeReadOnly(!capabilities.canEditCode);
    return () => setCodeReadOnly(false);
  }, [capabilities.canEditCode, setCodeReadOnly]);

  // Onboarding modal: auto-show once per browser, after the plan resolves so
  // the right variant (Free vs Pro) renders. The TopNavbar help icon reopens
  // it anytime regardless of this flag. See
  // free-tier-code-only-editing-plan.md §8.
  const openOnboarding = useOnboardingStore((s) => s.open);
  useEffect(() => {
    if (!planResolved) return;
    try {
      if (localStorage.getItem(ONBOARDING_SEEN_KEY)) return;
      localStorage.setItem(ONBOARDING_SEEN_KEY, "1");
      openOnboarding();
    } catch {
      // localStorage unavailable (private mode / blocked) — skip the auto-show.
    }
  }, [planResolved, openOnboarding]);

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

  // Canvas mutation affordances (drag, Add Table/Note/Area, drag-to-connect)
  // stay gated exactly as before — Free is still `true` here.
  const canvasReadOnly = !capabilities.canEditCanvas;
  const showDocs = workspaceMode === "docs" && capabilities.canUseDocsMode;

  return (
    <CapabilitiesProvider value={capabilities}>
      <div className="h-screen flex flex-col bg-background overflow-hidden">
        {isTopNavbarVisible && <TopNavbar readOnly={canvasReadOnly} />}
        <TabLauncherBar readOnly={canvasReadOnly} />

        {/* Work area */}
        <div className="relative flex-1 overflow-hidden w-full flex">
          {!showDocs && (
            <>
              {/* Canvas is ALWAYS full size (fixed) */}
              <div className="absolute inset-0">
                <CanvasStage diagramId={id} readOnly={canvasReadOnly} />
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
                      readOnly={canvasReadOnly}
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
          {showDocs && <DocsLayout readOnly={canvasReadOnly} />}
        </div>

        <UpgradeToast />
        <ConflictBanner />
        <OnboardingModal />
      </div>
    </CapabilitiesProvider>
  );
}
