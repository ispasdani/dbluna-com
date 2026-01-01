import { TabLauncherBar } from "@/components/diagram-general/tab-launcher-bar";
import { TopNavbar } from "@/components/diagram-sections/top-navbar/top-navbar";
import { PlatformPaletteProvider } from "@/themeProviders/platformPaletteProvider";

export default function DiagramLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PlatformPaletteProvider>
      <section className="h-screen w-full font-primary bg-white [--pattern-fg:var(--color-charcoal-900)]/10 dark:bg-black dark:[--pattern-fg:var(--color-neutral-100)]/30">
        <TopNavbar />
        <TabLauncherBar />
        {children}
      </section>
    </PlatformPaletteProvider>
  );
}
