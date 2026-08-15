import type { Area, Table } from "@/store/useCanvasStore";

// Mirrors table-node.tsx's render constants so bounding boxes here match
// what's actually drawn on canvas.
const TABLE_WIDTH = 220;
const HEADER_HEIGHT = 36;
const ROW_HEIGHT = 30;
const MARGIN = 60;
const GRID_STEP = TABLE_WIDTH + MARGIN;

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
    width: TABLE_WIDTH,
    height: HEADER_HEIGHT + t.columns.length * ROW_HEIGHT,
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
  const width = options.width ?? TABLE_WIDTH;
  const height = options.height ?? HEADER_HEIGHT + 3 * ROW_HEIGHT;
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
        positions.push({ x: originX + dx * GRID_STEP, y: originY - ring * GRID_STEP });
        positions.push({ x: originX + dx * GRID_STEP, y: originY + ring * GRID_STEP });
      }
      for (let dy = -ring + 1; dy <= ring - 1; dy++) {
        positions.push({ x: originX - ring * GRID_STEP, y: originY + dy * GRID_STEP });
        positions.push({ x: originX + ring * GRID_STEP, y: originY + dy * GRID_STEP });
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
