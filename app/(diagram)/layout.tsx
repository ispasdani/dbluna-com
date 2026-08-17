import { ClerkProvider } from "@clerk/nextjs";
import { PlatformPaletteProvider } from "@/themeProviders/platformPaletteProvider";
import { ConvexClientProvider } from "@/app/providers/ConvexClientProvider";

export default function DiagramLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // afterSignOutUrl is set here rather than on <UserButton> (deprecated
  // there): without it, signing out from /d/[id] immediately re-enters
  // proxy.ts's auth.protect() and bounces to Clerk's hosted sign-in, which
  // reads as a crash. Land on marketing instead.
  return (
    <ClerkProvider afterSignOutUrl="/">
      <ConvexClientProvider>
        <PlatformPaletteProvider>
          <div className="">{children}</div>
        </PlatformPaletteProvider>
      </ConvexClientProvider>
    </ClerkProvider>
  );
}
