import { describe, expect, it } from "vitest";

import { buildSchemaGraph, edgeWeight } from "@/lib/schema-graph";
import { NO_SCHEMA_KEY } from "@/lib/schema-namespace";

const tables = [
  { id: "u", name: "auth.users" },
  { id: "s", name: "auth.sessions" },
  { id: "i", name: "billing.invoices" },
  { id: "p", name: "billing.payments" },
  { id: "l", name: "audit_log" },
];

const rel = (id: string, sourceTableId: string, targetTableId: string) => ({ id, sourceTableId, targetTableId });

describe("buildSchemaGraph", () => {
  const graph = buildSchemaGraph(tables, [
    rel("r1", "s", "u"), // auth → auth: internal
    rel("r2", "i", "u"), // billing → auth
    rel("r3", "u", "p"), // auth → billing: same pair, other direction
    rel("r4", "p", "i"), // billing → billing: internal
    rel("r5", "l", "u"), // unqualified → auth
    rel("r6", "i", "gone"), // dangling endpoint: skipped
  ]);

  it("has one node per schema, in groupTablesBySchema order", () => {
    expect(graph.nodes.map((n) => [n.key, n.tableCount])).toEqual([
      ["auth", 2],
      ["billing", 2],
      [NO_SCHEMA_KEY, 1],
    ]);
    expect(graph.nodes[2].schema).toBeNull();
  });

  it("counts same-schema refs on the node instead of emitting a self-loop", () => {
    expect(graph.nodes.map((n) => n.internalRefs)).toEqual([1, 1, 0]);
    expect(graph.edges.some((e) => e.from === e.to)).toBe(false);
  });

  it("buckets both directions of a pair into one unordered edge", () => {
    expect(graph.edges).toEqual([
      { from: "auth", to: "billing", count: 2, relIds: ["r2", "r3"], tableIds: ["i", "u", "p"] },
      { from: "auth", to: NO_SCHEMA_KEY, count: 1, relIds: ["r5"], tableIds: ["l", "u"] },
    ]);
  });

  it("handles an empty diagram", () => {
    expect(buildSchemaGraph([], [])).toEqual({ nodes: [], edges: [] });
  });
});

describe("edgeWeight", () => {
  it("is bucketed and monotonic", () => {
    const weights = [1, 2, 3, 4, 9, 10, 29, 30, 200].map(edgeWeight);
    expect(weights).toEqual([...weights].sort((a, b) => a - b));
    expect(edgeWeight(60)).toBe(edgeWeight(30));
  });
});
