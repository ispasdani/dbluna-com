"use client";

import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/store/useCanvasStore";
import styles from "./canvas.module.scss";

export function CanvasPlaceholder() {
  const background = useCanvasStore((s) => s.background);

  return (
    <div className="h-full w-full bg-background relative overflow-hidden">
      {/* Background layer */}
      <div
        className={cn(
          "absolute inset-0",
          background === "none" && "bg-background",
          background === "grid" && styles["canvas-bg-grid"],
          background === "dots" && styles["canvas-bg-dots"]
        )}
      />

      {/* Content layer */}
      <div className="absolute inset-0">
        <div className="h-full w-full flex items-center justify-center">
          <div className="text-sm text-muted-foreground">
            Canvas (background: {background})
          </div>
        </div>
      </div>
    </div>
  );
}
