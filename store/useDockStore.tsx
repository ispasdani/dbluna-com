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
  closeTab: (tabId: TabId, fromSide: "left" | "right") => void;

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
  leftTabs: TABS.map((t) => t.id) as TabId[],
  rightTabs: [],
  activeLeftTab: null,
  activeRightTab: null,

  selectedDiagram: "Diagram A",
  diagrams: ["Diagram A", "Diagram B", "Diagram C"],

  openTab: (tabId: TabId, preferredSide: "left" | "right" = "left") => {
    set((state) => {
      const alreadyLeft = state.leftTabs.includes(tabId);
      const alreadyRight = state.rightTabs.includes(tabId);

      // if already open, just activate it on that side
      if (alreadyLeft) return { activeLeftTab: tabId };
      if (alreadyRight) return { activeRightTab: tabId };

      // open new tab on preferred side
      if (preferredSide === "left") {
        return {
          leftTabs: [...state.leftTabs, tabId],
          activeLeftTab: tabId,
        };
      }

      return {
        rightTabs: [...state.rightTabs, tabId],
        activeRightTab: tabId,
      };
    });
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

  closeTab: (tabId, fromSide) =>
    set((state) => {
      if (fromSide === "right") {
        const nextRight = state.rightTabs.filter((t) => t !== tabId);

        const alreadyLeft = state.leftTabs.includes(tabId);
        const nextLeft = alreadyLeft
          ? state.leftTabs
          : [...state.leftTabs, tabId];

        return {
          rightTabs: nextRight,
          activeRightTab:
            state.activeRightTab === tabId
              ? (nextRight[0] ?? null)
              : state.activeRightTab,
          leftTabs: nextLeft,
          activeLeftTab: tabId,
        };
      }

      // from left -> actually close
      const nextLeft = state.leftTabs.filter((t) => t !== tabId);

      return {
        leftTabs: nextLeft,
        activeLeftTab:
          state.activeLeftTab === tabId
            ? (nextLeft[0] ?? null)
            : state.activeLeftTab,
      };
    }),

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
