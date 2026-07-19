import { describe, it, expect } from "vitest";
import { generateDbmlFromCanvas } from "@/lib/generator/dbml-generator";
import { generateDocsMarkdown } from "@/lib/generator/docs-markdown";
import { parseDbml } from "@/lib/parser/dsl-parser";
import type { Table, Column, Relationship, CanvasEnum, CanvasProject } from "@/store/useCanvasStore";

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

function markdownFor(
  tables: Table[],
  relationships: Relationship[] = [],
  meta: { enums?: CanvasEnum[]; project?: CanvasProject | null } = {}
) {
  const parsed = parseDbml(generateDbmlFromCanvas(tables, relationships, meta));
  expect(parsed).not.toBeNull();
  return generateDocsMarkdown(parsed!);
}

describe("Markdown docs export", () => {
  it("renders the project title, database type and README note", () => {
    const project: CanvasProject = { name: "Shop", databaseType: "PostgreSQL", note: "My README" };
    const t = table({ name: "users", columns: [col({ name: "id", isPrimaryKey: true })] });
    const md = markdownFor([t], [], { project });

    expect(md).toContain("# Shop");
    expect(md).toContain("**Database:** PostgreSQL");
    expect(md).toContain("My README");
  });

  it("falls back to a default title when there is no project", () => {
    const t = table({ name: "users", columns: [col({ name: "id", isPrimaryKey: true })] });
    expect(markdownFor([t])).toContain("# Database Documentation");
  });

  it("renders a column table with constraints", () => {
    const t = table({
      name: "users",
      columns: [
        col({ name: "id", type: "INT", isPrimaryKey: true }),
        col({ name: "email", type: "VARCHAR", isUnique: true, isNotNull: true }),
      ],
    });
    const md = markdownFor([t]);

    expect(md).toContain("### users");
    expect(md).toContain("| Column | Type | Constraints | Note |");
    expect(md).toMatch(/\|\s*id\s*\|\s*INT\s*\|\s*PK\s*\|/);
    expect(md).toMatch(/\|\s*email\s*\|\s*VARCHAR\s*\|\s*unique, not null\s*\|/);
  });

  it("lists relationships under a table", () => {
    const users = table({ name: "users", columns: [col({ name: "id", isPrimaryKey: true })] });
    const orders = table({
      name: "orders",
      columns: [col({ name: "id", isPrimaryKey: true }), col({ name: "user_id" })],
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
    const md = markdownFor([users, orders], [rel]);

    expect(md).toContain("**Relationships**");
    expect(md).toContain("`orders.user_id` → `users.id`");
  });

  it("renders enums with value notes", () => {
    const enums: CanvasEnum[] = [
      {
        id: crypto.randomUUID(),
        name: "order_status",
        values: [{ name: "pending", note: "awaiting payment" }, { name: "shipped" }],
      },
    ];
    const t = table({ name: "orders", columns: [col({ name: "id", isPrimaryKey: true })] });
    const md = markdownFor([t], [], { enums });

    expect(md).toContain("## Enums");
    expect(md).toContain("### order_status");
    expect(md).toContain("`pending` — awaiting payment");
    expect(md).toContain("`shipped`");
  });
});
