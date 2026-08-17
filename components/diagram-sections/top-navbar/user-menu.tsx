"use client";

import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";

// Clerk renders its popover in a portal on <body>, which is exactly where
// themeProviders/platformPaletteProvider sets data-palette — so pointing
// Clerk's variables at our tokens keeps the menu in step with whichever
// palette is active, including the dark ones (dracula, tokio-night).
// Deliberately only the plain-colour variables: colorPrimary/colorNeutral are
// scale-generating, and Clerk can't derive a shade ramp from a var().
const appearance = {
  variables: {
    colorBackground: "var(--popover)",
    colorForeground: "var(--popover-foreground)",
    colorMutedForeground: "var(--muted-foreground)",
    colorInput: "var(--input)",
    colorInputForeground: "var(--foreground)",
    borderRadius: "var(--radius)",
  },
  elements: {
    // Matches the 7x7 avatars in presence-avatars.tsx sitting beside it.
    avatarBox: "h-7 w-7",
  },
};

export function UserMenu() {
  // The diagram page already subscribes to this query, so it's a free read.
  // Non-throwing by design — signed-out resolves to { isPro: false }.
  const plan = useQuery(api.users.getCurrentUserPlan);
  const isPro = plan?.isPro ?? false;

  return (
    <>
      <SignedIn>
        <UserButton appearance={appearance}>
          <UserButton.MenuItems>
            <UserButton.Link
              label={isPro ? "Manage plan" : "Upgrade to Pro"}
              href="/pricing"
              labelIcon={<Sparkles className="w-4 h-4" />}
            />
          </UserButton.MenuItems>
        </UserButton>
      </SignedIn>
      <SignedOut>
        {/* Unreachable on /d/[id] — proxy.ts protects that route — but this is
            the guard for when the navbar gets reused somewhere public. Modal
            rather than a link to /sign-in, since no such page exists yet. */}
        <SignInButton mode="modal">
          <Button size="sm" variant="outline">
            Sign in
          </Button>
        </SignInButton>
      </SignedOut>
    </>
  );
}
