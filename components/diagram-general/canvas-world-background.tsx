"use client";

import { useMemo } from "react";
import type { CanvasBackground } from "@/store/useCanvasStore";

/**
 * The `backgroundPosition` for a given camera origin. Exported because the
 * canvas writes it straight to the DOM while a pan gesture is in flight
 * (see `queuePan` in canvas.tsx) — both paths must agree on the format or
 * the grid would jump when the pan is finally committed to the store.
 */
export function backgroundPositionFor(
  variant: CanvasBackground,
  x: number,
  y: number
) {
  const origin = `${x}px ${y}px`;
  // "grid" layers four background-images, so it needs four positions.
  return variant === "dots" ? origin : `${origin}, ${origin}, ${origin}, ${origin}`;
}

export function WorldBackground({
  camera,
  variant,
  ref,
}: {
  camera: { x: number; y: number; zoom: number };
  variant: CanvasBackground;
  ref?: React.Ref<HTMLDivElement>;
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
        backgroundPosition: backgroundPositionFor(variant, camera.x, camera.y),
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

      backgroundPosition: backgroundPositionFor(variant, camera.x, camera.y),
    };
  }, [camera.x, camera.y, minor, major, variant]);

  return <div ref={ref} style={style} />;
}
