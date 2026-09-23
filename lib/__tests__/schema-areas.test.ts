import { describe, expect, it } from "vitest";

import { arrangeLayout, type SchemaBlock, type Size } from "@/lib/auto-arrange";
import {
  isSchemaArea,
  restoreSchemaAreas,
  sameAreas,
  schemaAreaId,
  schemaAreasAfterArrange,
} from "@/lib/schema-areas";
import type { Area, Relationship, Table } from "@/store/useCanvasStore";

const WIDTH = 240;
const HEIGHT = 150;
const measure = (): Size => ({ width: WIDTH, height: HEIGHT });

const table = (name: string, overrides: Partial<Table> = {}): Table => ({
  id: name,
  name,
  x: 0,
  y: 0,
  color: "#4f46e5",
  columns: [],
  ...overrides,
});

const block = (schema: string | null, x = 0, y = 0): SchemaBlock => ({ schema, x, y, width: 500, height: 300 });

const userArea: Area = {
  id: "user-1",
  x: 1,
  y: 2,
  width: 3,
  height: 4,
  title: "Mine",
  color: "#000",
  isLocked: false,
  zIndex: 1,
};

describe("arrangeLayout schema blocks", () => {
  const tables = [table("auth.users"), table("auth.sessions"), table("billing.invoices"), table("loose")];
  const rels: Relationship[] = [];

  it("reports one block per schema that encloses exactly its tables", () => {
    const { moves, schemaBlocks } = arrangeLayout({ tables, relationships: rels, mode: "schema", measure });
    expect(schemaBlocks.map((b) => b.schema)).toEqual(["auth", "billing", null]);

    const pos = new Map(moves.map((m) => [m.id, m]));
    for (const b of schemaBlocks) {
      const members = tables.filter((t) => (b.schema === null ? !t.name.includes(".") : t.name.startsWith(`${b.schema}.`)));
      for (const t of members) {
        const m = pos.get(t.id)!;
        expect(m.x).toBeGreaterThanOrEqual(b.x - 1);
        expect(m.y).toBeGreaterThanOrEqual(b.y - 1);
        expect(m.x + WIDTH).toBeLessThanOrEqual(b.x + b.width + 1);
        expect(m.y + HEIGHT).toBeLessThanOrEqual(b.y + b.height + 1);
      }
    }
  });

  it("reports no blocks for an arrange by relationships", () => {
    expect(arrangeLayout({ tables, relationships: rels, mode: "relationships", measure }).schemaBlocks).toEqual([]);
  });
});

describe("schemaAreasAfterArrange", () => {
  it("adds one area per named schema, around the block, and none for unqualified tables", () => {
    const areas = schemaAreasAfterArrange([block("auth", 100, 200), block("billing", 800, 200), block(null)], [userArea]);
    expect(areas[0]).toBe(userArea);
    expect(areas.slice(1).map((a) => [a.id, a.title])).toEqual([
      [schemaAreaId("auth"), "auth"],
      [schemaAreaId("billing"), "billing"],
    ]);
    const auth = areas[1];
    expect(auth.x).toBeLessThan(100);
    expect(auth.y).toBeLessThan(200);
    expect(auth.x + auth.width).toBeGreaterThan(600);
    expect(auth.y + auth.height).toBeGreaterThan(500);
    expect(areas[1].color).not.toBe(areas[2].color);
  });

  it("draws nothing with fewer than two blocks", () => {
    expect(schemaAreasAfterArrange([block("auth")], [userArea])).toEqual([userArea]);
  });

  it("moves an existing schema area but keeps what the user changed on it", () => {
    const first = schemaAreasAfterArrange([block("auth"), block("billing", 800)], []);
    const renamed = first.map((a) => (a.id === schemaAreaId("auth") ? { ...a, title: "Identity", color: "#123456" } : a));
    const next = schemaAreasAfterArrange([block("auth", 50, 60), block("billing", 900)], renamed);
    const auth = next.find((a) => a.id === schemaAreaId("auth"))!;
    expect(next.filter(isSchemaArea)).toHaveLength(2);
    expect(auth.title).toBe("Identity");
    expect(auth.color).toBe("#123456");
    expect(auth.x).toBe(50 - 24);
  });

  it("leaves a locked schema area alone, and removes unlocked ones that no longer fit", () => {
    const first = schemaAreasAfterArrange([block("auth"), block("billing", 800)], []);
    const locked = first.map((a) => (a.id === schemaAreaId("auth") ? { ...a, isLocked: true } : a));
    // Arrange by relationships: no blocks.
    const next = schemaAreasAfterArrange([], [userArea, ...locked]);
    expect(next.map((a) => a.id)).toEqual(["user-1", schemaAreaId("auth")]);
    expect(next[1]).toBe(locked[0]);
  });
});

describe("restoreSchemaAreas", () => {
  it("puts back the old schema areas and keeps areas drawn since", () => {
    const before = schemaAreasAfterArrange([block("auth"), block("billing", 800)], []);
    const after = schemaAreasAfterArrange([block("auth", 5), block("sales", 900)], before);
    const drawnSince = { ...userArea, id: "user-2" };
    const restored = restoreSchemaAreas(before, [...after, drawnSince]);
    expect(restored.map((a) => a.id)).toEqual(["user-2", schemaAreaId("auth"), schemaAreaId("billing")]);
    expect(sameAreas(restored.filter(isSchemaArea), before)).toBe(true);
  });
});
