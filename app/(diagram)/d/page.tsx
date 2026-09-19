"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useCanvasStore } from "@/store/useCanvasStore";
import { useStoreHydration } from "@/hooks/use-store-hydration";

// Invisible entry point: /d has no UI of its own. It lands a signed-in user
// straight inside a diagram — the one they last opened on this browser, else
// their most recently updated one, else a freshly created one (brand-new
// sign-up). This is what Clerk's post-sign-up redirect and every marketing
// CTA ("Open editor" / "Try it now") point at.
// Sign-in is enforced by proxy.ts's "everything under /d/* except /d/view"
// rule. See free-tier-code-only-editing-plan.md §5.
export default function DiagramEntryPage() {
  const router = useRouter();
  const hasHydrated = useStoreHydration();
  const handledRef = useRef(false);

  useEffect(() => {
    if (!hasHydrated || handledRef.current) return;
    handledRef.current = true;

    const { diagrams, lastOpenedDiagramId, createDiagram } =
      useCanvasStore.getState();

    if (lastOpenedDiagramId && diagrams[lastOpenedDiagramId]) {
      router.replace(`/d/${lastOpenedDiagramId}`);
      return;
    }

    const entries = Object.entries(diagrams);

    if (entries.length === 0) {
      const newId = createDiagram("Untitled diagram");
      router.replace(`/d/${newId}`);
      return;
    }

    // No usable lastOpenedDiagramId (never set on this browser yet, or that
    // diagram was deleted) — most recently updated is the closest honest
    // heuristic (and matches how My Diagrams already sorts).
    const mostRecentId = entries.reduce((a, b) =>
      (b[1].updatedAt ?? 0) > (a[1].updatedAt ?? 0) ? b : a
    )[0];
    router.replace(`/d/${mostRecentId}`);
  }, [hasHydrated, router]);

  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
