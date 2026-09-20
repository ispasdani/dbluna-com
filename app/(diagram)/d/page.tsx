"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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

// How long to let router.replace() commit before giving up on it. A soft
// navigation to /d/[id] normally commits in well under this; the fallback
// below is only for a client router that has stalled.
const SOFT_NAV_TIMEOUT_MS = 2500;

export default function DiagramEntryPage() {
  const router = useRouter();
  const pathname = usePathname();
  const hasHydrated = useStoreHydration();
  const handledRef = useRef(false);
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!hasHydrated || handledRef.current) return;
    handledRef.current = true;

    const { diagrams, lastOpenedDiagramId, createDiagram } =
      useCanvasStore.getState();

    const go = (id: string) => {
      const href = `/d/${id}`;
      setTarget(href);
      router.replace(href);
    };

    if (lastOpenedDiagramId && diagrams[lastOpenedDiagramId]) {
      go(lastOpenedDiagramId);
      return;
    }

    const entries = Object.entries(diagrams);

    if (entries.length === 0) {
      go(createDiagram("Untitled diagram"));
      return;
    }

    // No usable lastOpenedDiagramId (never set on this browser yet, or that
    // diagram was deleted) — most recently updated is the closest honest
    // heuristic (and matches how My Diagrams already sorts).
    const mostRecentId = entries.reduce((a, b) =>
      (b[1].updatedAt ?? 0) > (a[1].updatedAt ?? 0) ? b : a
    )[0];
    go(mostRecentId);
  }, [hasHydrated, router]);

  // Self-healing fallback. Clerk lands people here after checkout and after
  // sign-up, and a soft navigation arriving from another route group has been
  // seen to fetch its RSC payload and then never commit — leaving this spinner
  // up until the user refreshed by hand. If the URL still has not moved off
  // /d by the deadline, do what that refresh did: a hard navigation, which no
  // stuck transition can swallow.
  useEffect(() => {
    if (!target || pathname !== "/d") return;

    const t = setTimeout(() => {
      if (window.location.pathname === "/d") {
        window.location.replace(target);
      }
    }, SOFT_NAV_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [target, pathname]);

  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
