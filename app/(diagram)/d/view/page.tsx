"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, FileWarning, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CanvasStage } from "@/components/diagram-sections/canvas/canvas";
import { useCanvasStore, type DiagramData } from "@/store/useCanvasStore";
import { useStoreHydration } from "@/hooks/use-store-hydration";
import { decodeDiagramFromShare } from "@/lib/share-link";
import DbLuna from "@/components/uiJsxAssets/dbluna-logo";

// Anonymous, read-only share-link viewer. Never touches the visitor's own
// diagrams: the decoded data is staged under a throwaway id (cleaned up on
// unmount/pagehide) so it renders through the same CanvasStage the real
// editor uses, without ever being folded into the visitor's persisted
// `diagrams` record. See release-1-0/share-via-url-plan.md.
export default function ShareViewPage() {
  const router = useRouter();
  const hasHydrated = useStoreHydration();
  const importDiagram = useCanvasStore((s) => s.importDiagram);

  const [ephemeralId] = useState<string>(() => crypto.randomUUID());
  const [decodedData, setDecodedData] = useState<DiagramData | null | undefined>(undefined);
  const [isStaged, setIsStaged] = useState(false);

  // Decode once on mount — location.hash only exists client-side.
  useEffect(() => {
    const fragment = window.location.hash.slice(1);
    setDecodedData(decodeDiagramFromShare(fragment));
  }, []);

  // Stage the decoded diagram under the ephemeral id once hydration is done
  // and decoding has succeeded. Must commit before CanvasStage first mounts
  // (gated by isStaged) so its own setDiagramId effect finds real data
  // instead of creating an empty default at that id.
  useEffect(() => {
    if (!hasHydrated || !decodedData || isStaged) return;
    importDiagram(ephemeralId, decodedData);
    setIsStaged(true);
  }, [hasHydrated, decodedData, isStaged, importDiagram, ephemeralId]);

  // Best-effort cleanup so a viewed link never lingers in the visitor's own
  // diagram list — covers SPA navigation (unmount) and tab close (pagehide).
  useEffect(() => {
    const cleanup = () => useCanvasStore.getState().deleteDiagram(ephemeralId);
    window.addEventListener("pagehide", cleanup);
    return () => {
      window.removeEventListener("pagehide", cleanup);
      cleanup();
    };
  }, [ephemeralId]);

  const handleOpenAsCopy = () => {
    if (!decodedData) return;
    const newId = crypto.randomUUID();
    importDiagram(newId, decodedData);
    router.push(`/d/${newId}`);
  };

  const diagramName = useMemo(() => decodedData?.name ?? "Shared diagram", [decodedData]);

  if (decodedData === null) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 bg-background text-center px-4">
        <FileWarning className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">This link is invalid or has been corrupted.</p>
        <p className="text-xs text-muted-foreground max-w-sm">
          The share link may have been truncated when it was copied, or it isn&apos;t a dbluna
          share link at all. Ask whoever sent it to copy a fresh one.
        </p>
      </div>
    );
  }

  if (!hasHydrated || decodedData === undefined || !isStaged) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <DbLuna className="text-foreground w-full max-w-[100px] h-[26px] shrink-0" />
          <span className="text-sm font-medium truncate">{diagramName}</span>
          <span className="text-xs text-muted-foreground shrink-0">Read-only</span>
        </div>
        <Button size="sm" className="gap-2 shrink-0" onClick={handleOpenAsCopy}>
          <Copy className="w-4 h-4" />
          Open as copy
        </Button>
      </header>

      <div className="relative flex-1 overflow-hidden w-full">
        <div className="absolute inset-0">
          <CanvasStage diagramId={ephemeralId} readOnly />
        </div>
      </div>
    </div>
  );
}
