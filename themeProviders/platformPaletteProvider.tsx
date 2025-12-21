"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Palette = "default" | "blue" | "cyberpunk";
const PaletteContext = createContext<{
  palette: Palette;
  setPalette: (p: Palette) => void;
} | null>(null);

export function PlatformPaletteProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [palette, setPalette] = useState<Palette>("default");

  useEffect(() => {
    const saved = window.localStorage.getItem(
      "platform-palette"
    ) as Palette | null;
    if (saved) setPalette(saved);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("platform-palette", palette);
    document.documentElement.dataset.palette = palette;
  }, [palette]);

  return (
    <PaletteContext.Provider value={{ palette, setPalette }}>
      {children}
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
