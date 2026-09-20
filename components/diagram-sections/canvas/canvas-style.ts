/**
 * Canvas visual styles — the four looks users can switch between from the
 * toolbar, plus the table geometry and relationship routing they share.
 *
 * Everything that needs to know where a table's rows sit (relationship
 * endpoints, marquee hit-testing, export bounds, AI placement) must read the
 * geometry from here, so the drawn card and the maths can never drift apart.
 */

export type TableVariant = "soft" | "chips" | "dense" | "header";
export type LineRouting = "rounded" | "sharp" | "bezier";
export type LineEnds = "crow" | "labels";
/** neutral = grey at rest, accent when active; source = source table's colour. */
export type LineColorMode = "neutral" | "primary" | "source" | "gradient";
export type LineMotion = "none" | "flow" | "pulse" | "glow";
export type HandleShape = "dot" | "tab" | "plus" | "notch";
export type HandleVisibility = "row" | "table";
/** What fades while something is hovered: nothing, other lines, or lines + tables. */
export type HoverDim = "off" | "lines" | "all";

export type CanvasStyleId = "recommended" | "expressive" | "compact" | "bold";

export interface CanvasStyle {
  id: CanvasStyleId;
  label: string;
  description: string;
  table: TableVariant;
  routing: LineRouting;
  ends: LineEnds;
  color: LineColorMode;
  motion: LineMotion;
  handles: HandleShape;
  handleVisibility: HandleVisibility;
  dim: HoverDim;
}

export const CANVAS_STYLES: Record<CanvasStyleId, CanvasStyle> = {
  recommended: {
    id: "recommended",
    label: "Recommended",
    description: "Soft cards, quiet lines that light up on hover",
    table: "soft",
    routing: "rounded",
    ends: "crow",
    color: "neutral",
    motion: "flow",
    handles: "dot",
    handleVisibility: "row",
    dim: "lines",
  },
  expressive: {
    id: "expressive",
    label: "Expressive",
    description: "Type chips, curved gradient lines, 1 / N labels",
    table: "chips",
    routing: "bezier",
    ends: "labels",
    color: "gradient",
    motion: "pulse",
    handles: "plus",
    handleVisibility: "row",
    dim: "lines",
  },
  compact: {
    id: "compact",
    label: "Compact",
    description: "Dense rows, square lines, fits the most tables",
    table: "dense",
    routing: "sharp",
    ends: "crow",
    color: "primary",
    motion: "none",
    handles: "notch",
    handleVisibility: "row",
    dim: "off",
  },
  bold: {
    id: "bold",
    label: "Bold",
    description: "Colour headers, lines in each table's colour",
    table: "header",
    routing: "rounded",
    ends: "labels",
    color: "source",
    motion: "glow",
    handles: "tab",
    handleVisibility: "table",
    dim: "all",
  },
};

export const CANVAS_STYLE_ORDER: CanvasStyleId[] = ["recommended", "expressive", "compact", "bold"];
export const DEFAULT_CANVAS_STYLE: CanvasStyleId = "recommended";

export function isCanvasStyleId(v: unknown): v is CanvasStyleId {
  return typeof v === "string" && v in CANVAS_STYLES;
}

// ─── Table geometry ──────────────────────────────────────────────────────────

export interface TableGeometry {
  width: number;
  headerHeight: number;
  rowHeight: number;
  /** Space between the header divider and the first row. */
  padTop: number;
  /** Space below the last row. */
  padBottom: number;
  radius: number;
  /** Horizontal inset of the row hover highlight (0 = full-bleed). */
  rowInset: number;
  rowRadius: number;
}

export const TABLE_GEOMETRY: Record<TableVariant, TableGeometry> = {
  soft:   { width: 240, headerHeight: 42, rowHeight: 30, padTop: 4, padBottom: 5, radius: 10, rowInset: 5, rowRadius: 6 },
  header: { width: 240, headerHeight: 40, rowHeight: 30, padTop: 0, padBottom: 0, radius: 10, rowInset: 0, rowRadius: 0 },
  dense:  { width: 236, headerHeight: 34, rowHeight: 26, padTop: 0, padBottom: 0, radius: 6,  rowInset: 0, rowRadius: 0 },
  chips:  { width: 256, headerHeight: 46, rowHeight: 32, padTop: 4, padBottom: 6, radius: 12, rowInset: 6, rowRadius: 8 },
};

export function tableHeight(g: TableGeometry, columnCount: number): number {
  return g.headerHeight + g.padTop + columnCount * g.rowHeight + g.padBottom;
}

/** Top of row `index`, relative to the table's origin. */
export function rowTopY(g: TableGeometry, index: number): number {
  return g.headerHeight + g.padTop + index * g.rowHeight;
}

/** Vertical centre of row `index`, relative to the table's origin. */
export function rowCenterY(g: TableGeometry, index: number): number {
  return rowTopY(g, index) + g.rowHeight / 2;
}

// ─── Relationship routing ────────────────────────────────────────────────────

/** Which edge a line leaves from: 1 = right, -1 = left. */
export type Side = 1 | -1;

export interface PortPoint {
  x: number;
  y: number;
  d: Side;
}

/** Straight run out of each edge before the first bend; line-end markers sit on it. */
export const LINE_STUB = 30;

/**
 * Facing edges when the tables sit side by side, one shared edge when they
 * overlap horizontally (stacked) — so a line never loops back behind a card.
 */
export function pickSides(ax: number, bx: number, width: number): [Side, Side] {
  const gap = 40;
  if (ax + width + gap <= bx) return [1, -1];
  if (bx + width + gap <= ax) return [-1, 1];
  return ax >= bx ? [1, 1] : [-1, -1];
}

type Pt = [number, number];

