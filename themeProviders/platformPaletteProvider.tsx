"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type PlatformPalette = "default" | "blue" | "cyberpunk";

type Ctx = {
  palette: PlatformPalette;
  setPalette: (p: PlatformPalette) => void;
  mounted: boolean;
};

const PaletteContext = createContext<Ctx | null>(null);

export function PlatformPaletteProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [palette, setPalette] = useState<PlatformPalette>("default");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(
      "platform-palette"
    ) as PlatformPalette | null;
    if (stored) setPalette(stored);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    window.localStorage.setItem("platform-palette", palette);
  }, [palette, mounted]);

  const value = useMemo(
    () => ({ palette, setPalette, mounted }),
    [palette, mounted]
  );

  return (
    <PaletteContext.Provider value={value}>
      {/* ✅ apply palette to a wrapper, not <html> */}
      <div data-palette={palette}>{children}</div>
    </PaletteContext.Provider>
  );
}

export function usePlatformPalette() {
  const ctx = useContext(PaletteContext);
  if (!ctx)
    throw new Error(
      "usePlatformPalette must be used within PlatformPaletteProvider"
    );
  return ctx;
}
