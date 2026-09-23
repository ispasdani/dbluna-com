import { beforeEach, describe, expect, it } from "vitest";

import {
  buildCrossSchemaStubs,
  buildSchemaIndex,
  countTablesBySchema,
  crossSchemaStubLabel,
  filterVisibleTables,
  hiddenSchemasOf,
  renameInHiddenSet,
  tableSchemaKey,
} from "@/lib/schema-visibility";
import { NO_SCHEMA_KEY } from "@/lib/schema-namespace";
import { generateDbmlFromCanvas } from "@/lib/generator/dbml-generator";
import { generateSqlFromCanvas } from "@/lib/generator/sql-generator";
import { EMPTY_HIDDEN, getHiddenSchemas, useEditorStore } from "@/store/useEditorStore";
import type { Table } from "@/store/useCanvasStore";

const table = (id: string, name: string): Table => ({
  id,
  name,
  x: 0,
  y: 0,
  color: "#6366f1",
  columns: [
    { id: `${id}-id`, name: "id", type: "INT", isPrimaryKey: true, isNotNull: true, isUnique: true, isAutoIncrement: false },
  ],
});

const TABLES: Table[] = [
  table("t1", "auth.users"),
  table("t2", "auth.sessions"),
  table("t3", "billing.invoices"),
  table("t4", "audit_log"),
];

describe("tableSchemaKey", () => {
  it("keys qualified tables by schema and unqualified ones by NO_SCHEMA_KEY", () => {
    expect(tableSchemaKey(TABLES[0])).toBe("auth");
    expect(tableSchemaKey(TABLES[3])).toBe(NO_SCHEMA_KEY);
  });
});

describe("filterVisibleTables", () => {
  it("returns the same array when nothing is hidden", () => {
    expect(filterVisibleTables(TABLES, [])).toBe(TABLES);
  });

  it("drops tables in hidden schemas, including the unqualified bucket", () => {
    const visible = filterVisibleTables(TABLES, ["auth", NO_SCHEMA_KEY]);
    expect(visible.map((t) => t.id)).toEqual(["t3"]);
  });

  it("agrees with a prebuilt index", () => {
    const index = buildSchemaIndex(TABLES);
    expect(filterVisibleTables(TABLES, ["billing"], index)).toEqual(filterVisibleTables(TABLES, ["billing"]));
  });

  it("ignores stale names without crashing, and keeps identity when they match nothing", () => {
    expect(filterVisibleTables(TABLES, ["gone", "also_gone"])).toBe(TABLES);
    expect(filterVisibleTables(TABLES, ["gone", "billing"]).map((t) => t.id)).toEqual(["t1", "t2", "t4"]);
  });
});

describe("hiddenSchemasOf", () => {
  it("lists only the hidden schemas the given tables belong to, once each", () => {
    expect(hiddenSchemasOf(["t1", "t2", "t3"], TABLES, ["auth"])).toEqual(["auth"]);
    expect(hiddenSchemasOf(["t3"], TABLES, ["auth"])).toEqual([]);
    expect(hiddenSchemasOf(["missing"], TABLES, ["auth"])).toEqual([]);
  });
});

describe("renameInHiddenSet", () => {
  it("rewrites the renamed schema", () => {
    expect(renameInHiddenSet(["auth", "billing"], "auth", "identity")).toEqual(["billing", "identity"]);
  });

  it("is a no-op, by identity, when the renamed schema isn't hidden", () => {
    const hidden = ["billing"];
    expect(renameInHiddenSet(hidden, "auth", "identity")).toBe(hidden);
    expect(renameInHiddenSet(EMPTY_HIDDEN, "auth", "identity")).toBe(EMPTY_HIDDEN);
  });
});

describe("countTablesBySchema", () => {
  it("counts per schema in groupTablesBySchema order, unqualified last", () => {
    expect(countTablesBySchema(["billing.a", "Auth.b", "loose", "auth.c", "billing.d"])).toEqual([
      { schema: "Auth", key: "Auth", tableCount: 1 },
      { schema: "auth", key: "auth", tableCount: 1 },
      { schema: "billing", key: "billing", tableCount: 2 },
      { schema: null, key: NO_SCHEMA_KEY, tableCount: 1 },
    ]);
  });

  it("omits the unqualified bucket when empty, and handles no tables", () => {
    expect(countTablesBySchema(["a.x"]).map((c) => c.key)).toEqual(["a"]);
    expect(countTablesBySchema([])).toEqual([]);
  });
});

