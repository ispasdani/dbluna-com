import { PlatformPaletteProvider } from "@/themeProviders/platformPaletteProvider";

export default function DiagramLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ClerkProvider and ConvexClientProvider used to be mounted here. They now
  // live in app/layout.tsx so they are never torn down by a navigation
  // between route groups — see the comment there for what that broke.
  return (
    <PlatformPaletteProvider>
      <div className="">{children}</div>
    </PlatformPaletteProvider>
  );
}
