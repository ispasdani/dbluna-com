import { beforeEach, describe, expect, it } from "vitest";

import {
  buildSchemaIndex,
  countTablesBySchema,
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
