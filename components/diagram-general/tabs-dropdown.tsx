"use client";

import React, { useMemo } from "react";
import { DropdownMenu as Menu } from "radix-ui";
import {
  AlertCircle,
  ChevronDown,
  Code,
  Database,
  Layers,
  LayoutTemplate,
  Link,
  ListOrdered,
  PanelsTopLeft,
  Square,
  StickyNote,
  Table,
} from "lucide-react";

import { DiagramButton } from "./diagram-button";
import { TABS, useDockStore, type TabId } from "@/store/useDockStore";
import { useCapabilities } from "./capabilities-context";
import { cn } from "@/lib/utils";
import menu from "./toolbar-menus.module.scss";

const iconMap = {
  Code,
  Database,
  AlertCircle,
  Layers,
  LayoutTemplate,
  Table,
  Link,
  StickyNote,
  Square,
  ListOrdered,
};

/**
 * Show or hide each dock tab. A switch per tab, since every entry is an
 * on/off choice: on opens it (on `side` if it isn't open yet), off closes it
 * from whichever side it's on.
 */
export function TabsDropdown({ side = "left" }: { side?: "left" | "right" }) {
  const { leftTabs, rightTabs, openTab, closeTab } = useDockStore();
  const { visibleTabs } = useCapabilities();

  const tabs = useMemo(() => TABS.filter((t) => visibleTabs.includes(t.id)), [visibleTabs]);
  const openCount = tabs.filter((t) => leftTabs.includes(t.id) || rightTabs.includes(t.id)).length;

  const toggle = (id: TabId) => {
    if (leftTabs.includes(id)) closeTab(id, "left");
    else if (rightTabs.includes(id)) closeTab(id, "right");
    else openTab(id, side);
  };

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <DiagramButton variant="outlined">
          <PanelsTopLeft className="w-3.5 h-3.5" />
          Tabs
          <span className={menu.trigCount}>{openCount}</span>
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </DiagramButton>
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Content align="start" sideOffset={6} className={cn(menu.menu, menu.tabs)}>
          <Menu.Label className={menu.group}>Show in the dock</Menu.Label>
          {tabs.map((tab) => {
            const Icon = iconMap[tab.icon as keyof typeof iconMap];
            const where = leftTabs.includes(tab.id) ? "Left" : rightTabs.includes(tab.id) ? "Right" : null;
            return (
              <Menu.CheckboxItem
                key={tab.id}
                className={menu.item}
                checked={where !== null}
                onCheckedChange={() => toggle(tab.id)}
                onSelect={(e) => e.preventDefault()}
              >
                <span className={menu.icon}>
                  <Icon className="w-4 h-4" />
                </span>
                <span className={menu.text}>
                  {tab.label}
                  {where === "Right" && <small>Right side</small>}
                </span>
                <span className={menu.switch} aria-hidden />
              </Menu.CheckboxItem>
            );
          })}
          <Menu.Separator className={menu.sep} />
          <p className={menu.foot}>
            {openCount} of {tabs.length} shown
          </p>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