describe("buildCrossSchemaStubs", () => {
  const rel = (sourceTableId: string, sourceColumnId: string, targetTableId: string, targetColumnId: string) => ({
    sourceTableId,
    sourceColumnId,
    targetTableId,
    targetColumnId,
  });
  // t1 auth.users, t2 auth.sessions, t3 billing.invoices, t4 audit_log
  const rels = [
    rel("t2", "t2-uid", "t1", "t1-id"), // auth → auth
    rel("t3", "t3-uid", "t1", "t1-id"), // billing → auth
    rel("t4", "t4-uid", "t1", "t1-id"), // unqualified → auth
    rel("t4", "t4-inv", "t3", "t3-id"), // unqualified → billing
    rel("t3", "t3-x", "gone", "gone-id"), // dangling
  ];

  it("draws nothing when nothing is hidden", () => {
    expect(buildCrossSchemaStubs(TABLES, rels, [])).toEqual([]);
  });

  it("puts the stub on the visible end and collects the hidden ends per column", () => {
    // Showing only auth: users.id is referenced from billing and the unqualified bucket.
    const stubs = buildCrossSchemaStubs(TABLES, rels, ["billing", NO_SCHEMA_KEY]);
    expect(stubs).toEqual([
      {
        tableId: "t1",
        columnId: "t1-id",
        targets: [
          { tableId: "t3", name: "billing.invoices", schemaKey: "billing" },
          { tableId: "t4", name: "audit_log", schemaKey: NO_SCHEMA_KEY },
        ],
      },
    ]);
  });

  it("works from the source side too, and skips both-visible, both-hidden and dangling", () => {
    const stubs = buildCrossSchemaStubs(TABLES, rels, ["auth"]);
    expect(stubs.map((s) => [s.tableId, s.columnId, s.targets.map((t) => t.tableId)])).toEqual([
      ["t3", "t3-uid", ["t1"]],
      ["t4", "t4-uid", ["t1"]],
    ]);
    expect(buildCrossSchemaStubs(TABLES, rels, ["auth", "billing", NO_SCHEMA_KEY])).toEqual([]);
  });

  it("labels one table by name and many by count", () => {
    const one = { tableId: "a", columnId: "c", targets: [{ tableId: "t1", name: "auth.users", schemaKey: "auth" }] };
    expect(crossSchemaStubLabel(one)).toBe("auth.users");
    const sameSchema = {
      ...one,
      targets: [one.targets[0], { tableId: "t2", name: "auth.sessions", schemaKey: "auth" }],
    };
    expect(crossSchemaStubLabel(sameSchema)).toBe("2 in auth");
    const mixed = { ...one, targets: [one.targets[0], { tableId: "t4", name: "audit_log", schemaKey: NO_SCHEMA_KEY }] };
    expect(crossSchemaStubLabel(mixed)).toBe("2 hidden tables");
  });
});

describe("useEditorStore hidden schemas", () => {
  beforeEach(() => {
    useEditorStore.setState({ activeDiagramId: "d1", hiddenSchemas: {} });
  });

  it("returns the shared empty sentinel for a diagram with nothing hidden", () => {
    expect(getHiddenSchemas()).toBe(EMPTY_HIDDEN);
    useEditorStore.getState().setSchemaHidden("auth", true);
    useEditorStore.getState().setSchemaHidden("auth", false);
    expect(getHiddenSchemas()).toBe(EMPTY_HIDDEN);
  });

  it("keeps each diagram's hidden set separate", () => {
    useEditorStore.getState().setSchemaHidden("auth", true);
    useEditorStore.setState({ activeDiagramId: "d2" });
    expect(getHiddenSchemas()).toBe(EMPTY_HIDDEN);
    useEditorStore.setState({ activeDiagramId: "d1" });
    expect(getHiddenSchemas()).toEqual(["auth"]);
  });

  it("renameHiddenSchema keeps a hidden schema hidden under its new name", () => {
    useEditorStore.getState().setHiddenSchemas(["auth", "billing"]);
    useEditorStore.getState().renameHiddenSchema("auth", "identity");
    expect([...getHiddenSchemas()].sort()).toEqual(["billing", "identity"]);
  });

  it("renameHiddenSchema with nothing hidden writes nothing", () => {
    const before = useEditorStore.getState().hiddenSchemas;
    useEditorStore.getState().renameHiddenSchema("auth", "identity");
    expect(useEditorStore.getState().hiddenSchemas).toBe(before);
  });
});

// Visibility is a view: the model the exporters read is untouched, so DBML and
// SQL always carry every table, hidden or not. Only the SVG export is cropped.
describe("exports ignore visibility", () => {
  it("DBML and SQL include tables in hidden schemas", () => {
    useEditorStore.setState({ activeDiagramId: "d1", hiddenSchemas: {} });
    useEditorStore.getState().setHiddenSchemas(["auth", "billing", NO_SCHEMA_KEY]);

    const dbml = generateDbmlFromCanvas(TABLES, []);
    for (const name of ["users", "sessions", "invoices", "audit_log"]) expect(dbml).toContain(name);

    const sql = generateSqlFromCanvas(TABLES, [], "postgres");
    expect(sql).not.toBeNull();
    for (const name of ["users", "sessions", "invoices", "audit_log"]) expect(sql).toContain(name);
  });
});
