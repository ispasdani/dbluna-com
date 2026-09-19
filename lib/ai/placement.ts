import type { Area, Table } from "@/store/useCanvasStore";
import { getTableGeometry } from "@/store/useCanvasStyleStore";
import { tableHeight } from "@/components/diagram-sections/canvas/canvas-style";

// Table size comes from the active canvas style (see canvas-style.ts) so
// bounding boxes here match what is actually drawn on canvas.
const MARGIN = 60;

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

function tableBounds(t: Table): Bounds {
  return {
    x: t.x,
    y: t.y,
    width: getTableGeometry().width,
    height: tableHeight(getTableGeometry(), t.columns.length),
  };
}

function areaBounds(a: Area): Bounds {
  return { x: a.x, y: a.y, width: a.width, height: a.height };
}

function overlaps(a: Bounds, b: Bounds, pad = 20): boolean {
  return (
    a.x < b.x + b.width + pad &&
    a.x + a.width + pad > b.x &&
    a.y < b.y + b.height + pad &&
    a.y + a.height + pad > b.y
  );
}

export interface FindFreePositionOptions {
  /** Bias the search to start near this point (e.g. a related table's or area's position). */
  near?: { x: number; y: number };
  width?: number;
  height?: number;
}

/**
 * Scans existing table/area bounding boxes and returns the nearest free grid
 * slot to `options.near` (or the origin) that doesn't overlap anything.
 * layoutAndImport's dagre pass only avoids overlap *within* a newly-added
 * batch — this covers placement against everything already on the canvas.
 */
export function findFreePosition(
  existingTables: Table[],
  existingAreas: Area[],
  options: FindFreePositionOptions = {}
): { x: number; y: number } {
  const geo = getTableGeometry();
  const width = options.width ?? geo.width;
  const height = options.height ?? tableHeight(geo, 3);
  const gridStep = geo.width + MARGIN;
  const originX = options.near?.x ?? 0;
  const originY = options.near?.y ?? 0;

  const obstacles: Bounds[] = [
    ...existingTables.map(tableBounds),
    ...existingAreas.map(areaBounds),
  ];

  for (let ring = 0; ring < 40; ring++) {
    const positions: { x: number; y: number }[] = [];
    if (ring === 0) {
      positions.push({ x: originX, y: originY });
    } else {
      for (let dx = -ring; dx <= ring; dx++) {
        positions.push({ x: originX + dx * gridStep, y: originY - ring * gridStep });
        positions.push({ x: originX + dx * gridStep, y: originY + ring * gridStep });
      }
      for (let dy = -ring + 1; dy <= ring - 1; dy++) {
        positions.push({ x: originX - ring * gridStep, y: originY + dy * gridStep });
        positions.push({ x: originX + ring * gridStep, y: originY + dy * gridStep });
      }
    }
    for (const pos of positions) {
      const box: Bounds = { x: pos.x, y: pos.y, width, height };
      if (!obstacles.some((o) => overlaps(box, o))) {
        return pos;
      }
    }
  }

  const maxY = obstacles.reduce((m, o) => Math.max(m, o.y + o.height), 0);
  return { x: originX, y: maxY + MARGIN };
}
