/**
 * Pixel-accurate text measurement for SVG canvas nodes.
 *
 * Deliberately does NOT use SVG's getComputedTextLength()/getBBox(): those force
 * a synchronous layout on every call, which would stall panning/zooming once a
 * diagram has a few hundred tables. An offscreen 2D context measures the same
 * glyphs without touching the live DOM, and every result is memoised by
 * `${font}|${text}`, so re-renders during drag/zoom cost a Map lookup.
 */

export interface TruncatedText {
  /** Text as it should be drawn (with an ellipsis appended when shortened). */
  text: string;
  /** True when characters were dropped — the caller should offer the full value. */
  truncated: boolean;
}

const ELLIPSIS = "…";

/** Guards against unbounded growth on diagrams with very many distinct labels. */
const CACHE_LIMIT = 20_000;

const widthCache = new Map<string, number>();
const truncateCache = new Map<string, TruncatedText>();

let measureCtx: CanvasRenderingContext2D | null | undefined;

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (measureCtx !== undefined) return measureCtx;
  measureCtx =
    typeof document === "undefined"
      ? null
      : document.createElement("canvas").getContext("2d");
  return measureCtx;
}

/** Rough per-character fallback used during SSR, where there is no canvas. */
function estimateWidth(text: string, font: string): number {
  const size = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 13);
  return text.length * size * 0.55;
}

export function measureTextWidth(text: string, font: string): number {
  if (!text) return 0;

  const key = `${font}|${text}`;
  const cached = widthCache.get(key);
  if (cached !== undefined) return cached;

  const ctx = getMeasureContext();
  let width: number;
  if (ctx) {
    ctx.font = font;
    width = ctx.measureText(text).width;
  } else {
    width = estimateWidth(text, font);
  }

  if (widthCache.size >= CACHE_LIMIT) widthCache.clear();
  widthCache.set(key, width);
  return width;
}

/**
 * Shortens `text` so it fits within `maxWidth` pixels when rendered in `font`,
 * appending an ellipsis. Returns the original string untouched when it already
 * fits, so the common (short name) case adds no visible change.
 */
export function truncateTextToWidth(
  text: string,
  font: string,
  maxWidth: number
): TruncatedText {
  if (!text) return { text, truncated: false };

  const key = `${font}|${Math.round(maxWidth)}|${text}`;
  const cached = truncateCache.get(key);
  if (cached) return cached;

  let result: TruncatedText;

  if (measureTextWidth(text, font) <= maxWidth) {
    result = { text, truncated: false };
  } else if (maxWidth <= measureTextWidth(ELLIPSIS, font)) {
    result = { text: "", truncated: true };
  } else {
    // Binary search the longest prefix that still fits alongside the ellipsis.
    let low = 0;
    let high = text.length;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (measureTextWidth(text.slice(0, mid) + ELLIPSIS, font) <= maxWidth) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }
    result = { text: text.slice(0, low).trimEnd() + ELLIPSIS, truncated: true };
  }

  if (truncateCache.size >= CACHE_LIMIT) truncateCache.clear();
  truncateCache.set(key, result);
  return result;
}

/**
 * Resolves the font stack the canvas <text> elements actually inherit from the
 * document, so measurements use the same glyphs the browser will draw. Read
 * once and cached — getComputedStyle is a layout read we do not want per node.
 */
let inheritedFamily: string | undefined;

export function getCanvasFontFamily(): string {
  if (inheritedFamily !== undefined) return inheritedFamily;
  inheritedFamily =
    typeof document === "undefined"
      ? "sans-serif"
      : getComputedStyle(document.body).fontFamily || "sans-serif";
  return inheritedFamily;
}

/* --------------------------------------------------------------------------
 * Web-font readiness
 *
 * Until next/font finishes loading, measurements reflect the fallback face and
 * can be a few pixels off. Rather than re-measure on every render, nodes
 * subscribe to this one-shot store: when the fonts settle the caches are
 * dropped and every node re-renders exactly once with accurate widths.
 * ------------------------------------------------------------------------ */

let fontsReady = typeof document === "undefined";
const fontsReadyListeners = new Set<() => void>();

export function subscribeFontsReady(listener: () => void): () => void {
  if (!fontsReady && typeof document !== "undefined") {
    if (fontsReadyListeners.size === 0) {
      const settle = () => {
        fontsReady = true;
        inheritedFamily = undefined;
        widthCache.clear();
        truncateCache.clear();
        fontsReadyListeners.forEach((l) => l());
      };
      // `document.fonts` is absent in a few older/embedded engines.
      if (document.fonts?.ready) void document.fonts.ready.then(settle);
      else settle();
    }
    fontsReadyListeners.add(listener);
  }
  return () => fontsReadyListeners.delete(listener);
}

export function getFontsReadySnapshot(): boolean {
  return fontsReady;
}

export function getFontsReadyServerSnapshot(): boolean {
  return true;
}
