"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type PlatformPalette = "default" | "dark";

const VALID_PALETTES: PlatformPalette[] = ["default", "dark"];

type Ctx = {
  palette: PlatformPalette;
  setPalette: (p: PlatformPalette) => void;
  mounted: boolean;
};

const PaletteContext = createContext<Ctx | null>(null);

export function PlatformPaletteProvider({ children }: { children: React.ReactNode }) {
  const [palette, setPalette] = useState<PlatformPalette>("default");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("diagram-palette") as PlatformPalette | null;
    if (stored && VALID_PALETTES.includes(stored)) setPalette(stored);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.dataset.palette = palette;
    document.documentElement.classList.toggle("dark", palette === "dark");
    window.localStorage.setItem("diagram-palette", palette);
  }, [palette, mounted]);

  const value = useMemo(
    () => ({ palette, setPalette, mounted }),
    [palette, mounted]
  );

  return (
    <PaletteContext.Provider value={value}>{children}</PaletteContext.Provider>
  );
}

export function usePlatformPalette() {
  const ctx = useContext(PaletteContext);
  if (!ctx) throw new Error("usePlatformPalette must be used within PlatformPaletteProvider");
  return ctx;
}
