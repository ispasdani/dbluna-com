import { create } from "zustand";

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 3.0;

export type Camera = {
  x: number; // screen-space translation
  y: number;
  zoom: number;
};

type EditorState = {
  camera: Camera;
  // actions
  panBy: (dx: number, dy: number) => void;
  zoomAt: (factor: number, screenX: number, screenY: number) => void;
  setZoomAt: (nextZoom: number, screenX: number, screenY: number) => void;
  resetCamera: () => void;

  // add in store
  viewport: { w: number; h: number };
  setViewport: (w: number, h: number) => void;
};

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

export const useEditorStore = create<EditorState>((set, get) => ({
  camera: {
    x: 0,
    y: 0,
    zoom: 1,
  },

  /**
   * Pan in screen space (pixels)
   */
  panBy: (dx, dy) => {
    set((state) => ({
      camera: {
        ...state.camera,
        x: state.camera.x + dx,
        y: state.camera.y + dy,
      },
    }));
  },

  /**
   * Zoom relative to a screen-space point (mouse position)
   *
   * screen = world * zoom + translation
   * world = (screen - translation) / zoom
   */
  zoomAt: (factor, screenX, screenY) => {
    const { camera } = get();

    const nextZoom = clamp(camera.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    if (nextZoom === camera.zoom) return;

    // World position under cursor BEFORE zoom
    const worldX = (screenX - camera.x) / camera.zoom;
    const worldY = (screenY - camera.y) / camera.zoom;

    // New translation so that world point stays under cursor
    const nextX = screenX - worldX * nextZoom;
    const nextY = screenY - worldY * nextZoom;

    set({
      camera: {
        x: nextX,
        y: nextY,
        zoom: nextZoom,
      },
    });
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

  resetCamera: () => {
    set({
      camera: {
        x: 0,
        y: 0,
        zoom: 1,
      },
    });
  },

  // inside create(...)
  viewport: { w: 1, h: 1 },
  setViewport: (w, h) => set({ viewport: { w, h } }),
}));
