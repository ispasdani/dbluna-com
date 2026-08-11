"use client";

import { useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const HEARTBEAT_INTERVAL_MS = 10_000;

// Heartbeats presence for a cloud diagram while its editor is mounted — no
// explicit "leave" mutation, the 30s staleness window in
// diagramPresence.listActive handles disconnects/closed tabs for free
// (release-1-0/collaboration-plan.md Phase B §4).
export function usePresence(cloudId: string | null | undefined) {
  const heartbeat = useMutation(api.diagramPresence.heartbeat);

  useEffect(() => {
    if (!cloudId) return;
    const diagramId = cloudId as Id<"diagrams">;
    let cancelled = false;

    const beat = () => {
      if (cancelled) return;
      void heartbeat({ diagramId });
    };

    beat();
    const interval = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [cloudId, heartbeat]);
}
