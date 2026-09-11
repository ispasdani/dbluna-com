"use client";
import { cn } from "@/lib/utils";
import React, { useEffect, useRef } from "react";

interface PixelatedCanvasProps {
  isActive: boolean;
  className?: string;
  size?: number;
  duration?: number;
  fillColor?: string;
  backgroundColor?: string;
}

export const PixelatedCanvas: React.FC<PixelatedCanvasProps> = ({
  isActive,
  className = "",
  size = 4,
  duration = 2500,
  fillColor = "var(--color-brand, #f17463)",
  backgroundColor = "var(--color-gray-200, white)",
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const dimsRef = useRef({ width: 0, height: 0 });

  const resolveColor = (color: string): string => {
    if (typeof window === "undefined") return color;
    const div = document.createElement("div");
    div.style.color = color;
    document.body.appendChild(div);
    const resolved = window.getComputedStyle(div).color;
    document.body.removeChild(div);
    return resolved;
  };

  // Track canvas size with a ResizeObserver — no React state involved
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas?.parentElement) return;

    const sync = () => {
      const w = canvas.parentElement!.clientWidth;
      const h = canvas.parentElement!.clientHeight;
      canvas.width = w;
      canvas.height = h;
      dimsRef.current = { width: w, height: h };
    };

    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(canvas.parentElement!);
    return () => ro.disconnect();
  }, []);

  // Animation loop — never touches React state, draws directly to canvas
  useEffect(() => {
    if (!isActive) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const SQUARE_SIZE = size;
    const { width, height } = dimsRef.current;
    if (width === 0 || height === 0) return;

    const resolvedFill = resolveColor(fillColor);
    const resolvedBg = resolveColor(backgroundColor);

    const cols = Math.floor(width / SQUARE_SIZE);
    const rows = Math.floor(height / SQUARE_SIZE);
    const total = cols * rows;
    if (total === 0) return;

    // Fisher-Yates shuffle for random reveal order
    const order = Array.from({ length: total }, (_, i) => i);
    for (let i = total - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [order[i], order[j]] = [order[j], order[i]];
    }

    ctx.fillStyle = resolvedBg;
    ctx.fillRect(0, 0, width, height);

    let lastFilled = 0;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const target = (progress * total) | 0;

      // Incremental draw — only paint newly revealed squares
      if (target > lastFilled) {
        ctx.fillStyle = resolvedFill;
        for (let i = lastFilled; i < target; i++) {
          const sq = order[i];
          const col = sq % cols;
          const row = (sq / cols) | 0;
          ctx.fillRect(
            col * SQUARE_SIZE,
            row * SQUARE_SIZE,
            SQUARE_SIZE,
            SQUARE_SIZE
          );
        }
        lastFilled = target;
      }

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      const { width: w, height: h } = dimsRef.current;
      ctx.fillStyle = resolvedBg;
      ctx.fillRect(0, 0, w, h);
    };
  }, [isActive, size, duration, fillColor, backgroundColor]);

  return (
    <canvas
      ref={canvasRef}
      className={cn("w-full h-full", className)}
      style={{ imageRendering: "pixelated" }}
    />
  );
};
