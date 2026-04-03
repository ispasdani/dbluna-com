"use client";

import React, { createContext, useContext, useMemo } from "react";

// Kept for backward compatibility with components that might import it
export type PlatformPalette = "default" | "blue" | "cyberpunk" | "contrast" | "tokio-night" | "dracula";

type Ctx = {
  palette: PlatformPalette;
  setPalette: (p: PlatformPalette) => void;
  mounted: boolean;
};

const PaletteContext = createContext<Ctx | null>(null);

export function PlatformPaletteProvider({ children }: { children: React.ReactNode }) {
  // Hardcoded to "default" (which is now our standard Codex white theme)
  const palette: PlatformPalette = "default";
  const mounted = true;

  const value = useMemo(
    () => ({ palette, setPalette: () => {}, mounted }),
    [palette, mounted]
  );

  return (
    <PaletteContext.Provider value={value}>{children}</PaletteContext.Provider>
  );
}

export function usePlatformPalette() {
  const ctx = useContext(PaletteContext);
  if (!ctx)
    throw new Error("usePlatformPalette must be used within PlatformPaletteProvider");
  return ctx;
}
