"use client";

import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth } from "@clerk/nextjs";
import { ReactNode } from "react";
import { convex } from "@/lib/convex-client";

// Must be nested inside <ClerkProvider>. Without this, Convex calls carry no
// Clerk session token, so ctx.auth.getUserIdentity() resolves to null for
// every client-triggered query/mutation regardless of sign-in state — see
// release-1-0/paid-editing-access-plan.md §2 for where this was caught.
export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
