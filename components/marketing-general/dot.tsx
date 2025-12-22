"use client";

import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { useTheme } from "next-themes";

export const Dot = ({
  top,
  left,
  right,
  bottom,
}: {
  top?: boolean;
  left?: boolean;
  right?: boolean;
  bottom?: boolean;
}) => {
  const [isNearMouse, setIsNearMouse] = useState(false);
  const dotRef = useRef<HTMLDivElement>(null);

  // (Optional) if you actually need theme; otherwise remove this line.
  const { theme } = useTheme();

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dotRef.current) return;

      const dotRect = dotRef.current.getBoundingClientRect();
      const dotCenterX = dotRect.left + dotRect.width / 2;
      const dotCenterY = dotRect.top + dotRect.height / 2;

      const distance = Math.sqrt(
        Math.pow(e.clientX - dotCenterX, 2) +
          Math.pow(e.clientY - dotCenterY, 2)
      );

      const nextIsNear = distance <= 100;

      // Avoid unnecessary state updates (and extra renders)
      setIsNearMouse((prev) => (prev === nextIsNear ? prev : nextIsNear));
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <motion.div
      ref={dotRef}
      className={cn(
        "absolute z-10 h-2 w-2",
        top && "top-0 xl:-top-1",
        left && "left-0 xl:-left-2",
        right && "right-0 xl:-right-2",
        bottom && "bottom-0 xl:-bottom-1"
      )}
      animate={{
        backgroundColor: isNearMouse
          ? "var(--color-brand)"
          : "var(--color-primary-motion)",
        boxShadow: isNearMouse
          ? "0 0 20px var(--color-brand), 0 0 40px var(--color-brand)"
          : "none",
        scale: isNearMouse ? 1.5 : 1,
        borderRadius: isNearMouse ? "50%" : "0%",
      }}
      transition={{
        duration: 0.3,
        ease: "easeOut",
      }}
    />
  );
};
