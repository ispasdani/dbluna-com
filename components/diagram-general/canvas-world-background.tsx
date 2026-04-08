"use client";

import { useMemo } from "react";
import type { CanvasBackground } from "@/store/useCanvasStore";

export function WorldBackground({
  camera,
  variant,
}: {
  camera: { x: number; y: number; zoom: number };
  variant: CanvasBackground;
}) {
  const minor = 24 * camera.zoom;
  const major = minor * 5;

  const style = useMemo<React.CSSProperties>(() => {
    if (variant === "dots") {
      return {
        width: "100%",
        height: "100%",
        position: "absolute",
        inset: 0,
        pointerEvents: "none",

        backgroundImage:
          "radial-gradient(var(--canvas-dots) 1px, transparent 1px)",
        backgroundSize: `${minor}px ${minor}px`,
        backgroundPosition: `${camera.x}px ${camera.y}px`,
      };
    }

    // variant === "grid"
    return {
      width: "100%",
      height: "100%",
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

      backgroundPosition: `${camera.x}px ${camera.y}px, ${camera.x}px ${camera.y}px, ${camera.x}px ${camera.y}px, ${camera.x}px ${camera.y}px`,
    };
  }, [camera.x, camera.y, minor, major, variant]);

  return <div style={style} />;
}
