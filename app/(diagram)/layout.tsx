import { PlatformPaletteProvider } from "@/themeProviders/platformPaletteProvider";

export default function DiagramLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PlatformPaletteProvider>
      <div className="">{children}</div>
    </PlatformPaletteProvider>
  );
}
