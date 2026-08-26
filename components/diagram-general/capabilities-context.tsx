"use client";

import { createContext, useContext } from "react";
import { TABS, type TabId } from "@/store/useDockStore";

const ALL_TAB_IDS = TABS.map((t) => t.id) as TabId[];

// Per-plan capability gate for the /d/[id] editor. Replaces the old single
// `editingReadOnly` boolean now that Free gets partial edit rights (the DBML
// Code tab only). This is a client-side render gate — the same trust model the
// app already used for `editingReadOnly` — not a security boundary. See
// free-tier-code-only-editing-plan.md §2.
export interface DiagramCapabilities {
  isPro: boolean;
  // Canvas gestures: drag, click-to-add, inline edit, drag-to-connect.
  canEditCanvas: boolean;
  // Typing in the Code tab and committing parsed DBML to the store.
  canEditCode: boolean;
  // Max tables per diagram / max diagrams total; null == unlimited (Pro).
  tableCap: number | null;
  diagramCap: number | null;
  // Dock tabs rendered at all (not just enabled).
  visibleTabs: TabId[];
  canUseDocsMode: boolean;
}

// Default = fully capable / no restrictions. The provider on /d/[id] always
// supplies real values; this default only matters if a consumer is ever
// rendered outside the provider, where "don't restrict" is the safe answer
// (it matches the app's behavior before this feature existed).
const DEFAULT_CAPABILITIES: DiagramCapabilities = {
  isPro: true,
  canEditCanvas: true,
  canEditCode: true,
  tableCap: null,
  diagramCap: null,
  visibleTabs: ALL_TAB_IDS,
  canUseDocsMode: true,
};

const CapabilitiesContext = createContext<DiagramCapabilities>(DEFAULT_CAPABILITIES);

export function CapabilitiesProvider({
  value,
  children,
}: {
  value: DiagramCapabilities;
  children: React.ReactNode;
}) {
  return (
    <CapabilitiesContext.Provider value={value}>
      {children}
    </CapabilitiesContext.Provider>
  );
}

export function useCapabilities(): DiagramCapabilities {
  return useContext(CapabilitiesContext);
}
