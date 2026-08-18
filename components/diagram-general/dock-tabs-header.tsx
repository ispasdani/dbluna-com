"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props<T> = {
  tabs: T[];
  renderTab: (tab: T) => React.ReactNode;
};

export function DockTabsHeader<T>({ tabs, renderTab }: Props<T>) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const scrollBy = (dx: number) => {
    scrollerRef.current?.scrollBy({ left: dx, behavior: "smooth" });
  };

  return (
    <div className="h-14 shrink-0 border-b border-border bg-dock-header px-2 flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={() => scrollBy(-180)}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div
        ref={scrollerRef}
        className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto overflow-y-hidden scrollbar-thin pt-1 pb-1"
      >
        {tabs.map(renderTab)}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={() => scrollBy(180)}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
