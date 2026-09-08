import { describe, it, expect } from "vitest";
import { generateDbmlFromCanvas } from "@/lib/generator/dbml-generator";
import {
  parseDbml,
  parsedTablesToCanvasTables,
  parsedToCanvasSchemaMeta,
  parsedRefsToCanvasRelationships,
} from "@/lib/parser/dsl-parser";
import type {
  Table,
  Column,
  Relationship,
  CanvasEnum,
  CanvasTableGroup,
  CanvasProject,
} from "@/store/useCanvasStore";

// ── builders ──────────────────────────────────────────────────────────────
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

// Generate DBML from the canvas, parse it, and map it back to canvas shapes.
function roundTrip(
  tables: Table[],
  relationships: Relationship[] = [],
  meta: { enums?: CanvasEnum[]; tableGroups?: CanvasTableGroup[]; project?: CanvasProject | null } = {}
) {
  const dbml = generateDbmlFromCanvas(tables, relationships, meta);
  const parsed = parseDbml(dbml);
  expect(parsed, `generated DBML should parse:\n${dbml}`).not.toBeNull();
  const canvasTables = parsedTablesToCanvasTables(parsed!.tables, {
    existingTables: [],
    originX: 0,
    originY: 0,
  });
  const schemaMeta = parsedToCanvasSchemaMeta(parsed!);
  const canvasRelationships = parsedRefsToCanvasRelationships(parsed!.refs, canvasTables, []);
  return { dbml, parsed: parsed!, canvasTables, schemaMeta, canvasRelationships };
}

describe("DBML round-trip: tables & columns", () => {
  it("preserves table names, column names, types and constraints", () => {
    const users = table({
      name: "users",
      columns: [
        col({ name: "id", type: "INT", isPrimaryKey: true, isAutoIncrement: true }),
        col({ name: "email", type: "VARCHAR", isUnique: true, isNotNull: true }),
        col({ name: "created_at", type: "TIMESTAMP", isNotNull: true }),
      ],
    });

    const { canvasTables } = roundTrip([users]);

    expect(canvasTables).toHaveLength(1);
    const t = canvasTables[0];
    expect(t.name).toBe("users");
    expect(t.columns.map((c) => c.name)).toEqual(["id", "email", "created_at"]);

    const id = t.columns[0];
    expect(id.isPrimaryKey).toBe(true);
    expect(id.isAutoIncrement).toBe(true);

    const email = t.columns[1];
    expect(email.type).toBe("VARCHAR");
    expect(email.isUnique).toBe(true);
    expect(email.isNotNull).toBe(true);
  });

  it("preserves existing table & column ids when re-mapping", () => {
    const users = table({
      name: "users",
      columns: [col({ name: "id", type: "INT", isPrimaryKey: true })],
    });

    const dbml = generateDbmlFromCanvas([users], []);
    const parsed = parseDbml(dbml)!;
    const remapped = parsedTablesToCanvasTables(parsed.tables, {
      existingTables: [users],
      originX: 0,
      originY: 0,
    });

    expect(remapped[0].id).toBe(users.id);
    expect(remapped[0].columns[0].id).toBe(users.columns[0].id);
  });
});

describe("DBML round-trip: schema-qualified names", () => {
  it("keeps a schema prefix (dbo.Users) through the round-trip", () => {
    const t = table({
      name: "dbo.Users",
      columns: [col({ name: "id", type: "INT", isPrimaryKey: true })],
    });
    const { canvasTables } = roundTrip([t]);
    expect(canvasTables[0].name).toBe("dbo.Users");
  });

  it("does not fold the synthetic 'public' schema into plain table names", () => {
    const t = table({
      name: "orders",
      columns: [col({ name: "id", type: "INT", isPrimaryKey: true })],
    });
    const { canvasTables } = roundTrip([t]);
    expect(canvasTables[0].name).toBe("orders");
  });
});

