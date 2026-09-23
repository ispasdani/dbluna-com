import { describe, it, expect } from "vitest";
import {
  affordableDim,
  applyHighlight,
  computeHighlight,
  createHoverStore,
  MAX_ANIMATED_LIT,
  MAX_DIMMED_RELS,
  type HoverState,
} from "@/components/diagram-sections/canvas/hover-highlight";
import type { Relationship } from "@/store/useCanvasStore";

const rel = (id: string, s: string, sc: string, t: string, tc: string): Relationship => ({
  id,
  name: id,
  sourceTableId: s,
  sourceColumnId: sc,
  targetTableId: t,
  targetColumnId: tc,
  cardinality: "Many to one",
  onUpdate: "No action",
  onDelete: "No action",
});

// users.id <- orders.user_id, and products.id <- line_items.product_id
const RELS = [
  rel("r1", "orders", "user_id", "users", "id"),
  rel("r2", "line_items", "product_id", "products", "id"),
];

const hovering = (tableId: string, colId: string | null): HoverState => ({
  table: { tableId, colId },
  relId: null,
});

describe("computeHighlight", () => {
  it("lights only the relationships touching the hovered table", () => {
    const h = computeHighlight(hovering("users", null), RELS, [], null, false);

    expect([...h.litRels]).toEqual(["r1"]);
    expect(h.brightTables).toEqual(new Set(["orders", "users"]));
    expect(h.linkedRows).toEqual(new Set(["orders|user_id", "users|id"]));
    expect(h.hoverActive).toBe(true);
  });

  it("narrows to a single row when the pointer is on one", () => {
    expect([...computeHighlight(hovering("users", "id"), RELS, [], null, false).litRels]).toEqual(["r1"]);
    // A column that no relationship uses lights nothing.
    expect([...computeHighlight(hovering("users", "email"), RELS, [], null, false).litRels]).toEqual([]);
  });

  it("keeps a hovered table bright even with nothing connected to it", () => {
    const h = computeHighlight(hovering("audit_log", null), RELS, [], null, false);
    expect(h.litRels.size).toBe(0);
    expect(h.brightTables).toEqual(new Set(["audit_log"]));
  });

  it("lights selection too, but selection alone never counts as hovering", () => {
    const h = computeHighlight({ table: null, relId: null }, RELS, ["products"], null, false);
    expect([...h.litRels]).toEqual(["r2"]);
    // hoverActive drives the dimming — selecting a table must not fade the canvas.
    expect(h.hoverActive).toBe(false);
  });

  it("lights a hovered line and its two endpoints", () => {
    const h = computeHighlight({ table: null, relId: "r2" }, RELS, [], null, false);
    expect([...h.litRels]).toEqual(["r2"]);
    expect(h.brightTables).toEqual(new Set(["line_items", "products"]));
    expect(h.hoverActive).toBe(true);
  });

  it("goes blank while exporting, so a stray pointer can't bake a highlight into the file", () => {
    const h = computeHighlight(hovering("users", null), RELS, ["products"], "r1", true);
    expect(h.litRels.size).toBe(0);
    expect(h.brightTables.size).toBe(0);
    expect(h.hoverActive).toBe(false);
  });
});

describe("createHoverStore", () => {
  it("notifies on a real change and stays quiet on a repeat", () => {
    const store = createHoverStore();
    let calls = 0;
    store.subscribe(() => calls++);

    store.setTable("users", "id");
    expect(calls).toBe(1);
    store.setTable("users", "id");
    expect(calls).toBe(1);

    store.setTable("users", null);
    expect(calls).toBe(2);
    expect(store.get().table).toEqual({ tableId: "users", colId: null });
  });

  it("only clears the table the pointer actually left", () => {
    const store = createHoverStore();
    store.setTable("users", "id");

    // A leave event for some other card must not wipe the current hover —
    // pointerleave/enter pairs can arrive out of order across sibling nodes.
    store.setTable("orders", undefined);
    expect(store.get().table).toEqual({ tableId: "users", colId: "id" });

    store.setTable("users", undefined);
    expect(store.get().table).toBeNull();
  });

  it("tracks line hover independently of table hover", () => {
    const store = createHoverStore();
    store.setTable("users", null);
    store.setRelationship("r1");
    expect(store.get()).toEqual({ table: { tableId: "users", colId: null }, relId: "r1" });

    store.clear();
    expect(store.get()).toEqual({ table: null, relId: null });
  });
});

