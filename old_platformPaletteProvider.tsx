"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type PlatformPalette =
  | "default"
  | "blue"
  | "cyberpunk"
  | "contrast"
  | "tokio-night"
  | "dracula";

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

  // Load ONLY for diagram area (optional)
  useEffect(() => {
    const stored = window.localStorage.getItem(
      "diagram-palette"
    ) as PlatformPalette | null;
    if (stored) setPalette(stored);
    setMounted(true);
  }, []);

  // Apply palette while mounted + cleanup on unmount
  useEffect(() => {
    if (!mounted) return;

    // apply
    document.body.dataset.palette = palette;

    // optionally persist (diagram-only)
    window.localStorage.setItem("diagram-palette", palette);

    // ✅ critical: reset when leaving diagram routes
    return () => {
      delete document.body.dataset.palette;
    };
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
  if (!ctx)
    throw new Error(
      "usePlatformPalette must be used within PlatformPaletteProvider"
    );
  return ctx;
}
