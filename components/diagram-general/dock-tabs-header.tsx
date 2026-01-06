"use client";

import { useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TabId, TABS, useDockStore } from "@/store/useDockStore";

type Props = {
  side: "left" | "right";
  tabs: TabId[];
  activeTab: TabId | null;
};

export function DockTabsHeader({ side, tabs, activeTab }: Props) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const { setActiveTab } = useDockStore();

  const tabsMeta = useMemo(() => {
    return tabs
      .map((id) => TABS.find((t) => t.id === id))
      .filter(Boolean) as typeof TABS;
  }, [tabs]);

  const scrollBy = (dx: number) => {
    scrollerRef.current?.scrollBy({ left: dx, behavior: "smooth" });
  };

  return (
    <div className="h-11 border-b border-border bg-dock-header px-2 flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => scrollBy(-180)}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div
        ref={scrollerRef}
        className="flex-1 flex items-center gap-1 overflow-x-auto scrollbar-none"
      >
        {tabsMeta.length === 0 ? (
          <div className="text-xs text-muted-foreground px-2">No tabs open</div>
        ) : (
          tabsMeta.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(side, tab.id)}
                className={cn(
                  "shrink-0 px-2.5 h-8 rounded-md text-sm flex items-center gap-2 transition-colors",
                  isActive
                    ? "bg-secondary text-foreground ring-1 ring-primary/25"
                    : "text-muted-foreground hover:text-foreground hover:bg-panel-hover"
                )}
              >
                <span className="truncate max-w-[120px]">{tab.label}</span>
              </button>
            );
          })
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => scrollBy(180)}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
