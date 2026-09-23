import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createDebouncedStorage } from "./debounced-storage";
import { renameInHiddenSet } from "@/lib/schema-visibility";
import type { GroupSource } from "@/lib/table-grouping";

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 3.0;

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));


export type Camera = { x: number; y: number; zoom: number };

/**
 * The hidden set for a diagram with nothing hidden. Module-level so selectors
 * return the same identity every time — a fresh `[]` per call would hand the
 * canvas a new array on every render and invalidate every memo downstream.
 */
export const EMPTY_HIDDEN: readonly string[] = [];

type EditorState = {
  hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
  activeDiagramId: string | null;
  cameras: Record<string, Camera>;
  setEditorDiagramId: (id: string) => void;
  // Hydrates a specific diagram's camera from a cloud pull (release-1-0's
  // Phase 3 cloud sync) — updates the live `camera` too if that diagram
  // happens to be the active one, since `camera` otherwise only mirrors
  // `cameras[activeDiagramId]` on the next setEditorDiagramId switch.
  setCameraForDiagram: (id: string, camera: Camera) => void;
  camera: Camera;

  viewport: { w: number; h: number };
  setViewport: (w: number, h: number) => void;

  panBy: (dx: number, dy: number) => void;

  zoomAt: (factor: number, screenX: number, screenY: number) => void;
  setZoomAt: (nextZoom: number, screenX: number, screenY: number) => void;

  // ✅ for minimap or programmatic moves (always clamps)
  setCameraXY: (x: number, y: number) => void;

  resetCamera: () => void;

  // Runtime-only flag: while true, the canvas renders every table/note/area
  // regardless of viewport culling, so SVG export can capture the whole
  // diagram rather than just what's currently on screen. Never persisted.
  isExporting: boolean;
  setIsExporting: (v: boolean) => void;

  // Groups hidden from the canvas, per diagram, keyed like `cameras`. Values
  // are group keys (lib/table-grouping.ts; for schemas, the bare `schemaKey`),
  // never table ids: visibility is view state, not content, so it is private
  // to this browser and never synced. See
  // release-1-0/schemas-tab-and-visibility-plan.md D2. The name predates the
  // other grouping sources; keys from every source share this one list. All
  // actions act on `activeDiagramId`.
  hiddenSchemas: Record<string, readonly string[]>;
  setSchemaHidden: (schema: string, hidden: boolean) => void;
  /** Bulk: "only this one", "show all". */
  setHiddenSchemas: (schemas: readonly string[]) => void;
  /** Keeps a hidden schema hidden across a rename. */
  renameHiddenSchema: (from: string, to: string) => void;

  // What "a group" means for this diagram — schemas, DBML TableGroups or FK
  // clusters. Per diagram, view state like the rest; absent means "schema".
  groupBy: Record<string, GroupSource>;
  setGroupBy: (source: GroupSource) => void;
};

/** Writes one diagram's hidden set, dropping the entry once it is empty. */
function withHidden(
  all: Record<string, readonly string[]>,
  diagramId: string,
  next: readonly string[]
): Record<string, readonly string[]> {
  const out = { ...all };
  if (next.length === 0) delete out[diagramId];
  else out[diagramId] = next;
  return out;
}

