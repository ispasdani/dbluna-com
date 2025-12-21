import { PlatformPaletteProvider } from "@/themeProviders/platformPaletteProvider";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PlatformPaletteProvider>
      <section className="h-screen w-full font-primary bg-white [--pattern-fg:var(--color-charcoal-900)]/10 dark:bg-black dark:[--pattern-fg:var(--color-neutral-100)]/30">
        {children}
      </section>
    </PlatformPaletteProvider>
  );
}
