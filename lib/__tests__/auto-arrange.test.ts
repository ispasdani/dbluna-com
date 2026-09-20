import { describe, expect, it } from "vitest";

import { autoArrange, type Size, type TableMove } from "@/lib/auto-arrange";
import type { Column, Relationship, Table } from "@/store/useCanvasStore";

/* ─────────────────────────────────────────────────────────────────────────────
   Fixtures
───────────────────────────────────────────────────────────────────────────── */

const col = (name: string): Column => ({
  id: `col-${name}`,
  name,
  type: "INT",
  isPrimaryKey: false,
  isNotNull: false,
  isUnique: false,
  isAutoIncrement: false,
});

const table = (name: string, overrides: Partial<Table> = {}): Table => ({
  id: name,
  name,
  x: 0,
  y: 0,
  color: "#4f46e5",
  columns: [col("id"), col("name"), col("created_at")],
  ...overrides,
});

const rel = (source: string, target: string): Relationship => ({
  id: `${source}->${target}`,
  name: "",
  sourceTableId: source,
  sourceColumnId: "col-id",
  targetTableId: target,
  targetColumnId: "col-id",
  cardinality: "One to many",
  onUpdate: "No action",
  onDelete: "No action",
});

/** Fixed 240x150 boxes, so assertions are about layout rather than geometry. */
const WIDTH = 240;
const HEIGHT = 150;
const measure = (): Size => ({ width: WIDTH, height: HEIGHT });

const arrange = (
  tables: Table[],
  relationships: Relationship[],
  mode: "schema" | "relationships"
) => autoArrange({ tables, relationships, mode, measure });

/** Every pair of laid-out boxes, checked for overlap at the given padding. */
function overlappingPairs(moves: TableMove[], pad = 0): [string, string][] {
  const hits: [string, string][] = [];
  for (let i = 0; i < moves.length; i++) {
    for (let j = i + 1; j < moves.length; j++) {
      const a = moves[i];
      const b = moves[j];
      if (
        a.x < b.x + WIDTH + pad &&
        a.x + WIDTH + pad > b.x &&
        a.y < b.y + HEIGHT + pad &&
        a.y + HEIGHT + pad > b.y
      ) {
        hits.push([a.id, b.id]);
      }
    }
  }
  return hits;
}

const byId = (moves: TableMove[]) => new Map(moves.map((m) => [m.id, m]));

/* ─────────────────────────────────────────────────────────────────────────────
   Tests
───────────────────────────────────────────────────────────────────────────── */

