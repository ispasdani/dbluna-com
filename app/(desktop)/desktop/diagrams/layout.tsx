import { PlatformPaletteProvider } from "@/themeProviders/platformPaletteProvider";

export default function DesktopDiagramLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PlatformPaletteProvider>
      <div className="h-full w-full">{children}</div>
    </PlatformPaletteProvider>
  );
}
