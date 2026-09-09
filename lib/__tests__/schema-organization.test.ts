import { describe, it, expect } from "vitest";
import {
  DEFAULT_SCHEMA,
  groupTablesBySchema,
  moveTableToSchema,
  qualifySchemaName,
  renameSchema,
  validateSchemaName,
} from "@/lib/schema-namespace";
import { generateDbmlFromCanvas } from "@/lib/generator/dbml-generator";
import { parseDbml, parsedTablesToCanvasTables } from "@/lib/parser/dsl-parser";
import { resolveGroupMembers } from "@/lib/table-groups";
import type { CanvasTableGroup, Column, Relationship, Table } from "@/store/useCanvasStore";

const col = (name: string): Column => ({
  id: crypto.randomUUID(),
  name,
  type: "INT",
  isPrimaryKey: false,
  isNotNull: false,
  isUnique: false,
  isAutoIncrement: false,
});

const table = (name: string, columns: Column[] = [col("id")]): Table => ({
  id: crypto.randomUUID(),
  name,
  x: 0,
  y: 0,
  color: "#6366f1",
  columns,
});

const group = (name: string, tableNames: string[]): CanvasTableGroup => ({
  id: crypto.randomUUID(),
  name,
  tableNames,
});

describe("groupTablesBySchema", () => {
  it("buckets tables by prefix, named schemas sorted, unqualified last", () => {
    const tables = [
      table("orders"),
      table("dbo.Users"),
      table("Analytics.Events"),
      table("dbo.Roles"),
    ];

    const groups = groupTablesBySchema(tables);

    expect(groups.map((g) => g.schema)).toEqual(["Analytics", "dbo", null]);
    expect(groups[1].tables.map((t) => t.name)).toEqual(["dbo.Users", "dbo.Roles"]);
    expect(groups[2].tables.map((t) => t.name)).toEqual(["orders"]);
  });

  it("omits the unqualified group when every table has a schema", () => {
    const groups = groupTablesBySchema([table("dbo.Users")]);
    expect(groups.map((g) => g.schema)).toEqual(["dbo"]);
  });

  it("returns nothing for an empty canvas", () => {
    expect(groupTablesBySchema([])).toEqual([]);
  });
});

describe("validateSchemaName", () => {
  it("rejects blank, dotted and reserved names", () => {
    expect(validateSchemaName("  ")).toMatch(/empty/i);
    expect(validateSchemaName("a.b")).toMatch(/dot/i);
    expect(validateSchemaName("Public")).toMatch(/reserved/i);
  });

  it("accepts an ordinary name", () => {
    expect(validateSchemaName("sales")).toBeNull();
  });
});