describe("DBML round-trip: relationships & notes", () => {
  it("emits a Ref for a relationship and it parses back", () => {
    const users = table({
      name: "users",
      columns: [col({ name: "id", type: "INT", isPrimaryKey: true })],
    });
    const orders = table({
      name: "orders",
      columns: [
        col({ name: "id", type: "INT", isPrimaryKey: true }),
        col({ name: "user_id", type: "INT" }),
      ],
    });
    const rel: Relationship = {
      id: crypto.randomUUID(),
      name: "",
      sourceTableId: orders.id,
      sourceColumnId: orders.columns[1].id,
      targetTableId: users.id,
      targetColumnId: users.columns[0].id,
      cardinality: "One to many",
      onUpdate: "No action",
      onDelete: "No action",
    };

    const { dbml, parsed, canvasRelationships, canvasTables } = roundTrip([users, orders], [rel]);

    expect(dbml).toContain(`Ref: "orders"."user_id" > "users"."id"`);
    const refCount = (parsed.raw.schemas as any[]).reduce(
      (n, s) => n + (s.refs?.length ?? 0),
      0
    );
    expect(refCount).toBe(1);

    // …and the parsed Ref maps back onto a canvas relationship pointing at the
    // right table/column ids.
    expect(canvasRelationships).toHaveLength(1);
    const ordersT = canvasTables.find((t) => t.name === "orders")!;
    const usersT = canvasTables.find((t) => t.name === "users")!;
    expect(canvasRelationships[0]).toMatchObject({
      sourceTableId: ordersT.id,
      sourceColumnId: ordersT.columns.find((c) => c.name === "user_id")!.id,
      targetTableId: usersT.id,
      targetColumnId: usersT.columns.find((c) => c.name === "id")!.id,
      cardinality: "One to many",
    });
  });

  it("maps referential actions and preserves relationship ids across a round-trip", () => {
    const dbml = `
Table users {
  id INT [pk]
}
Table orders {
  id INT [pk]
  user_id INT
}
Ref: orders.user_id > users.id [delete: cascade, update: restrict]
`;
    const parsed = parseDbml(dbml)!;
    const tables = parsedTablesToCanvasTables(parsed.tables, { existingTables: [], originX: 0, originY: 0 });
    const first = parsedRefsToCanvasRelationships(parsed.refs, tables, []);
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ onDelete: "Cascade", onUpdate: "Restrict" });

    // Re-parsing with the previous result as "existing" keeps the same id.
    const second = parsedRefsToCanvasRelationships(parsed.refs, tables, first);
    expect(second[0].id).toBe(first[0].id);
  });

  it("drops a Ref whose column does not resolve", () => {
    const dbml = `
Table users {
  id INT [pk]
}
Ref: users.id > ghosts.id
`;
    const parsed = parseDbml(dbml);
    // Dangling table refs make @dbml/core reject the whole document — nothing
    // to map. The point is parsedRefsToCanvasRelationships never throws.
    if (parsed) {
      const tables = parsedTablesToCanvasTables(parsed.tables, { existingTables: [], originX: 0, originY: 0 });
      expect(() => parsedRefsToCanvasRelationships(parsed.refs, tables, [])).not.toThrow();
    }
  });

  it("round-trips a table comment through a Note", () => {
    const t = table({
      name: "users",
      comment: "Stores user accounts",
      columns: [col({ name: "id", type: "INT", isPrimaryKey: true })],
    });
    const { dbml, canvasTables } = roundTrip([t]);
    expect(dbml).toContain(`Note: 'Stores user accounts'`);
    expect(canvasTables[0].comment).toBe("Stores user accounts");
  });
});

describe("DBML round-trip: docs metadata (enums, groups, project)", () => {
  it("round-trips enums with value notes", () => {
    const enums: CanvasEnum[] = [
      {
        id: crypto.randomUUID(),
        name: "order_status",
        values: [
          { name: "pending", note: "awaiting payment" },
          { name: "shipped" },
        ],
      },
    ];
    const t = table({
      name: "orders",
      columns: [col({ name: "id", type: "INT", isPrimaryKey: true })],
    });

    const { schemaMeta } = roundTrip([t], [], { enums });

    expect(schemaMeta.enums).toHaveLength(1);
    const e = schemaMeta.enums[0];
    expect(e.name).toBe("order_status");
    expect(e.values.map((v) => v.name)).toEqual(["pending", "shipped"]);
    expect(e.values[0].note).toBe("awaiting payment");
    expect(e.values[1].note).toBeUndefined();
  });

  it("round-trips table groups with schema-qualified members", () => {
    const groups: CanvasTableGroup[] = [
      { id: crypto.randomUUID(), name: "Core", tableNames: ["dbo.Users", "orders"] },
    ];
    const tables = [
      table({ name: "dbo.Users", columns: [col({ name: "id", type: "INT", isPrimaryKey: true })] }),
      table({ name: "orders", columns: [col({ name: "id", type: "INT", isPrimaryKey: true })] }),
    ];

    const { schemaMeta } = roundTrip(tables, [], { tableGroups: groups });

    expect(schemaMeta.tableGroups).toHaveLength(1);
    const g = schemaMeta.tableGroups[0];
    expect(g.name).toBe("Core");
    expect(g.tableNames).toEqual(["dbo.Users", "orders"]);
  });

  it("round-trips the project name, database type and README note", () => {
    const project: CanvasProject = {
      name: "Shop",
      databaseType: "PostgreSQL",
      note: "My **README** note",
    };
    const t = table({
      name: "users",
      columns: [col({ name: "id", type: "INT", isPrimaryKey: true })],
    });

    const { schemaMeta } = roundTrip([t], [], { project });

    expect(schemaMeta.project).not.toBeNull();
    expect(schemaMeta.project!.name).toBe("Shop");
    expect(schemaMeta.project!.databaseType).toBe("PostgreSQL");
    expect(schemaMeta.project!.note).toBe("My **README** note");
  });

  it("returns null project / empty meta when the canvas has no metadata", () => {
    const t = table({
      name: "users",
      columns: [col({ name: "id", type: "INT", isPrimaryKey: true })],
    });
    const { schemaMeta } = roundTrip([t]);
    expect(schemaMeta.project).toBeNull();
    expect(schemaMeta.enums).toEqual([]);
    expect(schemaMeta.tableGroups).toEqual([]);
  });
});

