import type { Relationship } from "@/store/useCanvasStore";
import type { TableGrouping } from "@/lib/table-grouping";

/**
 * The group graph: which group talks to which, and how much. One node per
 * group — schema, TableGroup or FK cluster, whatever the active source is — and
 * one edge per pair of groups joined by at least one relationship.
 *
 * Store-free so it can be unit-tested under vitest's `node` environment, the
 * same reasoning as lib/auto-arrange.ts. See
 * release-1-0/schemas-tab-and-visibility-plan.md Phases 3 and 6.
 */

export interface GroupGraphNode {
  /** The group key — what edges and the hidden set refer to. */
  key: string;
  label: string;
  tableCount: number;
  /** Relationships with both ends inside this group. */
  internalRefs: number;
  isRemainder: boolean;
}

export interface GroupGraphEdge {
  from: string;
  to: string;
  count: number;
  relIds: string[];
  /** Every table either end of these relationships sits on. */
  tableIds: string[];
}

export interface GroupGraph {
  nodes: GroupGraphNode[];
  edges: GroupGraphEdge[];
}

/**
 * Builds the graph. Node order is the grouping's order, so the graph reads in
 * the same order as the list beside it; each edge's `from` is the endpoint that
 * comes first in that order, which makes the pair unordered.
 *
 * Same-group relationships add to the node's `internalRefs` instead of becoming
 * a self-loop: a loop on a node is noise, a number on it is information.
 * Relationships with an endpoint no group knows are skipped.
 */
export function buildGroupGraph(
  grouping: Pick<TableGrouping, "groups" | "keyByTableId">,
  relationships: readonly Pick<Relationship, "id" | "sourceTableId" | "targetTableId">[]
): GroupGraph {
  const nodes: GroupGraphNode[] = grouping.groups.map((g) => ({
    key: g.key,
    label: g.label,
    tableCount: g.tableIds.length,
    internalRefs: 0,
    isRemainder: g.isRemainder,
  }));
  const order = new Map(nodes.map((n, i) => [n.key, i]));
  const nodeByKey = new Map(nodes.map((n) => [n.key, n]));
  const keyOfTable = grouping.keyByTableId;

  const edges = new Map<string, GroupGraphEdge & { tableSet: Set<string> }>();
  for (const rel of relationships) {
    const a = keyOfTable.get(rel.sourceTableId);
    const b = keyOfTable.get(rel.targetTableId);
    if (a === undefined || b === undefined) continue;

    if (a === b) {
      nodeByKey.get(a)!.internalRefs++;
      continue;
    }

    const [from, to] = order.get(a)! < order.get(b)! ? [a, b] : [b, a];
    const id = `${from}\u0000${to}`;
    let edge = edges.get(id);
    if (!edge) {
      edge = { from, to, count: 0, relIds: [], tableIds: [], tableSet: new Set() };
      edges.set(id, edge);
    }
    edge.count++;
    edge.relIds.push(rel.id);
    edge.tableSet.add(rel.sourceTableId).add(rel.targetTableId);
  }

  return {
    nodes,
    edges: [...edges.values()]
      .map(({ tableSet, ...edge }) => ({ ...edge, tableIds: [...tableSet] }))
      .sort((x, y) => order.get(x.from)! - order.get(y.from)! || order.get(x.to)! - order.get(y.to)!),
  };
}

/**
 * Stroke width for an edge carrying `count` relationships. Bucketed, not
 * linear: one 60-relationship pair would otherwise flatten every other line to
 * a hairline.
 */
export function edgeWeight(count: number): number {
  if (count >= 30) return 5;
  if (count >= 10) return 3.5;
  if (count >= 4) return 2.5;
  if (count >= 2) return 1.75;
  return 1;
}
