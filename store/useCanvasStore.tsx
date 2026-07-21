import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useEditorStore } from "./useEditorStore";
import { createDebouncedStorage } from "./debounced-storage";

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

// ─── Documentation-oriented schema metadata ──────────────────────────────────
// These have no visual representation on the canvas yet; they are authored via
// the DBML code editor and surfaced in the read-only Docs reflection.

export interface EnumValue {
  name: string;
  note?: string;
}

export interface CanvasEnum {
  id: string;
  name: string;
  values: EnumValue[];
  note?: string;
}

export interface CanvasTableGroup {
  id: string;
  name: string;
  // Canvas table names (may be schema-qualified, e.g. "dbo.Users").
  tableNames: string[];
}

export interface CanvasProject {
  name?: string;
  databaseType?: string;
  note?: string;
}

export const TABLE_COLORS = [
  "#e11d48", // rose
  "#ea580c", // orange
  "#d97706", // amber
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

export interface DiagramData {
  name: string;
  updatedAt: number;
  tables: Table[];
  notes: Note[];
  areas: Area[];
  relationships: Relationship[];
  enums: CanvasEnum[];
  tableGroups: CanvasTableGroup[];
  project: CanvasProject | null;
  background: CanvasBackground;
  snapToGrid: boolean;
  isFocusModeEnabled: boolean;
}

// The subset of DiagramData that lives at the top level of CanvasState while
// a diagram is active. `name`/`updatedAt` only ever live inside `diagrams[id]`.
// NOTE: keep this list in sync with DiagramData's data fields — a field added
// to DiagramData but not here would silently fail to persist per-diagram.
type CanvasFields = Pick<
  DiagramData,
  "tables" | "notes" | "areas" | "relationships" | "enums" | "tableGroups" | "project" | "background" | "snapToGrid" | "isFocusModeEnabled"
>;

function toCanvasFields(data: CanvasFields): CanvasFields {
  const { tables, notes, areas, relationships, enums, tableGroups, project, background, snapToGrid, isFocusModeEnabled } = data;
  return { tables, notes, areas, relationships, enums, tableGroups, project, background, snapToGrid, isFocusModeEnabled };
}

function createDefaultDiagram(): DiagramData {
  return {
    name: "Untitled diagram",
    updatedAt: Date.now(),
    tables: [],
    notes: [],
    areas: [],
    relationships: [],
    enums: [],
    tableGroups: [],
    project: null,
    background: "grid",
    snapToGrid: false,
    isFocusModeEnabled: true,
  };
}

type CanvasState = {
  hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
  activeDiagramId: string | null;
  diagrams: Record<string, DiagramData>;
  setDiagramId: (id: string) => void;
  renameDiagram: (id: string, name: string) => void;
  duplicateDiagram: (id: string) => string | null;
  deleteDiagram: (id: string) => void;
  importDiagram: (id: string, data: DiagramData) => void;
  background: CanvasBackground;
  tables: Table[];
  selectedTableIds: string[];
  setBackground: (bg: CanvasBackground) => void;
  toggleBackground: () => void;
  snapToGrid: boolean;
  toggleSnapToGrid: () => void;
  isFocusModeEnabled: boolean;
  toggleFocusMode: () => void;
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

  // Documentation schema metadata (authored via the DBML code editor)
  enums: CanvasEnum[];
  tableGroups: CanvasTableGroup[];
  project: CanvasProject | null;
  setEnums: (enums: CanvasEnum[]) => void;
  setTableGroups: (groups: CanvasTableGroup[]) => void;
  setProject: (project: CanvasProject | null) => void;

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
  savingStatus: "idle" | "saving" | "saved";
  setSavingStatus: (status: "idle" | "saving" | "saved") => void;
};

// Effective snapshot for `id`: if it's the currently-active diagram, its live
// top-level fields are the source of truth (the `diagrams` record entry for
// the active id is only written back on a diagram switch or persist write, so
// it can be stale or even absent while that diagram is the one on screen).
function snapshotFor(state: CanvasState, id: string): DiagramData | undefined {
  if (id === state.activeDiagramId) {
    const existing = state.diagrams[id];
    return {
      ...toCanvasFields(state),
      name: existing?.name ?? "Untitled diagram",
      updatedAt: existing?.updatedAt ?? Date.now(),
    };
  }
  return state.diagrams[id];
}

// For UI that lists all diagrams (e.g. the My Diagrams dialog) — overlays the
// active diagram's live state onto the persisted record so the diagram
// currently open always shows up with accurate data.
export function getEffectiveDiagrams(state: CanvasState): Record<string, DiagramData> {
  if (!state.activeDiagramId) return state.diagrams;
  const snap = snapshotFor(state, state.activeDiagramId);
  if (!snap) return state.diagrams;
  return { ...state.diagrams, [state.activeDiagramId]: snap };
}

export const useCanvasStore = create<CanvasState>()(
  persist(
    (set, get) => ({
      hasHydrated: false,
      setHasHydrated: (v) => set({ hasHydrated: v }),
      activeDiagramId: null,
      diagrams: {},
      setDiagramId: (id) => {
        const { activeDiagramId, diagrams } = get();

        // 1. Save current active state to map
        const newDiagrams = { ...diagrams };
        if (activeDiagramId) {
          const prevExisting = newDiagrams[activeDiagramId];
          newDiagrams[activeDiagramId] = {
            ...toCanvasFields(get()),
            name: prevExisting?.name ?? "Untitled diagram",
            updatedAt: Date.now(),
          };
        }

        // 2. Load new state from map or create a fresh default. Merge over the
        // default so a brand-new id gets sane values AND an older persisted
        // diagram that predates a field (e.g. enums/tableGroups/project) still
        // hydrates that field instead of leaving it undefined. Also make sure
        // the record actually has an entry for it (previously this only read,
        // never wrote, so a brand-new diagram id never appeared in `diagrams`
        // until you switched away from it once).
        const target = { ...createDefaultDiagram(), ...newDiagrams[id] };
        newDiagrams[id] = target;

        set({
          activeDiagramId: id,
          diagrams: newDiagrams,
          ...toCanvasFields(target),
          selectedTableIds: [],
          selectedRelationshipId: null,
          selectedNoteIds: [],
          selectedAreaIds: [],
        });
      },
      renameDiagram: (id, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((s) => {
          const existing = snapshotFor(s, id);
          if (!existing) return {};
          return { diagrams: { ...s.diagrams, [id]: { ...existing, name: trimmed } } };
        });
      },
      duplicateDiagram: (id) => {
        const s = get();
        const source = snapshotFor(s, id);
        if (!source) return null;
        const newId = crypto.randomUUID();
        set({
          diagrams: {
            ...s.diagrams,
            [newId]: {
              ...structuredClone(source),
              name: `${source.name} (copy)`,
              updatedAt: Date.now(),
            },
          },
        });
        return newId;
      },
      deleteDiagram: (id) => {
        set((s) => {
          const newDiagrams = { ...s.diagrams };
          delete newDiagrams[id];
          if (id === s.activeDiagramId) {
            const fresh = createDefaultDiagram();
            return {
              diagrams: newDiagrams,
              activeDiagramId: null,
              ...toCanvasFields(fresh),
              selectedTableIds: [],
              selectedRelationshipId: null,
              selectedNoteIds: [],
              selectedAreaIds: [],
            };
          }
          return { diagrams: newDiagrams };
        });
      },
      importDiagram: (id, data) => {
        set((s) => ({
          diagrams: {
            ...s.diagrams,
            [id]: {
              ...data,
              name: data.name?.trim() || "Imported diagram",
              updatedAt: Date.now(),
            },
          },
        }));
      },
      background: "grid",
      tables: [],
      selectedTableIds: [],
      selectedRelationshipId: null,
      setBackground: (bg) => set({ background: bg }),
      toggleBackground: () =>
        set((s) => ({ background: s.background === "grid" ? "dots" : "grid" })),
      snapToGrid: false,
      toggleSnapToGrid: () => set((s) => ({ snapToGrid: !s.snapToGrid })),
      isFocusModeEnabled: true,
      toggleFocusMode: () => set((s) => ({ isFocusModeEnabled: !s.isFocusModeEnabled })),
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

      // Documentation schema metadata
      enums: [],
      tableGroups: [],
      project: null,
      setEnums: (enums) => set({ enums }),
      setTableGroups: (tableGroups) => set({ tableGroups }),
      setProject: (project) => set({ project }),

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
      savingStatus: "idle",
      setSavingStatus: (status) => set({ savingStatus: status }),
    }),
    {
      name: "canvas-storage",
      // Debounced: note/area resize updates the store per pointermove;
      // serializing every diagram to IndexedDB each time causes jank.
      // onWriteComplete fires after a real flush lands, driving the honest
      // "Saved locally" indicator instead of a fake timer.
      storage: createDebouncedStorage(500, (name) => {
        if (name === "canvas-storage") {
          useCanvasStore.getState().setSavingStatus("saved");
        }
      }),
      onRehydrateStorage: () => (_state, error) => {
        if (error) console.error("Failed to rehydrate canvas-storage:", error);
        useCanvasStore.setState({ hasHydrated: true });
      },
      partialize: (state) => {
        const { activeDiagramId, diagrams } = state;
        const newDiagrams = { ...diagrams };
        if (activeDiagramId) {
          newDiagrams[activeDiagramId] = {
            ...toCanvasFields(state),
            name: diagrams[activeDiagramId]?.name ?? "Untitled diagram",
            updatedAt: Date.now(),
          };
        }
        // savingStatus/hasHydrated are intentionally NOT here — runtime-only.
        return { diagrams: newDiagrams };
      },
    }
  )
);
