import { beforeEach, describe, expect, it } from "vitest";

import {
  buildCrossGroupStubs,
  crossGroupStubLabel,
  emptiedAreaIds,
  filterVisibleTables,
  hiddenGroupsOf,
  renameInHiddenSet,
} from "@/lib/schema-visibility";
import { buildGrouping } from "@/lib/table-grouping";
import { NO_SCHEMA_KEY } from "@/lib/schema-namespace";
import { generateDbmlFromCanvas } from "@/lib/generator/dbml-generator";
import { generateSqlFromCanvas } from "@/lib/generator/sql-generator";
import { EMPTY_HIDDEN, getGroupSource, getHiddenSchemas, useEditorStore } from "@/store/useEditorStore";
import type { Table } from "@/store/useCanvasStore";

const table = (id: string, name: string, x = 0, y = 0): Table => ({
  id,
  name,
  x,
  y,
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

const bySchema = buildGrouping("schema", TABLES, [], []).keyByTableId;

describe("filterVisibleTables", () => {
  it("returns the same array when nothing is hidden", () => {
    expect(filterVisibleTables(TABLES, [], bySchema)).toBe(TABLES);
  });

  it("drops tables in hidden groups, including the unqualified bucket", () => {
    const visible = filterVisibleTables(TABLES, ["auth", NO_SCHEMA_KEY], bySchema);
    expect(visible.map((t) => t.id)).toEqual(["t3"]);
  });

  it("ignores stale keys without crashing, and keeps identity when they match nothing", () => {
    expect(filterVisibleTables(TABLES, ["gone", "also_gone"], bySchema)).toBe(TABLES);
    expect(filterVisibleTables(TABLES, ["gone", "billing"], bySchema).map((t) => t.id)).toEqual(["t1", "t2", "t4"]);
  });

  it("keeps a table the index doesn't know yet visible", () => {
    const added = [...TABLES, table("t5", "auth.new")];
    expect(filterVisibleTables(added, ["auth"], bySchema).map((t) => t.id)).toEqual(["t3", "t4", "t5"]);
  });
});

describe("hiddenGroupsOf", () => {
  it("lists only the hidden groups the given tables belong to, once each", () => {
    expect(hiddenGroupsOf(["t1", "t2", "t3"], bySchema, ["auth"])).toEqual(["auth"]);
    expect(hiddenGroupsOf(["t3"], bySchema, ["auth"])).toEqual([]);
    expect(hiddenGroupsOf(["missing"], bySchema, ["auth"])).toEqual([]);
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

describe("buildCrossGroupStubs", () => {
  const rel = (sourceTableId: string, sourceColumnId: string, targetTableId: string, targetColumnId: string) => ({
    sourceTableId,
    sourceColumnId,
    targetTableId,
    targetColumnId,
  });
  const rels = [
    rel("t2", "t2-uid", "t1", "t1-id"), // auth → auth
    rel("t3", "t3-uid", "t1", "t1-id"), // billing → auth
    rel("t4", "t4-uid", "t1", "t1-id"), // unqualified → auth
    rel("t4", "t4-inv", "t3", "t3-id"), // unqualified → billing
    rel("t3", "t3-x", "gone", "gone-id"), // dangling
  ];

  it("draws nothing when nothing is hidden", () => {
    expect(buildCrossGroupStubs(TABLES, rels, [], bySchema)).toEqual([]);
  });

  it("puts the stub on the visible end and collects the hidden ends per column", () => {
    const stubs = buildCrossGroupStubs(TABLES, rels, ["billing", NO_SCHEMA_KEY], bySchema);
    expect(stubs).toEqual([
      {
        tableId: "t1",
        columnId: "t1-id",
        targets: [
          { tableId: "t3", name: "billing.invoices", groupKey: "billing" },
          { tableId: "t4", name: "audit_log", groupKey: NO_SCHEMA_KEY },
        ],
      },
    ]);
  });

  it("works from the source side too, and skips both-visible, both-hidden and dangling", () => {
    const stubs = buildCrossGroupStubs(TABLES, rels, ["auth"], bySchema);
    expect(stubs.map((s) => [s.tableId, s.columnId, s.targets.map((t) => t.tableId)])).toEqual([
      ["t3", "t3-uid", ["t1"]],
      ["t4", "t4-uid", ["t1"]],
    ]);
    expect(buildCrossGroupStubs(TABLES, rels, ["auth", "billing", NO_SCHEMA_KEY], bySchema)).toEqual([]);
  });

  it("labels one table by name and many by count, naming the group through labelOf", () => {
    const labelOf = (key: string) => (key === "auth" ? "Auth" : key);
    const one = { tableId: "a", columnId: "c", targets: [{ tableId: "t1", name: "auth.users", groupKey: "auth" }] };
    expect(crossGroupStubLabel(one, labelOf)).toBe("auth.users");
    const sameGroup = { ...one, targets: [one.targets[0], { tableId: "t2", name: "auth.sessions", groupKey: "auth" }] };
    expect(crossGroupStubLabel(sameGroup, labelOf)).toBe("2 in Auth");
    const mixed = { ...one, targets: [one.targets[0], { tableId: "t4", name: "audit_log", groupKey: NO_SCHEMA_KEY }] };
    expect(crossGroupStubLabel(mixed, labelOf)).toBe("2 hidden tables");
  });
});

describe("emptiedAreaIds", () => {
  const size = () => ({ width: 100, height: 50 });
  const tables = [table("a", "auth.users", 0, 0), table("b", "billing.x", 500, 0)];
  const area = (id: string, x: number) => ({ id, x: x - 20, y: -20, width: 140, height: 90 });

  it("hides areas that frame only hidden tables, and keeps empty or mixed ones", () => {
    const areas = [area("around-a", 0), area("around-b", 500), { id: "empty", x: 2000, y: 0, width: 50, height: 50 }];
    expect([...emptiedAreaIds(areas, tables, new Set(["b"]), size)]).toEqual(["around-a"]);
    const both = { id: "both", x: -20, y: -20, width: 700, height: 90 };
    expect(emptiedAreaIds([both], tables, new Set(["b"]), size).size).toBe(0);
  });
});

describe("useEditorStore hidden schemas and group source", () => {
  beforeEach(() => {
    useEditorStore.setState({ activeDiagramId: "d1", hiddenSchemas: {}, groupBy: {} });
  });

  it("returns the shared empty sentinel for a diagram with nothing hidden", () => {
    expect(getHiddenSchemas()).toBe(EMPTY_HIDDEN);
    useEditorStore.getState().setSchemaHidden("auth", true);
    useEditorStore.getState().setSchemaHidden("auth", false);
    expect(getHiddenSchemas()).toBe(EMPTY_HIDDEN);
  });

  it("keeps each diagram's hidden set and group source separate", () => {
    useEditorStore.getState().setSchemaHidden("auth", true);
    useEditorStore.getState().setGroupBy("fkCluster");
    useEditorStore.setState({ activeDiagramId: "d2" });
    expect(getHiddenSchemas()).toBe(EMPTY_HIDDEN);
    expect(getGroupSource()).toBe("schema");
    useEditorStore.setState({ activeDiagramId: "d1" });
    expect(getHiddenSchemas()).toEqual(["auth"]);
    expect(getGroupSource()).toBe("fkCluster");
  });

  it("stores no entry for the default source", () => {
    useEditorStore.getState().setGroupBy("tableGroup");
    useEditorStore.getState().setGroupBy("schema");
    expect(useEditorStore.getState().groupBy).toEqual({});
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
  it("DBML and SQL include tables in hidden groups", () => {
    useEditorStore.setState({ activeDiagramId: "d1", hiddenSchemas: {} });
    useEditorStore.getState().setHiddenSchemas(["auth", "billing", NO_SCHEMA_KEY]);

    const dbml = generateDbmlFromCanvas(TABLES, []);
    for (const name of ["users", "sessions", "invoices", "audit_log"]) expect(dbml).toContain(name);

    const sql = generateSqlFromCanvas(TABLES, [], "postgres");
    expect(sql).not.toBeNull();
    for (const name of ["users", "sessions", "invoices", "audit_log"]) expect(sql).toContain(name);
  });
});
