"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Props<T> = {
  tabs: T[];
  renderTab: (tab: T) => React.ReactNode;
};

export function DockTabsHeader<T>({ tabs, renderTab }: Props<T>) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Arrows and edge fades only appear when there is something hidden in that
  // direction, so a dock wide enough for every tab shows a clean strip.
  const updateOverflow = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateOverflow();
    const ro = new ResizeObserver(updateOverflow);
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateOverflow, tabs.length]);

  const scrollBy = (dx: number) => {
    scrollerRef.current?.scrollBy({ left: dx, behavior: "smooth" });
  };

  // Vertical wheel scrolls the strip sideways, since there is no scrollbar.
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.currentTarget.scrollLeft += e.deltaY;
    }
  };

  return (
    <div className="relative h-11 shrink-0 border-b border-border bg-dock-header flex items-center">
      <div
        ref={scrollerRef}
        role="tablist"
        onScroll={updateOverflow}
        onWheel={onWheel}
        className="flex-1 min-w-0 h-full px-2 flex items-center gap-0.5 overflow-x-auto overflow-y-hidden scrollbar-none"
      >
        {tabs.map(renderTab)}
      </div>

      <ScrollArrow
        side="left"
        visible={canScrollLeft}
        onClick={() => scrollBy(-180)}
      />
      <ScrollArrow
        side="right"
        visible={canScrollRight}
        onClick={() => scrollBy(180)}
      />
    </div>
  );
}

function ScrollArrow({
  side,
  visible,
  onClick,
}: {
  side: "left" | "right";
  visible: boolean;
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;

  return (
    <div
      className={cn(
        "absolute inset-y-0 w-12 flex items-center transition-opacity duration-150",
        side === "left"
          ? "left-0 justify-start pl-1 bg-gradient-to-r"
          : "right-0 justify-end pr-1 bg-gradient-to-l",
        "from-[var(--dock-header)] from-40% to-transparent",
        visible ? "opacity-100" : "opacity-0 pointer-events-none",
      )}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label={`Scroll tabs ${side}`}
        onClick={onClick}
        className="h-6 w-6 rounded-[6px] flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
      >
        <Icon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
