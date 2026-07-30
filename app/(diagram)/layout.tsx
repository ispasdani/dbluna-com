import { ClerkProvider } from "@clerk/nextjs";
import { PlatformPaletteProvider } from "@/themeProviders/platformPaletteProvider";
import { ConvexClientProvider } from "@/app/providers/ConvexClientProvider";

export default function DiagramLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <ConvexClientProvider>
        <PlatformPaletteProvider>
          <div className="">{children}</div>
        </PlatformPaletteProvider>
      </ConvexClientProvider>
    </ClerkProvider>
  );
}
