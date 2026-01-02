import { create } from "zustand";

export type TabId = "code" | "schema" | "issues" | "templates" | "tables";
export type DockSide = "left" | "right";

export interface TabInfo {
  id: TabId;
  label: string;
  icon: string; // keep as string if you're mapping to lucide later
}

export const TABS: TabInfo[] = [
  { id: "code", label: "Code", icon: "Code" },
  { id: "schema", label: "Schema", icon: "Database" },
  { id: "issues", label: "Issues", icon: "AlertCircle" },
  { id: "templates", label: "Templates", icon: "LayoutTemplate" },
  { id: "tables", label: "Tables", icon: "Table" },
];

interface DockState {
  leftTabs: TabId[];
  rightTabs: TabId[];
  activeLeftTab: TabId | null;
  activeRightTab: TabId | null;

  selectedDiagram: string;
  diagrams: string[];
}

interface DockActions {
  openTab: (tabId: TabId, side?: DockSide) => void;
  moveTab: (tabId: TabId, toSide: DockSide) => void;
  setActiveTab: (side: DockSide, tabId: TabId) => void;
  closeTab: (tabId: TabId) => void;

  setSelectedDiagram: (diagram: string) => void;
  createDiagram: (name: string) => void;
  renameDiagram: (oldName: string, newName: string) => void;
}

type DockStore = DockState & DockActions;

function nextActive(tabs: TabId[], prevActive: TabId | null): TabId | null {
  if (!tabs.length) return null;
  if (prevActive && tabs.includes(prevActive)) return prevActive;
  return tabs[0];
}

export const useDockStore = create<DockStore>((set, get) => ({
  leftTabs: [],
  rightTabs: [],
  activeLeftTab: null,
  activeRightTab: null,

  selectedDiagram: "Diagram A",
  diagrams: ["Diagram A", "Diagram B", "Diagram C"],

  openTab: (tabId, side = "right") => {
    const { leftTabs, rightTabs } = get();

    // If already open, just focus it (on whichever side it is)
    if (leftTabs.includes(tabId)) {
      set({ activeLeftTab: tabId });
      return;
    }
    if (rightTabs.includes(tabId)) {
      set({ activeRightTab: tabId });
      return;
    }

    // Otherwise open on requested side
    if (side === "left") {
      set({
        leftTabs: [...leftTabs, tabId],
        activeLeftTab: tabId,
      });
    } else {
      set({
        rightTabs: [...rightTabs, tabId],
        activeRightTab: tabId,
      });
    }
  },

  moveTab: (tabId, toSide) => {
    const { leftTabs, rightTabs, activeLeftTab, activeRightTab } = get();

    // Remove from both sides first
    const newLeftTabs = leftTabs.filter((t) => t !== tabId);
    const newRightTabs = rightTabs.filter((t) => t !== tabId);

    if (toSide === "left") {
      const finalLeftTabs = [...newLeftTabs, tabId];

      set({
        leftTabs: finalLeftTabs,
        rightTabs: newRightTabs,

        // focus moved tab on destination side
        activeLeftTab: tabId,

        // keep right active if still valid, otherwise pick first
        activeRightTab: nextActive(newRightTabs, activeRightTab),
      });
    } else {
      const finalRightTabs = [...newRightTabs, tabId];

      set({
        leftTabs: newLeftTabs,
        rightTabs: finalRightTabs,

        activeRightTab: tabId,
        activeLeftTab: nextActive(newLeftTabs, activeLeftTab),
      });
    }
  },

  setActiveTab: (side, tabId) => {
    const { leftTabs, rightTabs } = get();

    // (Optional safety) only allow activating a tab that exists on that side
    if (side === "left") {
      if (!leftTabs.includes(tabId)) return;
      set({ activeLeftTab: tabId });
    } else {
      if (!rightTabs.includes(tabId)) return;
      set({ activeRightTab: tabId });
    }
  },

  closeTab: (tabId) => {
    const { leftTabs, rightTabs, activeLeftTab, activeRightTab } = get();

    const newLeftTabs = leftTabs.filter((t) => t !== tabId);
    const newRightTabs = rightTabs.filter((t) => t !== tabId);

    set({
      leftTabs: newLeftTabs,
      rightTabs: newRightTabs,

      activeLeftTab:
        activeLeftTab === tabId ? nextActive(newLeftTabs, null) : activeLeftTab,
      activeRightTab:
        activeRightTab === tabId
          ? nextActive(newRightTabs, null)
          : activeRightTab,
    });
  },

  setSelectedDiagram: (diagram) => set({ selectedDiagram: diagram }),

  createDiagram: (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const { diagrams } = get();
    if (diagrams.includes(trimmed)) {
      set({ selectedDiagram: trimmed });
      return;
    }

    set({
      diagrams: [...diagrams, trimmed],
      selectedDiagram: trimmed,
    });
  },

  renameDiagram: (oldName, newName) => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    const { diagrams, selectedDiagram } = get();
    if (diagrams.includes(trimmed)) return;

    const newDiagrams = diagrams.map((d) => (d === oldName ? trimmed : d));

    set({
      diagrams: newDiagrams,
      selectedDiagram: selectedDiagram === oldName ? trimmed : selectedDiagram,
    });
  },
}));
