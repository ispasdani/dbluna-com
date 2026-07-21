import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createDebouncedStorage } from "./debounced-storage";

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 3.0;

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));


export type Camera = { x: number; y: number; zoom: number };

type EditorState = {
  hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
  activeDiagramId: string | null;
  cameras: Record<string, Camera>;
  setEditorDiagramId: (id: string) => void;
  camera: Camera;

  viewport: { w: number; h: number };
  setViewport: (w: number, h: number) => void;

  panBy: (dx: number, dy: number) => void;

  zoomAt: (factor: number, screenX: number, screenY: number) => void;
  setZoomAt: (nextZoom: number, screenX: number, screenY: number) => void;

  // ✅ for minimap or programmatic moves (always clamps)
  setCameraXY: (x: number, y: number) => void;

  resetCamera: () => void;
};

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
        const { activeDiagramId, cameras, camera } = state;
        const newCameras = { ...cameras };
        if (activeDiagramId) {
          newCameras[activeDiagramId] = camera;
        }
        // hasHydrated is intentionally NOT here — runtime-only.
        return { cameras: newCameras };
      },
    }
  )
);
