"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Contrast, Palette, Sparkles, Zap } from "lucide-react";
import {
  PlatformPalette,
  usePlatformPalette,
} from "@/themeProviders/platformPaletteProvider";

const options: { value: PlatformPalette; label: string; icon: any }[] = [
  { value: "default", label: "Default", icon: Palette },
  { value: "blue", label: "Blue", icon: Sparkles },
  { value: "cyberpunk", label: "Cyberpunk", icon: Zap },
  { value: "contrast", label: "Contrast", icon: Contrast },
];

export function PlatformPaletteToggle() {
  const { palette, setPalette, mounted } = usePlatformPalette();

  // optional: avoid icon/UI mismatch before localStorage loads
  if (!mounted) return null;

  const CurrentIcon = options.find((o) => o.value === palette)?.icon ?? Palette;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <CurrentIcon className="w-5 h-5" />
          <span className="sr-only">Change palette</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map(({ value, label, icon: Icon }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => setPalette(value)}
            className={
              palette === value ? "bg-secondary text-primary gap-2" : "gap-2"
            }
          >
            <Icon className="w-4 h-4" />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