function orthogonalPoints(a: PortPoint, b: PortPoint): Pt[] {
  const ax = a.x + a.d * LINE_STUB;
  const bx = b.x + b.d * LINE_STUB;
  if (a.d !== b.d) {
    const facing = a.d === 1 ? ax <= bx : ax >= bx;
    if (facing) {
      const mx = (ax + bx) / 2;
      return [[a.x, a.y], [mx, a.y], [mx, b.y], [b.x, b.y]];
    }
    const my = (a.y + b.y) / 2;
    return [[a.x, a.y], [ax, a.y], [ax, my], [bx, my], [bx, b.y], [b.x, b.y]];
  }
  const rx = a.d === 1 ? Math.max(ax, bx) : Math.min(ax, bx);
  return [[a.x, a.y], [rx, a.y], [rx, b.y], [b.x, b.y]];
}

function simplify(pts: Pt[]): Pt[] {
  const dedup: Pt[] = [];
  for (const p of pts) {
    const l = dedup[dedup.length - 1];
    if (!l || Math.abs(l[0] - p[0]) > 0.01 || Math.abs(l[1] - p[1]) > 0.01) dedup.push(p);
  }
  if (dedup.length < 3) return dedup;
  const out: Pt[] = [dedup[0]];
  for (let i = 1; i < dedup.length - 1; i++) {
    const a = out[out.length - 1], b = dedup[i], c = dedup[i + 1];
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(cross) > 0.01) out.push(b);
  }
  out.push(dedup[dedup.length - 1]);
  return out;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function roundedPolyline(pts: Pt[], radius: number): string {
  let d = `M${r2(pts[0][0])} ${r2(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    const l1 = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const l2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const r = Math.min(radius, l1 / 2, l2 / 2);
    if (r < 0.5) {
      d += `L${r2(b[0])} ${r2(b[1])}`;
      continue;
    }
    const p1x = b[0] - ((b[0] - a[0]) / l1) * r, p1y = b[1] - ((b[1] - a[1]) / l1) * r;
    const p2x = b[0] + ((c[0] - b[0]) / l2) * r, p2y = b[1] + ((c[1] - b[1]) / l2) * r;
    d += `L${r2(p1x)} ${r2(p1y)}Q${r2(b[0])} ${r2(b[1])} ${r2(p2x)} ${r2(p2y)}`;
  }
  const z = pts[pts.length - 1];
  if (pts.length > 1) d += `L${r2(z[0])} ${r2(z[1])}`;
  return d;
}

function polylineMidpoint(pts: Pt[]): { x: number; y: number } {
  const lens: number[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    lens.push(l);
    total += l;
  }
  let remaining = total / 2;
  for (let i = 1; i < pts.length; i++) {
    const l = lens[i - 1];
    if (remaining <= l && l > 0) {
      const t = remaining / l;
      return {
        x: pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t,
        y: pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t,
      };
    }
    remaining -= l;
  }
  return { x: pts[0][0], y: pts[0][1] };
}

export interface RoutedPath {
  d: string;
  /** Point halfway along the line — where the hover label sits. */
  mid: { x: number; y: number };
}

export function routeRelationship(routing: LineRouting, a: PortPoint, b: PortPoint): RoutedPath {
  if (routing === "bezier") {
    const dx = Math.abs(b.x - a.x);
    const k = a.d === b.d ? Math.max(90, dx * 0.5 + 60) : Math.max(56, dx * 0.5);
    const c1x = a.x + a.d * k, c2x = b.x + b.d * k;
    return {
      d: `M${r2(a.x)} ${r2(a.y)}C${r2(c1x)} ${r2(a.y)} ${r2(c2x)} ${r2(b.y)} ${r2(b.x)} ${r2(b.y)}`,
      // Cubic Bézier at t = 0.5.
      mid: { x: (a.x + 3 * c1x + 3 * c2x + b.x) / 8, y: (a.y + b.y) / 2 },
    };
  }
  const pts = simplify(orthogonalPoints(a, b));
  return { d: roundedPolyline(pts, routing === "sharp" ? 0 : 12), mid: polylineMidpoint(pts) };
}

// ─── Level of detail ─────────────────────────────────────────────────────────

/**
 * How much of a table card is worth drawing at the current zoom.
 *
 * A 400-table schema zoomed out to fit puts every card on screen at once, and
 * viewport culling can't help — they really are all visible. At full detail
 * that is ~80 SVG nodes per table (rows, icons, two text runs, two handles) plus
 * a `<foreignObject>` for the header buttons, so the world layer grows past
 * what the compositor can rasterise inside a frame and pans show blank tiles.
 *
 * Below the thresholds the dropped detail is sub-pixel anyway: at zoom 0.5 a
 * 12.75px column label renders at ~6px, at 0.2 the 13.5px table name renders at
 * under 3px. Drawing it costs everything and shows nothing.
 */
export type TableLod = "full" | "compact" | "block";

/** Zoom at or above which cards draw their rows, handles and buttons. */
export const LOD_FULL_ZOOM = 0.5;
/**
 * Zoom at or above which cards still draw their name; below it, plain blocks.
 *
 * Set by measurement rather than taste: below this the canvas is text-free,
 * which is what lets the world layer be GPU-composited (see `willChange` in
 * canvas.tsx). At 0.26 the old threshold still drew two text runs per card for
 * ~290 cards and panning ran at 31fps; as plain blocks the same view holds
 * ~145fps. A 13.5px name renders at under 5px here, so nothing legible is lost.
 */
export const LOD_COMPACT_ZOOM = 0.35;

export function tableLodForZoom(zoom: number): TableLod {
  if (zoom >= LOD_FULL_ZOOM) return "full";
  if (zoom >= LOD_COMPACT_ZOOM) return "compact";
  return "block";
}
