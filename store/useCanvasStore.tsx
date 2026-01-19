import { create } from "zustand";
import { useEditorStore } from "./useEditorStore";

export type CanvasBackground = "grid" | "dots";

export interface Column {
  id: string;
  name: string;
  type: string;
  isPrimaryKey: boolean;
  isNotNull: boolean;
  isUnique: boolean;
  isAutoIncrement: boolean;
}

export interface Table {
  id: string;
  name: string;
  x: number;
  y: number;
  color: string;
  isLocked?: boolean;
  columns: Column[];
}

export interface Relationship {
  id: string;
  name: string;
  sourceTableId: string;
  sourceColumnId: string;
  targetTableId: string;
  targetColumnId: string;
  cardinality: "One to one" | "One to many" | "Many to one";
  onUpdate: "No action" | "Restrict" | "Cascade" | "Set null" | "Set default";
  onDelete: "No action" | "Restrict" | "Cascade" | "Set null" | "Set default";
}

const TABLE_COLORS = [
  "#e11d48", // rose
  "#ea580c", // orange
  "#d97706", // amber
  "#16a34a", // green
  "#0284c7", // sky
  "#4f46e5", // indigo
  "#9333ea", // purple
  "#db2777", // pink
];

type CanvasState = {
  background: CanvasBackground;
  tables: Table[];
  selectedTableId: string | null;
  setBackground: (bg: CanvasBackground) => void;
  toggleBackground: () => void;
  snapToGrid: boolean;
  toggleSnapToGrid: () => void;
  addTable: () => void;
  updateTable: (id: string, updates: Partial<Table>) => void;
  updateTablePos: (id: string, x: number, y: number) => void;
  deleteTable: (id: string) => void;
  setSelectedTableId: (id: string | null) => void;
  // Field actions
  addField: (tableId: string) => void;
  updateField: (tableId: string, fieldId: string, updates: Partial<Column>) => void;
  deleteField: (tableId: string, fieldId: string) => void;
  relationships: Relationship[];
  addRelationship: (rel: Relationship) => void;
  updateRelationship: (id: string, updates: Partial<Relationship>) => void;
  deleteRelationship: (id: string) => void;
  setTables: (tables: Table[]) => void;
};

export const useCanvasStore = create<CanvasState>((set) => ({
  background: "grid",
  tables: [],
  selectedTableId: null,
  setBackground: (bg) => set({ background: bg }),
  toggleBackground: () =>
    set((s) => ({ background: s.background === "grid" ? "dots" : "grid" })),
  snapToGrid: false,
  toggleSnapToGrid: () => set((s) => ({ snapToGrid: !s.snapToGrid })),
  setSelectedTableId: (id) => set({ selectedTableId: id }),
  addTable: () =>
    set((s) => {
      const { viewport, camera } = useEditorStore.getState();
      
      const viewCenterX = viewport.w / 2;
      const viewCenterY = viewport.h / 2;
      
      // Convert screen center to world coordinates
      const worldX = (viewCenterX - camera.x) / camera.zoom;
      const worldY = (viewCenterY - camera.y) / camera.zoom;

      const newId = crypto.randomUUID();
      const newTable: Table = {
        id: newId,
        name: "users",
        // Center the 220px wide table (approx)
        x: worldX - 110, 
        y: worldY - 100,
        color: TABLE_COLORS[Math.floor(Math.random() * TABLE_COLORS.length)],
        isLocked: false,
        columns: [
          {
            id: crypto.randomUUID(),
            name: "id",
            type: "INT",
            isPrimaryKey: true,
            isNotNull: true,
            isUnique: true,
            isAutoIncrement: true,
          },
          {
            id: crypto.randomUUID(),
            name: "created_at",
            type: "TIMESTAMP",
            isPrimaryKey: false,
            isNotNull: true,
            isUnique: false,
            isAutoIncrement: false,
          },
          {
             id: crypto.randomUUID(),
             name: "email",
             type: "VARCHAR",
             isPrimaryKey: false,
             isNotNull: false,
             isUnique: false,
             isAutoIncrement: false,
          }
        ],
      };
      return { 
        tables: [...s.tables, newTable],
        selectedTableId: newId 
      };
    }),
  updateTable: (id, updates) =>
    set((s) => ({
      tables: s.tables.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),
  updateTablePos: (id, x, y) =>
    set((s) => ({
       tables: s.tables.map((t) => (t.id === id ? { ...t, x, y } : t)),
    })),
  deleteTable: (id) =>
    set((s) => ({
      tables: s.tables.filter((t) => t.id !== id),
      selectedTableId: s.selectedTableId === id ? null : s.selectedTableId,
    })),
  addField: (tableId) =>
    set((s) => ({
      tables: s.tables.map((t) =>
        t.id === tableId
          ? {
              ...t,
              columns: [
                ...t.columns,
                {
                  id: crypto.randomUUID(),
                  name: "new_field",
                  type: "VARCHAR",
                  isPrimaryKey: false,
                  isNotNull: false,
                  isUnique: false,
                  isAutoIncrement: false,
                },
              ],
            }
          : t
      ),
    })),
  updateField: (tableId, fieldId, updates) =>
    set((s) => ({
      tables: s.tables.map((t) =>
        t.id === tableId
          ? {
              ...t,
              columns: t.columns.map((c) =>
                c.id === fieldId ? { ...c, ...updates } : c
              ),
            }
          : t
      ),
    })),
  deleteField: (tableId, fieldId) =>
    set((s) => ({
      tables: s.tables.map((t) =>
        t.id === tableId
          ? {
              ...t,
              columns: t.columns.filter((c) => c.id !== fieldId),
            }
          : t
      ),
    })),
  relationships: [],
  addRelationship: (rel) =>
    set((s) => ({ relationships: [...s.relationships, rel] })),
  updateRelationship: (id, updates) =>
    set((s) => ({
      relationships: s.relationships.map((r) =>
        r.id === id ? { ...r, ...updates } : r
      ),
    })),
  deleteRelationship: (id) =>
    set((s) => ({ relationships: s.relationships.filter((r) => r.id !== id) })),
  setTables: (tables) => set({ tables }),
}));