// The stylesheet gives every lit line its own compositor layer so its dash
// animation stops repainting the whole world `<svg>`. That trade only pays off
// while the lit set is small, so `applyHighlight` flags the runaway case and the
// stylesheet drops the motion. No jsdom in this project — a stub covering the
// four DOM calls applyHighlight makes is enough to exercise the real path.
function stubSvg() {
  const attrs = new Map<string, string>();
  return {
    attrs,
    setAttribute: (k: string, v: string) => void attrs.set(k, v),
    hasAttribute: (k: string) => attrs.has(k),
    removeAttribute: (k: string) => void attrs.delete(k),
    querySelectorAll: () => [] as Element[],
  };
}

/** `n` relationships, every one of them touching `hub`. */
function hubRels(n: number) {
  return Array.from({ length: n }, (_, i) => rel(`r${i}`, `t${i}`, "hub_id", "hub", "id"));
}

function litStormFor(n: number) {
  const svg = stubSvg();
  const hover: HoverState = { table: { tableId: "hub", colId: null }, relId: null };
  const h = computeHighlight(hover, hubRels(n), [], null, false);
  expect(h.litRels.size).toBe(n);
  applyHighlight(svg as unknown as SVGSVGElement, h, "lines");
  return svg.attrs.has("data-lit-storm");
}

describe("applyHighlight — animation ceiling", () => {
  it("leaves the motion alone while the lit set is small", () => {
    expect(litStormFor(MAX_ANIMATED_LIT)).toBe(false);
  });

  it("flags a hub table that lights up more lines than we can afford layers for", () => {
    expect(litStormFor(MAX_ANIMATED_LIT + 1)).toBe(true);
  });

  it("clears the flag when the pointer moves to a quieter table", () => {
    const svg = stubSvg();
    const rels = hubRels(MAX_ANIMATED_LIT + 5);
    const onHub: HoverState = { table: { tableId: "hub", colId: null }, relId: null };
    applyHighlight(svg as unknown as SVGSVGElement, computeHighlight(onHub, rels, [], null, false), "lines");
    expect(svg.attrs.has("data-lit-storm")).toBe(true);

    // `t0` sits at the far end of exactly one of those relationships.
    const onLeaf: HoverState = { table: { tableId: "t0", colId: null }, relId: null };
    applyHighlight(svg as unknown as SVGSVGElement, computeHighlight(onLeaf, rels, [], null, false), "lines");
    expect(svg.attrs.has("data-lit-storm")).toBe(false);
  });

  it("never flags an export, which has no pointer and no animation", () => {
    const svg = stubSvg();
    const hover: HoverState = { table: { tableId: "hub", colId: null }, relId: null };
    const h = computeHighlight(hover, hubRels(200), [], null, true);
    applyHighlight(svg as unknown as SVGSVGElement, h, "lines");
    expect(svg.attrs.has("data-lit-storm")).toBe(false);
  });
});

describe("affordableDim", () => {
  it("keeps the style's dim on a diagram small enough to repaint cheaply", () => {
    expect(affordableDim("lines", 40)).toBe("lines");
    expect(affordableDim("all", MAX_DIMMED_RELS)).toBe("all");
  });

  it("drops the dim once there are more lines than a hover can repaint", () => {
    expect(affordableDim("lines", MAX_DIMMED_RELS + 1)).toBe("off");
    expect(affordableDim("all", 600)).toBe("off");
  });

  it("leaves a style that already asked for no dimming alone", () => {
    expect(affordableDim("off", 10)).toBe("off");
    expect(affordableDim("off", 600)).toBe("off");
  });
});
