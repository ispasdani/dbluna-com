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
  comment?: string;
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

export const TABLE_COLORS = [
  "#e11d48",
  "#ea580c",
  "#d97706",
  "#16a34a", // green
  "#0284c7", // sky
  "#4f46e5", // indigo
  "#9333ea", // purple
  "#db2777", // pink
];

export interface Note {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  content: string;
  color: string;
  isLocked: boolean;
}

export interface Area {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  color: string;
  isLocked: boolean;
  zIndex: number;
}

type CanvasState = {
  background: CanvasBackground;
  tables: Table[];
  selectedTableIds: string[];
  setBackground: (bg: CanvasBackground) => void;
  toggleBackground: () => void;
  snapToGrid: boolean;
  toggleSnapToGrid: () => void;
  addTable: () => void;
  updateTable: (id: string, updates: Partial<Table>) => void;
  updateTablePos: (id: string, x: number, y: number) => void;
  moveTables: (moves: { id: string, x: number, y: number }[]) => void;
  deleteTable: (id: string) => void;
  deleteTables: (ids: string[]) => void;
  setSelectedTableIds: (ids: string[]) => void;
  // Field actions
  addField: (tableId: string) => void;
  updateField: (tableId: string, fieldId: string, updates: Partial<Column>) => void;
  deleteField: (tableId: string, fieldId: string) => void;
  relationships: Relationship[];
  selectedRelationshipId: string | null;
  setSelectedRelationshipId: (id: string | null) => void;
  addRelationship: (rel: Partial<Relationship> & Pick<Relationship, "sourceTableId" | "sourceColumnId" | "targetTableId" | "targetColumnId">) => void;
  updateRelationship: (id: string, updates: Partial<Relationship>) => void;
  deleteRelationship: (id: string) => void;
  setTables: (tables: Table[]) => void;

  // Notes
  notes: Note[];
  selectedNoteIds: string[];
  addNote: () => void;
  updateNote: (id: string, updates: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  setSelectedNoteIds: (ids: string[]) => void;
  moveNotes: (moves: { id: string, x: number, y: number }[]) => void;

  // Areas
  areas: Area[];
  selectedAreaIds: string[];
  addArea: () => void;
  updateArea: (id: string, updates: Partial<Area>) => void;
  deleteArea: (id: string) => void;
  setSelectedAreaIds: (ids: string[]) => void;
  moveAreas: (moves: { id: string, x: number, y: number }[]) => void;
};


export const useCanvasStore = create<CanvasState>((set) => ({
  background: "grid",
  tables: [],
  selectedTableIds: [],
  selectedRelationshipId: null,
  setBackground: (bg) => set({ background: bg }),
  toggleBackground: () =>
    set((s) => ({ background: s.background === "grid" ? "dots" : "grid" })),
  snapToGrid: false,
  toggleSnapToGrid: () => set((s) => ({ snapToGrid: !s.snapToGrid })),
  setSelectedTableIds: (ids) => set({ selectedTableIds: ids, selectedRelationshipId: null, selectedNoteIds: [], selectedAreaIds: [] }),
  setSelectedRelationshipId: (id) => set({ selectedRelationshipId: id, selectedTableIds: [], selectedNoteIds: [], selectedAreaIds: [] }),
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
        selectedTableIds: [newId]
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
  moveTables: (moves) =>
    set((s) => {
      const map = new Map(moves.map(m => [m.id, m]));
      return {
        tables: s.tables.map(t => {
          const move = map.get(t.id);
          if (move) return { ...t, x: move.x, y: move.y };
          return t;
        })
      };
    }),
  deleteTable: (id) =>
    set((s) => ({
      tables: s.tables.filter((t) => t.id !== id),
      selectedTableIds: s.selectedTableIds.filter(tid => tid !== id),
    })),
  deleteTables: (ids) =>
    set((s) => ({
      tables: s.tables.filter(t => !ids.includes(t.id)),
      selectedTableIds: s.selectedTableIds.filter(tid => !ids.includes(tid)),
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
    set((s) => {
      const newRel: Relationship = {
        id: crypto.randomUUID(),
        name: "",
        cardinality: "One to many",
        onUpdate: "No action",
        onDelete: "No action",
        ...rel,
      };
      return {
        relationships: [...s.relationships, newRel],
        selectedRelationshipId: newRel.id,
        selectedTableIds: []
      };
    }),
  updateRelationship: (id, updates) =>
    set((s) => ({
      relationships: s.relationships.map((r) =>
        r.id === id ? { ...r, ...updates } : r
      ),
    })),
  deleteRelationship: (id) =>
    set((s) => ({
      relationships: s.relationships.filter((r) => r.id !== id),
      selectedRelationshipId: s.selectedRelationshipId === id ? null : s.selectedRelationshipId,
    })),
  setTables: (tables) => set({ tables }),

  // Notes Actions
  notes: [],
  selectedNoteIds: [],
  addNote: () =>
    set((s) => {
      const { viewport, camera } = useEditorStore.getState();
      const viewCenterX = viewport.w / 2;
      const viewCenterY = viewport.h / 2;
      const worldX = (viewCenterX - camera.x) / camera.zoom;
      const worldY = (viewCenterY - camera.y) / camera.zoom;

      const newId = crypto.randomUUID();
      const newNote: Note = {
        id: newId,
        x: worldX - 100, // Center 200px wide note
        y: worldY - 75,
        width: 200,
        height: 150,
        title: "Untitled Note",
        content: "",
        color: "#e11d48", // Default color (Red-ish)
        isLocked: false,
      };

      return {
        notes: [...s.notes, newNote],
        selectedNoteIds: [newId],
        selectedTableIds: [],
        selectedRelationshipId: null,
      };
    }),
  updateNote: (id, updates) =>
    set((s) => ({
      notes: s.notes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    })),
  deleteNote: (id) =>
    set((s) => ({
      notes: s.notes.filter((n) => n.id !== id),
      selectedNoteIds: s.selectedNoteIds.filter((nid) => nid !== id),
    })),
  setSelectedNoteIds: (ids) =>
    set({
      selectedNoteIds: ids,
      selectedTableIds: [],
      selectedRelationshipId: null,
      selectedAreaIds: [],
    }),
  moveNotes: (moves) =>
    set((s) => {
      const map = new Map(moves.map((m) => [m.id, m]));
      return {
        notes: s.notes.map((n) => {
          const move = map.get(n.id);
          if (move) return { ...n, x: move.x, y: move.y };
          return n;
        }),
      };
    }),

  // Areas Actions
  areas: [],
  selectedAreaIds: [],
  addArea: () =>
    set((s) => {
      const { viewport, camera } = useEditorStore.getState();
      const viewCenterX = viewport.w / 2;
      const viewCenterY = viewport.h / 2;
      const worldX = (viewCenterX - camera.x) / camera.zoom;
      const worldY = (viewCenterY - camera.y) / camera.zoom;

      const newId = crypto.randomUUID();
      const newArea: Area = {
        id: newId,
        x: worldX - 250,
        y: worldY - 200,
        width: 500,
        height: 400,
        title: "New Area",
        color: "#94a3b8", // slate-400
        isLocked: false,
        zIndex: 0,
      };

      return {
        areas: [...s.areas, newArea],
        selectedAreaIds: [newId],
        selectedTableIds: [],
        selectedRelationshipId: null,
        selectedNoteIds: [],
      };
    }),
  updateArea: (id, updates) =>
    set((s) => ({
      areas: s.areas.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    })),
  deleteArea: (id) =>
    set((s) => ({
      areas: s.areas.filter((a) => a.id !== id),
      selectedAreaIds: s.selectedAreaIds.filter((aid) => aid !== id),
    })),
  setSelectedAreaIds: (ids) =>
    set({
      selectedAreaIds: ids,
      selectedTableIds: [],
      selectedRelationshipId: null,
      selectedNoteIds: [],
    }),
  moveAreas: (moves) =>
    set((s) => {
      const map = new Map(moves.map((m) => [m.id, m]));
      return {
        areas: s.areas.map((a) => {
          const move = map.get(a.id);
          if (move) return { ...a, x: move.x, y: move.y };
          return a;
        }),
      };
    }),
}));
