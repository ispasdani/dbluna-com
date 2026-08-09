import type { Area, Note, Table } from "@/store/useCanvasStore";

const SVG_NS = "http://www.w3.org/2000/svg";
const TABLE_WIDTH = 220;
const TABLE_HEADER_HEIGHT = 36;
const TABLE_ROW_HEIGHT = 30;

export interface DiagramBounds {
    x: number;
    y: number;
    w: number;
    h: number;
}

// Tight bounding box around every table/note/area on the canvas, with a
// small margin — used to crop the exported image/SVG to just the content
// instead of the (unbounded) infinite canvas.
export function computeDiagramBounds(
    tables: Table[],
    notes: Note[],
    areas: Area[]
): DiagramBounds {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    const expand = (x: number, y: number, w: number, h: number) => {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x + w > maxX) maxX = x + w;
        if (y + h > maxY) maxY = y + h;
    };

    tables.forEach((t) =>
        expand(t.x, t.y, TABLE_WIDTH, TABLE_HEADER_HEIGHT + t.columns.length * TABLE_ROW_HEIGHT)
    );
    notes.forEach((n) => expand(n.x, n.y, n.width, n.height));
    areas.forEach((a) => expand(a.x, a.y, a.width, a.height));

    if (!Number.isFinite(minX)) {
        // Empty diagram — fall back to a small placeholder box.
        return { x: 0, y: 0, w: 400, h: 300 };
    }

    const padding = 48;
    return {
        x: minX - padding,
        y: minY - padding,
        w: maxX - minX + padding * 2,
        h: maxY - minY + padding * 2,
    };
}

// CSS properties that commonly carry theme colors (var(--...)) in the
// diagram SVG. Inlining their *computed* (already resolved) value onto the
// clone means the exported file renders correctly even with no app
// stylesheet or CSS variables available — e.g. opened directly in an image
// viewer or another browser tab.
const COLOR_PROPS = [
    "fill",
    "stroke",
    "color",
    "stopColor",
    "floodColor",
    "backgroundColor",
    "borderColor",
] as const;

function inlineComputedColors(source: Element, clone: Element) {
    const computed = window.getComputedStyle(source);
    const style = (clone as HTMLElement | SVGElement).style;
    for (const prop of COLOR_PROPS) {
        const value = computed.getPropertyValue(prop as string);
        if (value) style.setProperty(prop as string, value);
    }

    const sourceChildren = Array.from(source.children);
    const cloneChildren = Array.from(clone.children);
    for (let i = 0; i < sourceChildren.length; i++) {
        inlineComputedColors(sourceChildren[i], cloneChildren[i]);
    }
}

// Finds the live diagram SVG (see canvas.tsx's data-diagram-canvas-svg
// attribute) and produces a standalone, self-contained SVG string cropped
// to the diagram content — theme colors baked in as literal values.
export function serializeCanvasSvg(bounds: DiagramBounds): string | null {
    const source = document.querySelector<SVGSVGElement>("[data-diagram-canvas-svg]");
    if (!source) return null;

    const clone = source.cloneNode(true) as SVGSVGElement;
    inlineComputedColors(source, clone);

    const bg = window.getComputedStyle(document.body).getPropertyValue("background-color") || "#ffffff";

    clone.setAttribute("xmlns", SVG_NS);
    clone.removeAttribute("class");
    clone.setAttribute("width", String(Math.round(bounds.w)));
    clone.setAttribute("height", String(Math.round(bounds.h)));
    clone.setAttribute("viewBox", `${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`);

    const bgRect = document.createElementNS(SVG_NS, "rect");
    bgRect.setAttribute("x", String(bounds.x));
    bgRect.setAttribute("y", String(bounds.y));
    bgRect.setAttribute("width", String(bounds.w));
    bgRect.setAttribute("height", String(bounds.h));
    bgRect.setAttribute("fill", bg);
    clone.insertBefore(bgRect, clone.firstChild);

    return new XMLSerializer().serializeToString(clone);
}

// Rasterizes the serialized SVG to a PNG blob at the given device-pixel
// scale (2x by default for a crisp, retina-quality export).
export function renderSvgToPngBlob(svgString: string, bounds: DiagramBounds, scale = 2): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);

        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(bounds.w * scale);
            canvas.height = Math.round(bounds.h * scale);
            const ctx = canvas.getContext("2d");
            if (!ctx) {
                URL.revokeObjectURL(url);
                reject(new Error("Canvas 2D context unavailable"));
                return;
            }
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error("Failed to rasterize diagram"));
            }, "image/png");
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Failed to load diagram SVG for rasterization"));
        };
        img.src = url;
    });
}
