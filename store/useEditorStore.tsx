import { create } from "zustand";

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 3.0;

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

function clampCameraToWorld(params: {
  x: number;
  y: number;
  zoom: number;
  viewportW: number;
  viewportH: number;
  worldW: number;
  worldH: number;
  margin?: number;
}) {
  const { zoom, viewportW, viewportH, worldW, worldH } = params;
  const margin = params.margin ?? 0;

  const worldScreenW = worldW * zoom;
  const worldScreenH = worldH * zoom;

  let minX = viewportW - worldScreenW - margin;
  let maxX = margin;

  let minY = viewportH - worldScreenH - margin;
  let maxY = margin;

  // If world smaller than viewport, center it
  if (minX > maxX) {
    const c = (minX + maxX) / 2;
    minX = maxX = c;
  }
  if (minY > maxY) {
    const c = (minY + maxY) / 2;
    minY = maxY = c;
  }

  return {
    x: clamp(params.x, minX, maxX),
    y: clamp(params.y, minY, maxY),
  };
}

export type Camera = { x: number; y: number; zoom: number };

type EditorState = {
  camera: Camera;

  viewport: { w: number; h: number };
  setViewport: (w: number, h: number) => void;

  world: { w: number; h: number };
  setWorld: (w: number, h: number) => void;

  panBy: (dx: number, dy: number) => void;

  zoomAt: (factor: number, screenX: number, screenY: number) => void;
  setZoomAt: (nextZoom: number, screenX: number, screenY: number) => void;

  // ✅ for minimap or programmatic moves (always clamps)
  setCameraXY: (x: number, y: number) => void;

  resetCamera: () => void;
};

export const useEditorStore = create<EditorState>((set, get) => ({
  camera: { x: 0, y: 0, zoom: 1 },

  viewport: { w: 1, h: 1 },

  // ✅ default world; CanvasStage will override it via setWorld()
  world: { w: 6000, h: 6000 },

  setWorld: (w, h) => {
    const { camera, viewport } = get();
    const clamped = clampCameraToWorld({
      x: camera.x,
      y: camera.y,
      zoom: camera.zoom,
      viewportW: viewport.w,
      viewportH: viewport.h,
      worldW: w,
      worldH: h,
      margin: 0,
    });
    set({ world: { w, h }, camera: { ...camera, ...clamped } });
  },

  setViewport: (w, h) => {
    const { camera, world } = get();
    const clamped = clampCameraToWorld({
      x: camera.x,
      y: camera.y,
      zoom: camera.zoom,
      viewportW: w,
      viewportH: h,
      worldW: world.w,
      worldH: world.h,
      margin: 0,
    });
    set({ viewport: { w, h }, camera: { ...camera, ...clamped } });
  },

  panBy: (dx, dy) => {
    const { camera, viewport, world } = get();
    const next = { x: camera.x + dx, y: camera.y + dy };

    const clamped = clampCameraToWorld({
      x: next.x,
      y: next.y,
      zoom: camera.zoom,
      viewportW: viewport.w,
      viewportH: viewport.h,
      worldW: world.w,
      worldH: world.h,
      margin: 0,
    });

    set({ camera: { ...camera, ...clamped } });
  },

  zoomAt: (factor, screenX, screenY) => {
    const { camera, viewport, world } = get();

    const nextZoom = clamp(camera.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    if (nextZoom === camera.zoom) return;

    const worldX = (screenX - camera.x) / camera.zoom;
    const worldY = (screenY - camera.y) / camera.zoom;

    const nextX = screenX - worldX * nextZoom;
    const nextY = screenY - worldY * nextZoom;

    const clamped = clampCameraToWorld({
      x: nextX,
      y: nextY,
      zoom: nextZoom,
      viewportW: viewport.w,
      viewportH: viewport.h,
      worldW: world.w,
      worldH: world.h,
      margin: 0,
    });

    set({ camera: { ...clamped, zoom: nextZoom } });
  },

  setZoomAt: (nextZoomRaw, screenX, screenY) => {
    const { camera, viewport, world } = get();

    const nextZoom = clamp(nextZoomRaw, MIN_ZOOM, MAX_ZOOM);
    if (nextZoom === camera.zoom) return;

    const worldX = (screenX - camera.x) / camera.zoom;
    const worldY = (screenY - camera.y) / camera.zoom;

    const nextX = screenX - worldX * nextZoom;
    const nextY = screenY - worldY * nextZoom;

    const clamped = clampCameraToWorld({
      x: nextX,
      y: nextY,
      zoom: nextZoom,
      viewportW: viewport.w,
      viewportH: viewport.h,
      worldW: world.w,
      worldH: world.h,
      margin: 0,
    });

    set({ camera: { ...clamped, zoom: nextZoom } });
  },

  setCameraXY: (x, y) => {
    const { camera, viewport, world } = get();
    const clamped = clampCameraToWorld({
      x,
      y,
      zoom: camera.zoom,
      viewportW: viewport.w,
      viewportH: viewport.h,
      worldW: world.w,
      worldH: world.h,
      margin: 0,
    });
    set({ camera: { ...camera, ...clamped } });
  },

  resetCamera: () => {
    const { viewport, world } = get();
    const base = { x: 0, y: 0, zoom: 1 };

    const clamped = clampCameraToWorld({
      x: base.x,
      y: base.y,
      zoom: base.zoom,
      viewportW: viewport.w,
      viewportH: viewport.h,
      worldW: world.w,
      worldH: world.h,
      margin: 0,
    });

    set({ camera: { ...base, ...clamped } });
  },
}));
