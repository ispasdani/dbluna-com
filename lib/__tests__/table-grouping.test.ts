import { describe, expect, it } from "vitest";

import { findFkClusters } from "@/lib/fk-clusters";
import { FK_NONE_KEY, TG_NONE_KEY, buildGrouping } from "@/lib/table-grouping";
import { NO_SCHEMA_KEY } from "@/lib/schema-namespace";

const rel = (sourceTableId: string, targetTableId: string) => ({ sourceTableId, targetTableId });

/** Two dense cliques joined by a single bridge, plus two loose tables. */
function twoCommunities() {
  const a = ["a1", "a2", "a3", "a4"];
  const b = ["b1", "b2", "b3", "b4"];
  const rels = [];
  for (const group of [a, b]) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) rels.push(rel(group[i], group[j]));
    }
  }
  rels.push(rel("a1", "b1")); // the bridge
  rels.push(rel("a2", "a2")); // self reference: ignored
  return { ids: [...a, ...b, "lone1", "lone2"], rels };
}

describe("findFkClusters", () => {
  it("splits two communities joined by a bridge, and sets isolated tables aside", () => {
    const { ids, rels } = twoCommunities();
    const { clusters, isolated } = findFkClusters(ids, rels);
    expect(isolated).toEqual(["lone1", "lone2"]);
    expect(clusters.map((c) => [...c].sort())).toEqual([
      ["a1", "a2", "a3", "a4"],
      ["b1", "b2", "b3", "b4"],
    ]);
  });

  it("lists each cluster's most connected table first", () => {
    const { ids, rels } = twoCommunities();
    const { clusters } = findFkClusters(ids, rels);
    // a1 and b1 carry the bridge on top of their clique edges.
    expect(clusters.map((c) => c[0])).toEqual(["a1", "b1"]);
  });

  it("keeps separate components separate and never leaves a cluster of one", () => {
    const ids = ["x1", "x2", "y1", "y2", "y3"];
    const { clusters } = findFkClusters(ids, [rel("x1", "x2"), rel("y1", "y2"), rel("y2", "y3")]);
    expect(clusters.map((c) => [...c].sort())).toEqual([
      ["x1", "x2"],
      ["y1", "y2", "y3"],
    ]);
    expect(clusters.every((c) => c.length > 1)).toBe(true);
  });

  it("is deterministic", () => {
    const { ids, rels } = twoCommunities();
    expect(findFkClusters(ids, rels)).toEqual(findFkClusters(ids, rels));
  });

  it("handles no relationships and no tables", () => {
    expect(findFkClusters(["a", "b"], []).clusters).toEqual([]);
    expect(findFkClusters([], []).isolated).toEqual([]);
  });
});

describe("buildGrouping", () => {
  const tables = [
    { id: "u", name: "auth.users" },
    { id: "s", name: "auth.sessions" },
    { id: "i", name: "billing.invoices" },
    { id: "l", name: "audit_log" },
  ];

  it("by schema: groupTablesBySchema order, unqualified as the remainder", () => {
    const g = buildGrouping("schema", tables, [], []);
    expect(g.groups.map((x) => [x.key, x.tableIds, x.isRemainder])).toEqual([
      ["auth", ["u", "s"], false],
      ["billing", ["i"], false],
      [NO_SCHEMA_KEY, ["l"], true],
    ]);
    expect(g.keyByTableId.get("s")).toBe("auth");
    expect(g.labelOf(NO_SCHEMA_KEY)).toBe("(no schema)");
  });

  it("by table group: declared order, first group wins, the rest in the remainder", () => {
    const groups = [
      { id: "g1", name: "Billing", tableNames: ["billing.invoices", "missing"] },
      { id: "g2", name: "Core", tableNames: ["auth.users", "billing.invoices"] },
      { id: "g3", name: "Ghost", tableNames: ["nope"] },
    ];
    const g = buildGrouping("tableGroup", tables, [], groups);
    expect(g.groups.map((x) => [x.label, x.tableIds])).toEqual([
      ["Billing", ["i"]],
      ["Core", ["u"]],
      ["Not in a group", ["s", "l"]],
    ]);
    expect(g.groups[2].key).toBe(TG_NONE_KEY);
  });

  it("by FK cluster: largest first, named after its hub, loose tables in the remainder", () => {
    const g = buildGrouping("fkCluster", tables, [rel("s", "u"), rel("i", "u")], []);
    expect(g.groups.map((x) => [x.label, [...x.tableIds].sort()])).toEqual([
      ["auth.users", ["i", "s", "u"]],
      ["No relationships", ["l"]],
    ]);
    expect(g.groups[1].key).toBe(FK_NONE_KEY);
  });

  it("namespaces keys so sources never collide in the shared hidden set", () => {
    const schemaKeys = buildGrouping("schema", tables, [], []).groups.map((x) => x.key);
    const clusterKeys = buildGrouping("fkCluster", tables, [rel("s", "u")], []).groups.map((x) => x.key);
    const groupKeys = buildGrouping("tableGroup", tables, [], [{ id: "g", name: "auth", tableNames: ["auth.users"] }])
      .groups.map((x) => x.key);
    const all = [...schemaKeys, ...clusterKeys, ...groupKeys];
    expect(new Set(all).size).toBe(all.length);
  });
});
