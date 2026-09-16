import { describe, expect, it } from "vitest";

import {
  analyzeDiagram,
  countIssues,
  issuesSignature,
  normalizeTypeName,
  type DiagramModel,
  type IssueRule,
} from "@/lib/diagram-issues";
import type { CanvasEnum, Column, Relationship, Table } from "@/store/useCanvasStore";

// ─── Fixtures ────────────────────────────────────────────────────────────────

function col(name: string, overrides: Partial<Column> = {}): Column {
  return {
    id: `col-${name}`,
    name,
    type: "INT",
    isPrimaryKey: false,
    isNotNull: false,
    isUnique: false,
    isAutoIncrement: false,
    ...overrides,
  };
}

function table(id: string, name: string, columns: Column[] = []): Table {
  return { id, name, x: 0, y: 0, color: "#000", columns };
}

function rel(overrides: Partial<Relationship> & Pick<Relationship, "id">): Relationship {
  return {
    name: "",
    sourceTableId: "t1",
    sourceColumnId: "c1",
    targetTableId: "t2",
    targetColumnId: "c2",
    cardinality: "One to many",
    onUpdate: "No action",
    onDelete: "No action",
    ...overrides,
  };
}

const pk = (name = "id", overrides: Partial<Column> = {}) =>
  col(name, { isPrimaryKey: true, isNotNull: true, isUnique: true, ...overrides });

const rules = (model: DiagramModel): IssueRule[] =>
  analyzeDiagram(model).map((i) => i.rule);

const rulesFor = (model: DiagramModel, rule: IssueRule) =>
  analyzeDiagram(model).filter((i) => i.rule === rule);

/** A minimal two-table schema with nothing wrong with it. */
function cleanModel(): DiagramModel {
  return {
    tables: [
      table("t1", "users", [pk("id", { id: "u-id" })]),
      table("t2", "posts", [
        pk("id", { id: "p-id" }),
        col("user_id", { id: "p-user", isNotNull: true }),
      ]),
    ],
    relationships: [
      rel({
        id: "r1",
        sourceTableId: "t2",
        sourceColumnId: "p-user",
        targetTableId: "t1",
        targetColumnId: "u-id",
      }),
    ],
    enums: [],
    tableGroups: [],
  };
}

// ─── Baseline ────────────────────────────────────────────────────────────────

