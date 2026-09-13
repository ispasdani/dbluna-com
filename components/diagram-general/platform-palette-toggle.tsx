"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlatformPalette } from "@/themeProviders/platformPaletteProvider";

export function PlatformPaletteToggle() {
  const { palette, setPalette, mounted } = usePlatformPalette();

  if (!mounted) return null;

  return (
    <div className="flex items-center bg-muted border border-border rounded-[7px] p-0.5 gap-0.5">
      {(["default", "dark"] as const).map((value) => {
        const isActive = palette === value;
        const Icon = value === "default" ? Sun : Moon;
        return (
          <button
            key={value}
            onClick={() => setPalette(value)}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-[5px] text-[11px] font-medium transition-colors duration-75 cursor-pointer",
              isActive
                ? "bg-card text-foreground shadow-sm ring-1 ring-inset ring-border"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-3 h-3" />
            {value === "default" ? "Light" : "Dark"}
          </button>
        );
      })}
    </div>
  );
}
