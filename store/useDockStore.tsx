import { create } from "zustand";

export type TabId = "code" | "schema" | "issues" | "templates" | "tables";
export type DockSide = "left" | "right";

export interface TabInfo {
  id: TabId;
  label: string;
  icon: string;
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

export const useDockStore = create<DockStore>((set, get) => ({
  leftTabs: [],
  rightTabs: [],
  activeLeftTab: null,
  activeRightTab: null,
  selectedDiagram: "Diagram A",
  diagrams: ["Diagram A", "Diagram B", "Diagram C"],

  openTab: (tabId, side = "right") => {
    const { leftTabs, rightTabs } = get();

    // Check if tab is already open somewhere
    if (leftTabs.includes(tabId)) {
      set({ activeLeftTab: tabId });
      return;
    }
    if (rightTabs.includes(tabId)) {
      set({ activeRightTab: tabId });
      return;
    }

    // Open in specified side
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
    const { leftTabs, rightTabs } = get();

    // Remove from current location
    const newLeftTabs = leftTabs.filter((t) => t !== tabId);
    const newRightTabs = rightTabs.filter((t) => t !== tabId);

    if (toSide === "left") {
      set({
        leftTabs: [...newLeftTabs, tabId],
        rightTabs: newRightTabs,
        activeLeftTab: tabId,
        activeRightTab: newRightTabs.length > 0 ? newRightTabs[0] : null,
      });
    } else {
      set({
        leftTabs: newLeftTabs,
        rightTabs: [...newRightTabs, tabId],
        activeRightTab: tabId,
        activeLeftTab: newLeftTabs.length > 0 ? newLeftTabs[0] : null,
      });
    }
  },

  setActiveTab: (side, tabId) => {
    if (side === "left") {
      set({ activeLeftTab: tabId });
    } else {
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
        activeLeftTab === tabId
          ? newLeftTabs.length > 0
            ? newLeftTabs[0]
            : null
          : activeLeftTab,
      activeRightTab:
        activeRightTab === tabId
          ? newRightTabs.length > 0
            ? newRightTabs[0]
            : null
          : activeRightTab,
    });
  },

  setSelectedDiagram: (diagram) => {
    set({ selectedDiagram: diagram });
  },

  createDiagram: (name) => {
    const { diagrams } = get();
    if (!diagrams.includes(name) && name.trim()) {
      set({
        diagrams: [...diagrams, name],
        selectedDiagram: name,
      });
    }
  },

  renameDiagram: (oldName, newName) => {
    const { diagrams, selectedDiagram } = get();
    if (!newName.trim() || diagrams.includes(newName)) return;

    const newDiagrams = diagrams.map((d) => (d === oldName ? newName : d));
    set({
      diagrams: newDiagrams,
      selectedDiagram: selectedDiagram === oldName ? newName : selectedDiagram,
    });
  },
}));
