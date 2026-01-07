"use client";

import { useDraggable } from "@dnd-kit/core";
import { GripVertical, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DockSide, TabId, TABS, useDockStore } from "@/store/useDockStore";

export function DraggableTabClient({
  tabId,
  isActive,
  side,
  isOpen,
}: {
  tabId: TabId;
  isActive: boolean;
  side: DockSide;
  isOpen: boolean;
}) {
  const { setActiveTab, closeTab, openTab } = useDockStore();
  const tab = TABS.find((t) => t.id === tabId);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${side}-${tabId}`,
    data: { tabId, fromSide: side },
  });

  if (!tab) return null;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "dock-tab flex items-center gap-1.5 group cursor-grab active:cursor-grabbing select-none",
        isActive && "dock-tab-active",
        isDragging && "opacity-50",
        !isOpen && "opacity-70"
      )}
      onClick={() => {
        if (!isOpen) openTab(tabId, side);
        setActiveTab(side, tabId);
      }}
    >
      <GripVertical className="w-3 h-3 text-muted-foreground/50" />
      <span className="select-none">{tab.label}</span>

      {isOpen && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            closeTab(tabId, side);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="w-4 h-4 rounded-sm flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
