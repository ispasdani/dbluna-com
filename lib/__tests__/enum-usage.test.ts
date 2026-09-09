import { describe, it, expect } from "vitest";
import {
  buildEnumUsageIndex,
  findEnumUsage,
  tablesStructureSignature,
} from "@/lib/enum-usage";
import type { CanvasEnum, Column, Table } from "@/store/useCanvasStore";

const col = (over: Partial<Column> & Pick<Column, "name">): Column => ({
  id: crypto.randomUUID(),
  type: "INT",
  isPrimaryKey: false,
  isNotNull: false,
  isUnique: false,
  isAutoIncrement: false,
  ...over,
});

const table = (over: Partial<Table> & Pick<Table, "name">): Table => ({
  id: crypto.randomUUID(),
  x: 0,
  y: 0,
  color: "#6366f1",
  columns: [],
  ...over,
});

const anEnum = (name: string): CanvasEnum => ({
  id: crypto.randomUUID(),
  name,
  values: [{ name: "a" }],
});

describe("findEnumUsage", () => {
  it("matches a column whose type is the enum name", () => {
    const orders = table({
      name: "orders",
      columns: [col({ name: "id" }), col({ name: "status", type: "order_status" })],
    });

    const sites = findEnumUsage([orders], "order_status");

    expect(sites).toHaveLength(1);
    expect(sites[0].tableName).toBe("orders");
    expect(sites[0].columnName).toBe("status");
  });

  it("matches case-insensitively, as the DBML round-trip uppercases column types", () => {
    // `parsedTablesToCanvasTables` stores field.type.type_name.toUpperCase(),
    // so a column typed `order_status` comes back as `ORDER_STATUS` while the
    // enum keeps its original casing. An exact compare would miss every column
    // in a schema that has been through the Code tab.
    const orders = table({
      name: "orders",
      columns: [col({ name: "status", type: "ORDER_STATUS" })],
    });

    expect(findEnumUsage([orders], "order_status")).toHaveLength(1);
  });

  it("matches the underscore form the generator emits for a spaced type", () => {
    // generateDbmlFromCanvas writes col.type.replace(/\s+/g, "_").
    const orders = table({
      name: "orders",
      columns: [col({ name: "status", type: "ORDER_STATUS" })],
    });

    expect(findEnumUsage([orders], "order status")).toHaveLength(1);
  });

  it("does not match unrelated types, and ignores an empty enum name", () => {
    const orders = table({
      name: "orders",
      columns: [col({ name: "id", type: "INT" })],
    });

    expect(findEnumUsage([orders], "order_status")).toEqual([]);
    expect(findEnumUsage([orders], "  ")).toEqual([]);
  });
});

describe("buildEnumUsageIndex", () => {
  it("indexes every enum, including unused ones", () => {
    const used = anEnum("order_status");
    const unused = anEnum("role");
    const orders = table({
      name: "orders",
      columns: [col({ name: "status", type: "ORDER_STATUS" })],
    });

    const index = buildEnumUsageIndex([orders], [used, unused]);

    expect(index.get(used.id)).toHaveLength(1);
    expect(index.get(unused.id)).toEqual([]);
  });

  it("collects usages across multiple tables in table then column order", () => {
    const status = anEnum("order_status");
    const tables = [
      table({ name: "orders", columns: [col({ name: "status", type: "order_status" })] }),
      table({
        name: "returns",
        columns: [
          col({ name: "id" }),
          col({ name: "prev_status", type: "order_status" }),
          col({ name: "next_status", type: "order_status" }),
        ],
      }),
    ];

    const sites = buildEnumUsageIndex(tables, [status]).get(status.id)!;

    expect(sites.map((s) => `${s.tableName}.${s.columnName}`)).toEqual([
      "orders.status",
      "returns.prev_status",
      "returns.next_status",
    ]);
  });

  it("lights up both enums when two share a name, rather than silently dropping one", () => {
    // Duplicate enum names are reachable through hand-written DBML.
    const a = anEnum("status");
    const b = anEnum("status");
    const orders = table({
      name: "orders",
      columns: [col({ name: "status", type: "status" })],
    });

    const index = buildEnumUsageIndex([orders], [a, b]);

    expect(index.get(a.id)).toHaveLength(1);
    expect(index.get(b.id)).toHaveLength(1);
  });
});

describe("tablesStructureSignature", () => {
  it("is unchanged when a table only moves", () => {
    const t = table({ name: "orders", columns: [col({ name: "id" })] });
    const moved = { ...t, x: 900, y: -320 };

    expect(tablesStructureSignature([moved])).toBe(tablesStructureSignature([t]));
  });

  it("changes when a name, column or type changes", () => {
    const t = table({ name: "orders", columns: [col({ name: "id", type: "INT" })] });
    const base = tablesStructureSignature([t]);

    expect(tablesStructureSignature([{ ...t, name: "sales.orders" }])).not.toBe(base);
    expect(
      tablesStructureSignature([{ ...t, columns: [{ ...t.columns[0], name: "pk" }] }])
    ).not.toBe(base);
    expect(
      tablesStructureSignature([{ ...t, columns: [{ ...t.columns[0], type: "BIGINT" }] }])
    ).not.toBe(base);
  });

  it("does not collide when a name/type boundary shifts", () => {
    const a = table({ id: "t", name: "orders", columns: [col({ id: "c", name: "ab", type: "C" })] });
    const b = table({ id: "t", name: "orders", columns: [col({ id: "c", name: "a", type: "bC" })] });

    expect(tablesStructureSignature([a])).not.toBe(tablesStructureSignature([b]));
  });
});