describe("renameSchema", () => {
  it("rewrites every table carrying the prefix", () => {
    const tables = [table("dbo.Users"), table("dbo.Roles"), table("orders")];

    const plan = renameSchema("dbo", "sales", tables, []);

    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.result.tables.map((t) => t.name)).toEqual([
      "sales.Users",
      "sales.Roles",
      "orders",
    ]);
  });

  it("keeps table groups pointing at the renamed tables", () => {
    // The core regression this phase risks: group members are schema-qualified
    // strings resolved with an exact compare, so a rename that skips them
    // silently empties the group here and in the Docs sidebar.
    const users = table("dbo.Users");
    const tables = [users, table("orders")];
    const groups = [group("Core", ["dbo.Users", "orders"])];

    const plan = renameSchema("dbo", "sales", tables, groups);

    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.result.tableGroups[0].tableNames).toEqual(["sales.Users", "orders"]);

    const resolved = resolveGroupMembers(
      plan.result.tableGroups[0].tableNames,
      plan.result.tables
    );
    expect(resolved.every((m) => m.table !== null)).toBe(true);
  });

  it("leaves relationships valid, because they key off ids not names", () => {
    const users = table("dbo.Users");
    const orders = table("dbo.Orders", [col("id"), col("user_id")]);
    const rel: Relationship = {
      id: crypto.randomUUID(),
      name: "fk",
      sourceTableId: orders.id,
      sourceColumnId: orders.columns[1].id,
      targetTableId: users.id,
      targetColumnId: users.columns[0].id,
      cardinality: "One to many",
      onUpdate: "No action",
      onDelete: "No action",
    };

    const plan = renameSchema("dbo", "sales", [users, orders], []);

    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const ids = plan.result.tables.map((t) => t.id);
    expect(ids).toContain(rel.sourceTableId);
    expect(ids).toContain(rel.targetTableId);
  });

  it("preserves table ids, positions and columns", () => {
    const users = { ...table("dbo.Users"), x: 120, y: -40, color: "#ff0000" };

    const plan = renameSchema("dbo", "sales", [users], []);

    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const moved = plan.result.tables[0];
    expect(moved.id).toBe(users.id);
    expect([moved.x, moved.y, moved.color]).toEqual([120, -40, "#ff0000"]);
    expect(moved.columns).toBe(users.columns);
  });

  it("refuses a rename that would duplicate an existing table name", () => {
    const tables = [table("dbo.Users"), table("sales.Users")];

    const plan = renameSchema("dbo", "sales", tables, []);

    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.error).toMatch(/collide/i);
    expect(plan.error).toContain("sales.Users");
  });

  it("refuses the reserved default schema as a target", () => {
    const plan = renameSchema("dbo", DEFAULT_SCHEMA, [table("dbo.Users")], []);
    expect(plan.ok).toBe(false);
  });

  it("refuses when no table carries the source prefix", () => {
    const plan = renameSchema("ghost", "sales", [table("orders")], []);
    expect(plan.ok).toBe(false);
  });

  it("is a no-op when the name is unchanged", () => {
    const tables = [table("dbo.Users")];
    const plan = renameSchema("dbo", "dbo", tables, []);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.result.tables).toBe(tables);
  });

  it("returns the original tableGroups array when no member was affected", () => {
    // Lets the caller skip a redundant setTableGroups write (and the second
    // upgrade toast a plan-blocked write would raise).
    const tables = [table("dbo.Users"), table("orders")];
    const groups = [group("Unrelated", ["orders"])];

    const plan = renameSchema("dbo", "sales", tables, groups);

    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.result.tableGroups).toBe(groups);
  });

  it("normalizes bracketed names and carries group members along", () => {
    const tables = [table("[Ncr].Orders")];
    const groups = [group("Core", ["[Ncr].Orders"])];

    const plan = renameSchema("Ncr", "sales", tables, groups);

    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.result.tables[0].name).toBe("sales.Orders");
    expect(plan.result.tableGroups[0].tableNames).toEqual(["sales.Orders"]);
  });
});

describe("moveTableToSchema", () => {
  it("adds a prefix to an unqualified table", () => {
    const orders = table("orders");

    const plan = moveTableToSchema(orders.id, "sales", [orders], []);

    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.result.tables[0].name).toBe("sales.orders");
  });

  it("strips the prefix when moving out of every schema", () => {
    const users = table("dbo.Users");

    const plan = moveTableToSchema(users.id, null, [users], []);

    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.result.tables[0].name).toBe("Users");
  });

  it("updates group members for the moved table only", () => {
    const users = table("Users");
    const orders = table("orders");
    const groups = [group("Core", ["Users", "orders"])];

    const plan = moveTableToSchema(users.id, "dbo", [users, orders], groups);

    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.result.tableGroups[0].tableNames).toEqual(["dbo.Users", "orders"]);
  });

  it("refuses a move that would collide with an existing table", () => {
    const bare = table("Users");
    const qualified = table("dbo.Users");

    const plan = moveTableToSchema(bare.id, "dbo", [bare, qualified], []);

    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.error).toContain("dbo.Users");
  });

  it("refuses the reserved default schema, and an unknown table", () => {
    const orders = table("orders");
    expect(moveTableToSchema(orders.id, DEFAULT_SCHEMA, [orders], []).ok).toBe(false);
    expect(moveTableToSchema("nope", "sales", [orders], []).ok).toBe(false);
  });
});

describe("the reserved schema is genuinely not round-trip safe", () => {
  it("loses an explicit `public.` prefix through generate -> parse", () => {
    // This is why validateSchemaName rejects it: the canvas would silently
    // disagree with the DBML the moment the Code tab re-parsed.
    const tables = [table(qualifySchemaName(DEFAULT_SCHEMA, "Users"))];
    expect(tables[0].name).toBe("public.Users");

    const dbml = generateDbmlFromCanvas(tables, [], {});
    const parsed = parseDbml(dbml);
    expect(parsed).not.toBeNull();
    const back = parsedTablesToCanvasTables(parsed!.tables, {
      existingTables: [],
      originX: 0,
      originY: 0,
    });

    expect(back[0].name).toBe("Users");
  });

  it("keeps a non-default prefix through the same round-trip", () => {
    const tables = [table("dbo.Users")];

    const dbml = generateDbmlFromCanvas(tables, [], {});
    const back = parsedTablesToCanvasTables(parseDbml(dbml)!.tables, {
      existingTables: [],
      originX: 0,
      originY: 0,
    });

    expect(back[0].name).toBe("dbo.Users");
  });
});