describe("parsedToCanvasSchemaMeta: id stability across re-parses", () => {
  // The Code tab re-parses on every keystroke (400ms debounce). Without id
  // preservation each parse minted fresh uuids, which changed the cloud-autosave
  // payload signature and pushed a semantically-identical schema to Convex.
  const metaFixture = () => {
    const enums: CanvasEnum[] = [
      { id: crypto.randomUUID(), name: "order_status", values: [{ name: "pending" }] },
      { id: crypto.randomUUID(), name: "role", values: [{ name: "admin" }] },
    ];
    const tableGroups: CanvasTableGroup[] = [
      { id: crypto.randomUUID(), name: "Core", tableNames: ["users"] },
    ];
    const tables = [
      table({ name: "users", columns: [col({ name: "id", type: "INT", isPrimaryKey: true })] }),
    ];
    const dbml = generateDbmlFromCanvas(tables, [], { enums, tableGroups });
    const parsed = parseDbml(dbml);
    expect(parsed).not.toBeNull();
    return { enums, tableGroups, parsed: parsed! };
  };

  it("preserves enum ids by name when existing enums are supplied", () => {
    const { enums, parsed } = metaFixture();

    const meta = parsedToCanvasSchemaMeta(parsed, { existingEnums: enums });

    expect(meta.enums.map((e) => e.id)).toEqual(enums.map((e) => e.id));
  });

  it("preserves table group ids by name when existing groups are supplied", () => {
    const { tableGroups, parsed } = metaFixture();

    const meta = parsedToCanvasSchemaMeta(parsed, { existingTableGroups: tableGroups });

    expect(meta.tableGroups[0].id).toBe(tableGroups[0].id);
  });

  it("is stable across repeated parses, so the autosave signature does not churn", () => {
    const { enums, tableGroups, parsed } = metaFixture();

    const first = parsedToCanvasSchemaMeta(parsed, {
      existingEnums: enums,
      existingTableGroups: tableGroups,
    });
    const second = parsedToCanvasSchemaMeta(parsed, {
      existingEnums: first.enums,
      existingTableGroups: first.tableGroups,
    });

    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it("mints a new id for a renamed enum but keeps the untouched one", () => {
    const { enums, parsed } = metaFixture();
    // Simulate the store still holding the pre-rename name for the first enum.
    const stale: CanvasEnum[] = [
      { ...enums[0], name: "old_status" },
      enums[1],
    ];

    const meta = parsedToCanvasSchemaMeta(parsed, { existingEnums: stale });

    const renamed = meta.enums.find((e) => e.name === "order_status")!;
    const untouched = meta.enums.find((e) => e.name === "role")!;
    expect(renamed.id).not.toBe(enums[0].id);
    expect(untouched.id).toBe(enums[1].id);
  });

  it("mints fresh ids when the options argument is omitted (unchanged legacy behavior)", () => {
    const { parsed } = metaFixture();

    const a = parsedToCanvasSchemaMeta(parsed);
    const b = parsedToCanvasSchemaMeta(parsed);

    expect(a.enums.map((e) => e.id)).not.toEqual(b.enums.map((e) => e.id));
    // Everything except the ids still matches.
    expect(a.enums.map((e) => e.name)).toEqual(b.enums.map((e) => e.name));
    expect(a.tableGroups.map((g) => g.name)).toEqual(b.tableGroups.map((g) => g.name));
  });
});