describe("analyzeDiagram — clean schemas", () => {
  it("reports nothing for a well-formed schema", () => {
    expect(analyzeDiagram(cleanModel())).toEqual([]);
  });

  it("reports nothing for an empty diagram", () => {
    expect(analyzeDiagram({ tables: [], relationships: [] })).toEqual([]);
  });

  it("does not flag a lone table as orphaned", () => {
    const model: DiagramModel = {
      tables: [table("t1", "users", [pk()])],
      relationships: [],
    };
    expect(rules(model)).not.toContain("table-orphaned");
  });

  it("sorts errors before warnings before info", () => {
    const model: DiagramModel = {
      tables: [
        // info (orphan) + warning (no PK) + error (no type)
        table("t1", "alpha", [col("a", { id: "a", type: "" })]),
        table("t2", "beta", [pk()]),
      ],
      relationships: [],
    };
    const rank = { error: 0, warning: 1, info: 2 } as const;
    const ranks = analyzeDiagram(model).map((i) => rank[i.severity]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(ranks[0]).toBe(0);
  });

  it("gives every issue a unique id", () => {
    const model: DiagramModel = {
      tables: [
        table("t1", "users", [
          col("email", { id: "e1" }),
          col("email", { id: "e2" }),
          col("email", { id: "e3" }),
        ]),
      ],
      relationships: [],
    };
    const ids = analyzeDiagram(model).map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ─── Naming ──────────────────────────────────────────────────────────────────

describe("naming rules", () => {
  it("flags a blank table name", () => {
    const model: DiagramModel = {
      tables: [table("t1", "   ", [pk()])],
      relationships: [],
    };
    expect(rules(model)).toContain("table-name-empty");
    // No duplicate/reserved noise stacked on top of an unnamed table.
    expect(rules(model)).not.toContain("table-name-duplicate");
  });

  it("flags duplicate table names case-insensitively", () => {
    const model: DiagramModel = {
      tables: [table("t1", "Users", [pk()]), table("t2", "users", [pk()])],
      relationships: [],
    };
    expect(rulesFor(model, "table-name-duplicate")).toHaveLength(2);
  });

  it("treats same-named tables in different schemas as distinct", () => {
    const model: DiagramModel = {
      tables: [table("t1", "dbo.Users", [pk()]), table("t2", "sales.Users", [pk()])],
      relationships: [],
    };
    expect(rules(model)).not.toContain("table-name-duplicate");
  });

  it("checks reserved keywords against the unqualified table name", () => {
    const model: DiagramModel = {
      tables: [table("t1", "dbo.order", [pk()])],
      relationships: [],
    };
    expect(rules(model)).toContain("table-name-reserved");
  });

  it("does not flag a schema prefix as needing quoting", () => {
    const model: DiagramModel = {
      tables: [table("t1", "dbo.customers", [pk()])],
      relationships: [],
    };
    expect(rules(model)).not.toContain("table-name-needs-quoting");
  });

  it("flags identifiers that would need quoting", () => {
    const model: DiagramModel = {
      tables: [
        table("t1", "order items", [pk()]),
        table("t2", "2fa_codes", [pk()]),
        table("t3", "ok_name", [pk("id"), col("first name", { id: "fn" })]),
      ],
      relationships: [],
    };
    expect(rulesFor(model, "table-name-needs-quoting")).toHaveLength(2);
    expect(rulesFor(model, "column-name-needs-quoting")).toHaveLength(1);
  });

  it("emits one duplicate-column finding per offending column", () => {
    const model: DiagramModel = {
      tables: [
        table("t1", "users", [
          col("Email", { id: "e1" }),
          col("email", { id: "e2" }),
          col("EMAIL", { id: "e3" }),
        ]),
      ],
      relationships: [],
    };
    expect(rulesFor(model, "column-name-duplicate")).toHaveLength(3);
  });

  it("flags blank column names and reserved column names", () => {
    const model: DiagramModel = {
      tables: [
        table("t1", "users", [pk(), col("", { id: "blank" }), col("order", { id: "ord" })]),
      ],
      relationships: [],
    };
    expect(rules(model)).toContain("column-name-empty");
    expect(rules(model)).toContain("column-name-reserved");
  });
});

// ─── Structure & keys ────────────────────────────────────────────────────────

describe("structure and key rules", () => {
  it("flags an empty table and a table without a primary key", () => {
    const model: DiagramModel = {
      tables: [table("t1", "empty"), table("t2", "no_pk", [col("a", { id: "a" })])],
      relationships: [],
    };
    expect(rules(model)).toContain("table-no-columns");
    expect(rules(model)).toContain("table-no-primary-key");
    // An empty table has no columns, so "no primary key" would be redundant.
    expect(rulesFor(model, "table-no-primary-key")).toHaveLength(1);
  });

  it("does not count a dangling relationship as connectivity", () => {
    const model: DiagramModel = {
      tables: [table("t1", "users", [pk()]), table("t2", "posts", [pk()])],
      relationships: [
        rel({ id: "r1", sourceTableId: "t1", sourceColumnId: "col-id", targetTableId: "gone" }),
      ],
    };
    const orphans = rulesFor(model, "table-orphaned");
    expect(orphans).toHaveLength(2);
  });

  it("flags more than one auto-increment column per table", () => {
    const model: DiagramModel = {
      tables: [
        table("t1", "users", [
          pk("id", { id: "a", isAutoIncrement: true }),
          col("seq", { id: "b", isAutoIncrement: true }),
        ]),
      ],
      relationships: [],
    };
    expect(rules(model)).toContain("table-multiple-auto-increment");
  });

  it("flags auto-increment on a non-integer column only", () => {
    const model: DiagramModel = {
      tables: [
        table("t1", "a", [pk("id", { id: "x", type: "UUID", isAutoIncrement: true })]),
        table("t2", "b", [pk("id", { id: "y", type: "bigint", isAutoIncrement: true })]),
      ],
      relationships: [],
    };
    expect(rulesFor(model, "column-auto-increment-non-integer")).toHaveLength(1);
  });

  it("flags a nullable primary key as info", () => {
    const model: DiagramModel = {
      tables: [table("t1", "users", [col("id", { id: "id", isPrimaryKey: true })])],
      relationships: [],
    };
    const found = rulesFor(model, "column-primary-key-nullable");
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe("info");
  });
});

// ─── Types ───────────────────────────────────────────────────────────────────

describe("type rules", () => {
  it("normalizes types across picker / DBML / SQL-import conventions", () => {
    expect(normalizeTypeName("varchar(255)")).toEqual({ base: "VARCHAR", args: "255" });
    expect(normalizeTypeName("  INT ")).toEqual({ base: "INT", args: null });
    expect(normalizeTypeName("int8[]")).toEqual({ base: "INT8", args: null });
    expect(normalizeTypeName("double   precision")).toEqual({
      base: "DOUBLE PRECISION",
      args: null,
    });
    expect(normalizeTypeName("decimal(10, 2)")).toEqual({ base: "DECIMAL", args: "10,2" });
  });

  it("flags a missing column type as an error", () => {
    const model: DiagramModel = {
      tables: [table("t1", "users", [pk("id"), col("blank", { id: "b", type: "  " })])],
      relationships: [],
    };
    expect(rules(model)).toContain("column-type-missing");
  });

  it("does not flag a case- or width-only difference as incompatible", () => {
    const model = cleanModel();
    model.tables[0].columns[0].type = "int";
    model.tables[1].columns[1].type = "INT";
    expect(rules(model)).not.toContain("relationship-type-incompatible");
    expect(rules(model)).not.toContain("relationship-type-width");
  });

  it("reports a same-family width difference as info", () => {
    const model = cleanModel();
    model.tables[0].columns[0].type = "BIGINT";
    model.tables[1].columns[1].type = "INT";
    const found = rulesFor(model, "relationship-type-width");
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe("info");
  });

  it("reports a cross-family mismatch as a warning", () => {
    const model = cleanModel();
    model.tables[0].columns[0].type = "UUID";
    model.tables[1].columns[1].type = "VARCHAR(36)";
    const found = rulesFor(model, "relationship-type-incompatible");
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe("warning");
  });

  it("compares unknown types (enums, user-defined) by name", () => {
    const model = cleanModel();
    model.tables[0].columns[0].type = "order_status";
    model.tables[1].columns[1].type = "ORDER_STATUS";
    expect(rules(model)).not.toContain("relationship-type-incompatible");
  });
});

// ─── Relationships ───────────────────────────────────────────────────────────

describe("relationship rules", () => {
  it("flags a relationship whose table was deleted", () => {
    const model: DiagramModel = {
      tables: [table("t1", "users", [pk("id", { id: "u-id" })])],
      relationships: [
        rel({
          id: "r1",
          sourceTableId: "t1",
          sourceColumnId: "u-id",
          targetTableId: "deleted",
          targetColumnId: "gone",
        }),
      ],
    };
    const found = rulesFor(model, "relationship-dangling");
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe("error");
    expect(found[0].relationshipId).toBe("r1");
  });

  it("flags a relationship whose column was deleted", () => {
    const model = cleanModel();
    model.relationships[0].targetColumnId = "gone";
    expect(rules(model)).toContain("relationship-dangling");
  });

  it("flags a column referencing itself", () => {
    const model: DiagramModel = {
      tables: [table("t1", "nodes", [pk("id", { id: "n-id" })])],
      relationships: [
        rel({
          id: "r1",
          sourceTableId: "t1",
          sourceColumnId: "n-id",
          targetTableId: "t1",
          targetColumnId: "n-id",
        }),
      ],
    };
    expect(rules(model)).toContain("relationship-self-column");
  });

  it("accepts a normal parent/child self-reference", () => {
    const model: DiagramModel = {
      tables: [
        table("t1", "nodes", [
          pk("id", { id: "n-id" }),
          col("parent_id", { id: "n-parent" }),
        ]),
      ],
      relationships: [
        rel({
          id: "r1",
          sourceTableId: "t1",
          sourceColumnId: "n-parent",
          targetTableId: "t1",
          targetColumnId: "n-id",
        }),
      ],
    };
    expect(analyzeDiagram(model)).toEqual([]);
  });

  it("flags the same edge declared twice, in either direction", () => {
    const model = cleanModel();
    model.relationships.push(
      rel({
        id: "r2",
        sourceTableId: "t1",
        sourceColumnId: "u-id",
        targetTableId: "t2",
        targetColumnId: "p-user",
        cardinality: "Many to one",
      })
    );
    const found = rulesFor(model, "relationship-duplicate");
    expect(found).toHaveLength(1);
    expect(found[0].relationshipId).toBe("r2");
  });

  it("flags a foreign key onto a column that is neither PK nor unique", () => {
    const model = cleanModel();
    model.tables[0].columns[0] = col("id", { id: "u-id", isNotNull: true });
    expect(rules(model)).toContain("relationship-target-not-unique");
  });

  it("resolves the referenced end from the cardinality", () => {
    // "Many to one" puts the FK on the target, so the SOURCE column is the one
    // that has to be unique.
    const model: DiagramModel = {
      tables: [
        table("t1", "users", [pk("id", { id: "u-id" })]),
        table("t2", "posts", [pk("id", { id: "p-id" }), col("user_id", { id: "p-user" })]),
      ],
      relationships: [
        rel({
          id: "r1",
          sourceTableId: "t1",
          sourceColumnId: "u-id",
          targetTableId: "t2",
          targetColumnId: "p-user",
          cardinality: "Many to one",
        }),
      ],
    };
    expect(rules(model)).not.toContain("relationship-target-not-unique");
  });

  it("flags SET NULL on a NOT NULL foreign key", () => {
    const model = cleanModel();
    model.relationships[0].onDelete = "Set null";
    const found = rulesFor(model, "relationship-set-null-on-not-null");
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe("error");
    expect(found[0].columnId).toBe("p-user");
  });

  it("allows SET NULL on a nullable foreign key", () => {
    const model = cleanModel();
    model.tables[1].columns[1].isNotNull = false;
    model.relationships[0].onDelete = "Set null";
    expect(rules(model)).not.toContain("relationship-set-null-on-not-null");
  });

  it("detects a circular foreign-key chain once", () => {
    const model: DiagramModel = {
      tables: [
        table("t1", "a", [pk("id", { id: "a-id" }), col("b_id", { id: "a-b" })]),
        table("t2", "b", [pk("id", { id: "b-id" }), col("c_id", { id: "b-c" })]),
        table("t3", "c", [pk("id", { id: "c-id" }), col("a_id", { id: "c-a" })]),
      ],
      relationships: [
        rel({ id: "r1", sourceTableId: "t1", sourceColumnId: "a-b", targetTableId: "t2", targetColumnId: "b-id" }),
        rel({ id: "r2", sourceTableId: "t2", sourceColumnId: "b-c", targetTableId: "t3", targetColumnId: "c-id" }),
        rel({ id: "r3", sourceTableId: "t3", sourceColumnId: "c-a", targetTableId: "t1", targetColumnId: "a-id" }),
      ],
    };
    const found = rulesFor(model, "relationship-circular");
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain("→");
  });

  it("does not treat a self-reference as a cycle", () => {
    const model: DiagramModel = {
      tables: [
        table("t1", "nodes", [pk("id", { id: "n-id" }), col("parent_id", { id: "n-p" })]),
      ],
      relationships: [
        rel({ id: "r1", sourceTableId: "t1", sourceColumnId: "n-p", targetTableId: "t1", targetColumnId: "n-id" }),
      ],
    };
    expect(rules(model)).not.toContain("relationship-circular");
  });
});

// ─── Enums & table groups ────────────────────────────────────────────────────

describe("enum and table-group rules", () => {
  const enumOf = (overrides: Partial<CanvasEnum> = {}): CanvasEnum => ({
    id: "e1",
    name: "order_status",
    values: [{ name: "pending" }, { name: "shipped" }],
    ...overrides,
  });

  it("flags an enum with no values and an unnamed enum", () => {
    const model: DiagramModel = {
      tables: [table("t1", "orders", [pk("id", { id: "o-id", type: "order_status" })])],
      relationships: [],
      enums: [enumOf({ values: [] }), enumOf({ id: "e2", name: "" })],
    };
    expect(rules(model)).toContain("enum-no-values");
    expect(rules(model)).toContain("enum-name-empty");
  });

  it("flags duplicate enum names and duplicate values", () => {
    const model: DiagramModel = {
      tables: [table("t1", "orders", [pk("id", { id: "o-id", type: "order_status" })])],
      relationships: [],
      enums: [
        enumOf(),
        enumOf({ id: "e2", values: [{ name: "pending" }, { name: "PENDING" }] }),
      ],
    };
    expect(rulesFor(model, "enum-name-duplicate")).toHaveLength(2);
    expect(rulesFor(model, "enum-duplicate-value")).toHaveLength(1);
  });

  it("matches enum usage across a Code-tab round-trip", () => {
    // parsedTablesToCanvasTables uppercases types, the enum keeps its own case.
    const model: DiagramModel = {
      tables: [table("t1", "orders", [pk("id", { id: "o-id", type: "ORDER_STATUS" })])],
      relationships: [],
      enums: [enumOf()],
    };
    expect(rules(model)).not.toContain("enum-unused");
  });

  it("flags an enum no column uses", () => {
    const model: DiagramModel = {
      tables: [table("t1", "orders", [pk("id", { id: "o-id" })])],
      relationships: [],
      enums: [enumOf()],
    };
    expect(rules(model)).toContain("enum-unused");
  });

  it("flags a table group listing a table that no longer exists", () => {
    const model: DiagramModel = {
      tables: [table("t1", "users", [pk()])],
      relationships: [],
      tableGroups: [{ id: "g1", name: "core", tableNames: ["users", "profiles"] }],
    };
    const found = rulesFor(model, "table-group-unknown-member");
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain("profiles");
  });
});

// ─── Counts & memo key ───────────────────────────────────────────────────────

describe("countIssues", () => {
  it("totals by severity", () => {
    const model: DiagramModel = {
      tables: [
        table("t1", "alpha", [col("a", { id: "a", type: "" })]),
        table("t2", "beta", [pk()]),
      ],
      relationships: [],
    };
    const counts = countIssues(analyzeDiagram(model));
    expect(counts.total).toBe(counts.error + counts.warning + counts.info);
    expect(counts.error).toBeGreaterThan(0);
  });
});

describe("issuesSignature", () => {
  it("is stable when a table only moves", () => {
    const before = cleanModel();
    const after = cleanModel();
    after.tables[0] = { ...after.tables[0], x: 900, y: -120, color: "#fff" };
    expect(issuesSignature(after)).toBe(issuesSignature(before));
  });

  it("changes when a constraint flag flips", () => {
    const before = cleanModel();
    const after = cleanModel();
    after.tables[0].columns[0] = { ...after.tables[0].columns[0], isUnique: false };
    expect(issuesSignature(after)).not.toBe(issuesSignature(before));
  });

  it("changes when a referential action changes", () => {
    const before = cleanModel();
    const after = cleanModel();
    after.relationships[0].onDelete = "Cascade";
    expect(issuesSignature(after)).not.toBe(issuesSignature(before));
  });

  it("does not collide across differently-shaped schemas", () => {
    const a: DiagramModel = {
      tables: [table("t1", "a_b", [pk("id", { id: "x" })])],
      relationships: [],
    };
    const b: DiagramModel = {
      tables: [table("t1", "a", [pk("b", { id: "x" })])],
      relationships: [],
    };
    expect(issuesSignature(a)).not.toBe(issuesSignature(b));
  });
});