describe("autoArrange", () => {
  it("returns nothing for an empty canvas", () => {
    expect(arrange([], [], "schema")).toEqual([]);
  });

  it("moves every unlocked table exactly once", () => {
    const tables = [table("a"), table("b"), table("c")];
    const moves = arrange(tables, [], "relationships");

    expect(moves).toHaveLength(3);
    expect(new Set(moves.map((m) => m.id)).size).toBe(3);
  });

  it("never overlaps tables", () => {
    // Two schemas, a connected chain in one and loose tables in the other —
    // exercises dagre output, the isolated grid and the schema packer at once.
    const tables = [
      ...["one", "two", "three", "four"].map((n) => table(`sales.${n}`)),
      ...["alpha", "beta", "gamma", "delta", "epsilon"].map((n) => table(`hr.${n}`)),
      table("legacy"),
    ];
    const relationships = [
      rel("sales.one", "sales.two"),
      rel("sales.two", "sales.three"),
      rel("sales.three", "sales.four"),
    ];

    expect(overlappingPairs(arrange(tables, relationships, "schema"))).toEqual([]);
    expect(overlappingPairs(arrange(tables, relationships, "relationships"))).toEqual([]);
  });

  it("is deterministic regardless of input order", () => {
    const names = ["b.one", "a.two", "c.three", "a.four", "b.five"];
    const tables = names.map((n) => table(n));
    const relationships = [rel("a.two", "a.four")];

    const forwards = byId(arrange(tables, relationships, "schema"));
    const backwards = byId(arrange([...tables].reverse(), relationships, "schema"));

    for (const name of names) {
      expect(backwards.get(name)).toEqual(forwards.get(name));
    }
  });

  it("lays a foreign-key chain out left to right", () => {
    const tables = [table("a"), table("b"), table("c")];
    const moves = byId(arrange(tables, [rel("a", "b"), rel("b", "c")], "relationships"));

    expect(moves.get("a")!.x).toBeLessThan(moves.get("b")!.x);
    expect(moves.get("b")!.x).toBeLessThan(moves.get("c")!.x);
  });

  it("puts unrelated tables in a grid rather than one long line", () => {
    const tables = Array.from({ length: 24 }, (_, i) => table(`t${String(i).padStart(2, "0")}`));
    const moves = arrange(tables, [], "relationships");

    // dagre files disconnected nodes into a single rank; the isolated grid is
    // what keeps that from becoming a 24-table column.
    const rows = new Set(moves.map((m) => m.y));
    const columns = new Set(moves.map((m) => m.x));
    expect(rows.size).toBeGreaterThan(1);
    expect(columns.size).toBeGreaterThan(1);
    expect(overlappingPairs(moves)).toEqual([]);
  });

  describe("schema mode", () => {
    it("keeps each schema's tables in a block that no other schema intrudes on", () => {
      const tables = [
        ...["a", "b", "c", "d"].map((n) => table(`dbo.${n}`)),
        ...["a", "b", "c", "d"].map((n) => table(`Ncr.${n}`)),
        ...["a", "b", "c", "d"].map((n) => table(`Analytics.${n}`)),
      ];
      const moves = byId(arrange(tables, [], "schema"));

      const blockOf = (schema: string) => {
        const own = [...moves.values()].filter((m) => m.id.startsWith(`${schema}.`));
        return {
          minX: Math.min(...own.map((m) => m.x)),
          maxX: Math.max(...own.map((m) => m.x + WIDTH)),
          minY: Math.min(...own.map((m) => m.y)),
          maxY: Math.max(...own.map((m) => m.y + HEIGHT)),
        };
      };

      const blocks = ["dbo", "Ncr", "Analytics"].map(blockOf);

      // The bug this guards against is ChartDB's: its perSchema mode restarts
      // every schema at the same origin with a per-schema overlap map, so the
      // blocks land on top of each other.
      for (let i = 0; i < blocks.length; i++) {
        for (let j = i + 1; j < blocks.length; j++) {
          const a = blocks[i];
          const b = blocks[j];
          const separated = a.maxX <= b.minX || b.maxX <= a.minX || a.maxY <= b.minY || b.maxY <= a.minY;
          expect(separated).toBe(true);
        }
      }
    });

    it("treats unqualified tables as their own group", () => {
      const tables = [table("dbo.users"), table("dbo.orders"), table("scratch")];
      const moves = byId(arrange(tables, [], "schema"));

      const dboX = Math.min(moves.get("dbo.users")!.x, moves.get("dbo.orders")!.x);
      const dboMaxX = Math.max(moves.get("dbo.users")!.x, moves.get("dbo.orders")!.x) + WIDTH;
      const loose = moves.get("scratch")!;

      expect(loose.x >= dboMaxX || loose.x + WIDTH <= dboX || loose.y !== moves.get("dbo.users")!.y).toBe(true);
    });

    it("scales to a schema count and table count like a real import", () => {
      // 20 schemas x 25 tables, a chain of foreign keys inside each.
      const tables: Table[] = [];
      const relationships: Relationship[] = [];
      for (let s = 0; s < 20; s++) {
        for (let t = 0; t < 25; t++) {
          tables.push(table(`s${String(s).padStart(2, "0")}.t${String(t).padStart(2, "0")}`));
          if (t > 0) {
            relationships.push(
              rel(
                `s${String(s).padStart(2, "0")}.t${String(t - 1).padStart(2, "0")}`,
                `s${String(s).padStart(2, "0")}.t${String(t).padStart(2, "0")}`
              )
            );
          }
        }
      }

      const moves = arrange(tables, relationships, "schema");
      expect(moves).toHaveLength(500);
      expect(overlappingPairs(moves)).toEqual([]);

      // Packed towards a readable aspect, not one enormous row or column.
      const width = Math.max(...moves.map((m) => m.x)) - Math.min(...moves.map((m) => m.x));
      const height = Math.max(...moves.map((m) => m.y)) - Math.min(...moves.map((m) => m.y));
      expect(width / height).toBeGreaterThan(0.3);
      expect(width / height).toBeLessThan(6);
    });
  });

  describe("locked tables", () => {
    it("never returns a move for a locked table", () => {
      const tables = [table("a"), table("pinned", { isLocked: true }), table("c")];
      const moves = arrange(tables, [], "relationships");

      expect(moves.map((m) => m.id).sort()).toEqual(["a", "c"]);
    });

    it("places the arranged block clear of the locked ones", () => {
      const tables = [
        table("pinned", { isLocked: true, x: 1000, y: 1000 }),
        ...["a", "b", "c"].map((n) => table(n, { x: 0, y: 0 })),
      ];
      const moves = arrange(tables, [], "relationships");

      // Everything lands below the locked table's bottom edge.
      for (const move of moves) {
        expect(move.y).toBeGreaterThan(1000 + HEIGHT);
      }
    });

    it("returns nothing when every table is locked", () => {
      const tables = [table("a", { isLocked: true }), table("b", { isLocked: true })];
      expect(arrange(tables, [], "schema")).toEqual([]);
    });
  });

  it("anchors the result near where the diagram already was", () => {
    const tables = [table("a", { x: 5000, y: 4000 }), table("b", { x: 5400, y: 4000 })];
    const moves = arrange(tables, [rel("a", "b")], "relationships");

    // Not teleported back to the origin.
    for (const move of moves) {
      expect(move.x).toBeGreaterThan(4000);
      expect(move.y).toBeGreaterThan(3000);
    }
  });

  it("ignores self-referencing relationships when deciding what is connected", () => {
    // A self-ref must not count as structure, or the table gets sent through
    // dagre alone instead of into the isolated grid with its peers.
    const tables = [table("a"), table("b")];
    const moves = arrange(tables, [rel("a", "a")], "relationships");

    expect(moves).toHaveLength(2);
    expect(overlappingPairs(moves)).toEqual([]);
  });
});
