"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DockSide, TabId, TABS, useDockStore } from "@/store/useDockStore";
import { IssuesTabBadge } from "./issues-tab-badge";

export function DockTab({
  tabId,
  isActive,
  side,
}: {
  tabId: TabId;
  isActive: boolean;
  side: DockSide;
}) {
  const { setActiveTab, closeTab } = useDockStore();
  const tab = TABS.find((t) => t.id === tabId);

  if (!tab) return null;

  // A div rather than a <button>: the close control is itself a button, and
  // buttons can't nest.
  return (
    <div
      role="tab"
      aria-selected={isActive}
      tabIndex={0}
      data-active={isActive || undefined}
      onClick={() => setActiveTab(side, tabId)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setActiveTab(side, tabId);
        }
      }}
      className={cn(
        "group relative shrink-0 h-7 max-w-48 pl-2.5 pr-1.5 flex items-center gap-1.5",
        "rounded-[7px] border text-[13px] leading-none whitespace-nowrap select-none cursor-pointer",
        "transition-[background-color,color,border-color] duration-75",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        isActive
          ? "border-border bg-background text-foreground font-medium shadow-xs"
          : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <span className="truncate">{tab.label}</span>

      {tabId === "issues" && <IssuesTabBadge />}

      <button
        type="button"
        aria-label={`Close ${tab.label}`}
        onClick={(e) => {
          e.stopPropagation();
          closeTab(tabId, side);
        }}
        className={cn(
          "w-4 h-4 shrink-0 rounded-[4px] flex items-center justify-center text-muted-foreground",
          "hover:bg-muted hover:text-foreground focus-visible:opacity-100 transition-opacity",
          isActive ? "opacity-60" : "opacity-0 group-hover:opacity-60",
          "hover:!opacity-100",
        )}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
