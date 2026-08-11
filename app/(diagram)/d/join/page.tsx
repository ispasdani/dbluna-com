"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ConvexError } from "convex/values";
import { convex } from "@/lib/convex-client";
import { api } from "@/convex/_generated/api";

// Accepting a collaboration invite (release-1-0/collaboration-plan.md Phase A).
// Distinct from app/(diagram)/d/cloud/[cloudId]/page.tsx's cross-device
// bootstrap: that route is for the owner opening a diagram they already have
// access to on a new device; this route is the one place a *token* turns into
// real `diagramMembers` access, then hands off to the same bootstrap flow to
// get a local id and land in the real editor.
export default function JoinInvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [error, setError] = useState<string | null>(null);
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (attemptedRef.current) return;
    attemptedRef.current = true;

    let cancelled = false;
    (async () => {
      if (!token) {
        if (!cancelled) setError("This invite link is missing its token.");
        return;
      }

      try {
        const result = await convex.mutation(api.diagramInvites.accept, { token });
        if (cancelled) return;
        router.replace(`/d/cloud/${result.diagramId}`);
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof ConvexError && typeof err.data === "string"
            ? err.data
            : "Couldn't accept this invite — please try again.";
        setError(message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, router]);

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
