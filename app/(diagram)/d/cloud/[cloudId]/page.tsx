"use client";

import { useEffect, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useCanvasStore } from "@/store/useCanvasStore";
import { useEditorStore } from "@/store/useEditorStore";
import { useStoreHydration } from "@/hooks/use-store-hydration";
import { pullCloudDiagram } from "@/lib/diagram-persistence";

interface PageProps {
  params: Promise<{ cloudId: string }>;
}

// Cross-device discovery bootstrap: looks up (or creates) a local id for a
// given Convex diagram id on first visit from a new device/browser, then
// redirects to the real editor route. Local ids are per-browser IndexedDB
// entries, so a second device has no /d/[id] URL that could ever reach a
// cloud diagram directly without first passing through here.
export default function CloudDiagramBootstrapPage({ params }: PageProps) {
  const { cloudId } = use(params);
  const router = useRouter();
  const hasHydrated = useStoreHydration();
  const [error, setError] = useState<string | null>(null);
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (!hasHydrated || attemptedRef.current) return;
    attemptedRef.current = true;

    const existingLocalId = useCanvasStore.getState().findLocalIdByCloudId(cloudId);
    if (existingLocalId) {
      router.replace(`/d/${existingLocalId}`);
      return;
    }

    let cancelled = false;
    (async () => {
      const result = await pullCloudDiagram(cloudId);
      if (cancelled) return;
      if (!result.ok) {
        setError("This cloud diagram doesn't exist or you don't have access to it.");
        return;
      }

      const newLocalId = crypto.randomUUID();
      useCanvasStore.getState().importDiagram(newLocalId, {
        ...result.data,
        storage: "cloud",
        cloudId,
        lastSyncedAt: result.remoteUpdatedAt,
      });
      useEditorStore.getState().setCameraForDiagram(newLocalId, result.camera);
      router.replace(`/d/${newLocalId}`);
    })();

    return () => {
      cancelled = true;
    };
  }, [cloudId, hasHydrated, router]);

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-background px-4">
        <p className="text-sm text-muted-foreground text-center max-w-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