export const useEditorStore = create<EditorState>()(
  persist(
    (set, get) => ({
      hasHydrated: false,
      setHasHydrated: (v) => set({ hasHydrated: v }),
      activeDiagramId: null,
      cameras: {},
      setEditorDiagramId: (id) => {
        const { activeDiagramId, cameras, camera } = get();
        const newCameras = { ...cameras };
        if (activeDiagramId) {
          newCameras[activeDiagramId] = camera;
        }
        const target = newCameras[id] || { x: 0, y: 0, zoom: 1 };
        set({
          activeDiagramId: id,
          cameras: newCameras,
          camera: target,
        });
      },
      setCameraForDiagram: (id, camera) => {
        set((s) => ({
          cameras: { ...s.cameras, [id]: camera },
          camera: id === s.activeDiagramId ? camera : s.camera,
        }));
      },
      camera: { x: 0, y: 0, zoom: 1 },

      viewport: { w: 1, h: 1 },

      setViewport: (w, h) => {
        set({ viewport: { w, h } });
      },

      panBy: (dx, dy) => {
        const { camera } = get();
        const next = { x: camera.x + dx, y: camera.y + dy };
        set({ camera: { ...camera, ...next } });
      },

      zoomAt: (factor, screenX, screenY) => {
        const { camera } = get();

        const nextZoom = clamp(camera.zoom * factor, MIN_ZOOM, MAX_ZOOM);
        if (nextZoom === camera.zoom) return;

        const worldX = (screenX - camera.x) / camera.zoom;
        const worldY = (screenY - camera.y) / camera.zoom;

        const nextX = screenX - worldX * nextZoom;
        const nextY = screenY - worldY * nextZoom;

        set({ camera: { x: nextX, y: nextY, zoom: nextZoom } });
      },

      setZoomAt: (nextZoomRaw, screenX, screenY) => {
        const { camera } = get();

        const nextZoom = clamp(nextZoomRaw, MIN_ZOOM, MAX_ZOOM);
        if (nextZoom === camera.zoom) return;

        const worldX = (screenX - camera.x) / camera.zoom;
        const worldY = (screenY - camera.y) / camera.zoom;

        const nextX = screenX - worldX * nextZoom;
        const nextY = screenY - worldY * nextZoom;

        set({ camera: { x: nextX, y: nextY, zoom: nextZoom } });
      },

      setCameraXY: (x, y) => {
        const { camera } = get();
        set({ camera: { ...camera, x, y } });
      },

      resetCamera: () => {
        set({ camera: { x: 0, y: 0, zoom: 1 } });
      },

      isExporting: false,
      setIsExporting: (v) => set({ isExporting: v }),

      hiddenSchemas: {},
      setSchemaHidden: (schema, hidden) => {
        const { activeDiagramId: id, hiddenSchemas } = get();
        if (!id) return;
        const current = hiddenSchemas[id] ?? EMPTY_HIDDEN;
        if (current.includes(schema) === hidden) return;
        const next = hidden ? [...current, schema] : current.filter((k) => k !== schema);
        set({ hiddenSchemas: withHidden(hiddenSchemas, id, next) });
      },
      setHiddenSchemas: (schemas) => {
        const { activeDiagramId: id, hiddenSchemas } = get();
        if (!id) return;
        set({ hiddenSchemas: withHidden(hiddenSchemas, id, [...new Set(schemas)]) });
      },
      groupBy: {},
      setGroupBy: (source) => {
        const { activeDiagramId: id, groupBy } = get();
        if (!id || (groupBy[id] ?? "schema") === source) return;
        const next = { ...groupBy };
        if (source === "schema") delete next[id];
        else next[id] = source;
        set({ groupBy: next });
      },
      renameHiddenSchema: (from, to) => {
        const { activeDiagramId: id, hiddenSchemas } = get();
        if (!id) return;
        const current = hiddenSchemas[id] ?? EMPTY_HIDDEN;
        const next = renameInHiddenSet(current, from, to);
        if (next === current) return;
        set({ hiddenSchemas: withHidden(hiddenSchemas, id, next) });
      },
    }),
    {
      name: "editor-storage",
      // Debounced: panBy/zoomAt fire per pointermove; writing to storage
      // synchronously on each one causes pan jank.
      storage: createDebouncedStorage(500),
      onRehydrateStorage: () => (_state, error) => {
        if (error) console.error("Failed to rehydrate editor-storage:", error);
        useEditorStore.setState({ hasHydrated: true });
      },
      partialize: (state) => {
        const { activeDiagramId, cameras, camera, hiddenSchemas, groupBy } = state;
        const newCameras = { ...cameras };
        if (activeDiagramId) {
          newCameras[activeDiagramId] = camera;
        }
        // hasHydrated is intentionally NOT here — runtime-only.
        return { cameras: newCameras, hiddenSchemas, groupBy };
      },
    }
  )
);

/** The active diagram's hidden schema keys. Identity-stable while unchanged. */
export const useHiddenSchemas = (): readonly string[] =>
  useEditorStore((s) => s.hiddenSchemas[s.activeDiagramId ?? ""] ?? EMPTY_HIDDEN);

/** Non-reactive read of the same, for event handlers and imperative helpers. */
export function getHiddenSchemas(): readonly string[] {
  const { hiddenSchemas, activeDiagramId } = useEditorStore.getState();
  return hiddenSchemas[activeDiagramId ?? ""] ?? EMPTY_HIDDEN;
}

/** The active diagram's grouping source. */
export const useGroupSource = (): GroupSource =>
  useEditorStore((s) => s.groupBy[s.activeDiagramId ?? ""] ?? "schema");

/** Non-reactive read of the same. */
export function getGroupSource(): GroupSource {
  const { groupBy, activeDiagramId } = useEditorStore.getState();
  return groupBy[activeDiagramId ?? ""] ?? "schema";
}
