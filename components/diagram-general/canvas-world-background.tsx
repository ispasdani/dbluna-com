"use client";

import { useMemo } from "react";
import type { CanvasBackground } from "@/store/useCanvasStore";

export function WorldBackground({
  w,
  h,
  variant,
}: {
  w: number;
  h: number;
  variant: CanvasBackground;
}) {
  const minor = 24;
  const major = minor * 5;

  const style = useMemo<React.CSSProperties>(() => {
    if (variant === "dots") {
      return {
        width: w,
        height: h,
        position: "absolute",
        inset: 0,
        pointerEvents: "none",

        backgroundImage:
          "radial-gradient(var(--canvas-dots) 1px, transparent 1px)",
        backgroundSize: `${minor}px ${minor}px`,
        backgroundPosition: "0 0",
      };
    }

    // variant === "grid"
    return {
      width: w,
      height: h,
      position: "absolute",
      inset: 0,
      pointerEvents: "none",

      backgroundImage: [
        // minor
        "linear-gradient(to right, var(--canvas-grid) 1px, transparent 1px)",
        "linear-gradient(to bottom, var(--canvas-grid) 1px, transparent 1px)",
        // major (slightly stronger: reuse dots token)
        "linear-gradient(to right, var(--canvas-dots) 1px, transparent 1px)",
        "linear-gradient(to bottom, var(--canvas-dots) 1px, transparent 1px)",
      ].join(","),

      backgroundSize: [
        `${minor}px ${minor}px`,
        `${minor}px ${minor}px`,
        `${major}px ${major}px`,
        `${major}px ${major}px`,
      ].join(","),

      backgroundPosition: "0 0, 0 0, 0 0, 0 0",
    };
  }, [w, h, variant]);

  return <div style={style} />;
}
