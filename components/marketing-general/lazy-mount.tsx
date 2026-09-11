"use client";
import { useEffect, useRef, useState } from "react";

interface LazyMountProps {
  children: React.ReactNode;
  /** How far before the viewport edge to start mounting (default 400px). */
  rootMargin?: string;
  className?: string;
}

/**
 * Defers mounting children until they are near the viewport.
 * Prevents off-screen animated sections from consuming CPU/GPU
 * before the user has scrolled to them.
 */
export const LazyMount = ({
  children,
  rootMargin = "400px",
  className,
}: LazyMountProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setMounted(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref} className={className}>
      {mounted ? children : null}
    </div>
  );
};
