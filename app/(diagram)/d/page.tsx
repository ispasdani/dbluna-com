"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useCanvasStore } from "@/store/useCanvasStore";
import { useStoreHydration } from "@/hooks/use-store-hydration";

// Invisible entry point: /d has no UI of its own. It lands a signed-in user
// straight inside a diagram — a freshly created one if they have none yet
// (brand-new sign-up), otherwise their most recently updated one. This is what
// Clerk's post-sign-up redirect and the marketing "Get started" CTA point at.
// Sign-in is enforced by proxy.ts's "everything under /d/* except /d/view"
// rule. See free-tier-code-only-editing-plan.md §5.
export default function DiagramEntryPage() {
  const router = useRouter();
  const hasHydrated = useStoreHydration();
  const handledRef = useRef(false);

  useEffect(() => {
    if (!hasHydrated || handledRef.current) return;
    handledRef.current = true;

    const { diagrams, createDiagram } = useCanvasStore.getState();
    const entries = Object.entries(diagrams);

    if (entries.length === 0) {
      const newId = createDiagram("Untitled diagram");
      router.replace(`/d/${newId}`);
      return;
    }

    // activeDiagramId isn't persisted, so "last opened" isn't available on a
    // cold load — most recently updated is the closest honest heuristic (and
    // matches how My Diagrams already sorts).
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
