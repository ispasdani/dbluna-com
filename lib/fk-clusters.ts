import type { Relationship } from "@/store/useCanvasStore";

/**
 * Foreign-key clusters: groups of tables that reference each other more than
 * they reference anything else — the grouping a database without schemas
 * (MySQL, SQLite: the database *is* the schema) never provides. See
 * release-1-0/schemas-tab-and-visibility-plan.md Phase 6.
 *
 * Louvain community detection over the undirected relationship graph. It never
 * joins disconnected tables, so connected components come for free, and it
 * splits a large component where its links are thin. Store-free and
 * deterministic: nodes are visited in input order and ties keep a node where it
 * is, so the same diagram always clusters the same way.
 *
 * Cost is a few passes over the edges — milliseconds at 428 tables / 672
 * relationships — and callers memoise it on names and relationships, never on
 * positions.
 */

export interface FkClusters {
  /** Clusters of two or more tables, each listed by descending degree. */
  clusters: string[][];
  /** Tables with no relationship to any other table. */
  isolated: string[];
  /** Weighted degree per table: how many relationships touch it. */
  degree: Map<string, number>;
}

const MAX_PASSES = 32;
const MAX_LEVELS = 16;

type Adjacency = Map<number, number>[];

export function findFkClusters(
  tableIds: readonly string[],
  relationships: readonly Pick<Relationship, "sourceTableId" | "targetTableId">[]
): FkClusters {
  const indexOf = new Map(tableIds.map((id, i) => [id, i]));
  const n = tableIds.length;

  // Undirected, weighted by how many relationships join the pair. Self
  // references say nothing about which tables belong together.
  let adj: Adjacency = Array.from({ length: n }, () => new Map());
  const degree = new Map<string, number>();
  for (const rel of relationships) {
    const a = indexOf.get(rel.sourceTableId);
    const b = indexOf.get(rel.targetTableId);
    if (a === undefined || b === undefined || a === b) continue;
    adj[a].set(b, (adj[a].get(b) ?? 0) + 1);
    adj[b].set(a, (adj[b].get(a) ?? 0) + 1);
    degree.set(rel.sourceTableId, (degree.get(rel.sourceTableId) ?? 0) + 1);
    degree.set(rel.targetTableId, (degree.get(rel.targetTableId) ?? 0) + 1);
  }

  const isolated = tableIds.filter((id) => !degree.has(id));
  if (isolated.length === n) return { clusters: [], isolated, degree };

  // membership[i] = the community of original node i, refined level by level.
  let membership = tableIds.map((_, i) => i);

  for (let level = 0; level < MAX_LEVELS; level++) {
    const community = localMoving(adj);
    const count = renumber(community);
    if (count === adj.length) break; // no node moved: converged

    membership = membership.map((c) => community[c]);
    adj = aggregate(adj, community, count);
  }

  const byCommunity = new Map<number, string[]>();
  membership.forEach((c, i) => {
    const id = tableIds[i];
    if (!degree.has(id)) return;
    const bucket = byCommunity.get(c);
    if (bucket) bucket.push(id);
    else byCommunity.set(c, [id]);
  });

  const clusters = mergeSingletons([...byCommunity.values()], relationships);
  const byDegree = (a: string, b: string) => (degree.get(b) ?? 0) - (degree.get(a) ?? 0);
  return { clusters: clusters.map((c) => c.sort(byDegree)), isolated, degree };
}

/** Louvain phase one: move each node to the neighbouring community that most raises modularity. */
function localMoving(adj: Adjacency): number[] {
  const n = adj.length;
  const community = Array.from({ length: n }, (_, i) => i);
  // Weighted degree. An aggregated node's self-loop holds its internal edges
  // counted from both ends, which is exactly their share of the degree.
  const k = adj.map((edges) => sum(edges.values()));
  const tot = [...k];
  const m2 = sum(k.values());
  if (m2 === 0) return community;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      const own = community[i];
      const links = new Map<number, number>();
      for (const [j, w] of adj[i]) {
        if (j === i) continue;
        links.set(community[j], (links.get(community[j]) ?? 0) + w);
      }

      tot[own] -= k[i];
      let best = own;
      let bestGain = (links.get(own) ?? 0) - (tot[own] * k[i]) / m2;
      for (const [c, w] of links) {
        const gain = w - (tot[c] * k[i]) / m2;
        if (gain > bestGain + 1e-12) {
          best = c;
          bestGain = gain;
        }
      }
      tot[best] += k[i];
      if (best !== own) {
        community[i] = best;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return community;
}

/** Relabels communities 0..count-1 in order of first appearance; returns count. */
function renumber(community: number[]): number {
  const ids = new Map<number, number>();
  for (let i = 0; i < community.length; i++) {
    let id = ids.get(community[i]);
    if (id === undefined) {
      id = ids.size;
      ids.set(community[i], id);
    }
    community[i] = id;
  }
  return ids.size;
}

/** Louvain phase two: one node per community, edges summed, internal edges as self-loops. */
function aggregate(adj: Adjacency, community: number[], count: number): Adjacency {
  const next: Adjacency = Array.from({ length: count }, () => new Map());
  adj.forEach((edges, i) => {
    const ci = community[i];
    for (const [j, w] of edges) {
      const cj = community[j];
      next[ci].set(cj, (next[ci].get(cj) ?? 0) + w);
    }
  });
  return next;
}

/**
 * A connected table can still end up alone in its community. A cluster of one
 * is noise in a list of groups, so it joins the community it has most
 * relationships with.
 */
function mergeSingletons(
  communities: string[][],
  relationships: readonly Pick<Relationship, "sourceTableId" | "targetTableId">[]
): string[][] {
  const singles = communities.filter((c) => c.length === 1).map((c) => c[0]);
  if (singles.length === 0) return communities;

  const groups = communities.filter((c) => c.length > 1).map((c) => [...c]);
  const groupOf = new Map<string, number>();
  groups.forEach((g, i) => g.forEach((id) => groupOf.set(id, i)));

  const leftovers: string[] = [];
  for (const id of singles) {
    const weights = new Map<number, number>();
    for (const rel of relationships) {
      const other = rel.sourceTableId === id ? rel.targetTableId : rel.targetTableId === id ? rel.sourceTableId : null;
      if (other === null || other === id) continue;
      const g = groupOf.get(other);
      if (g !== undefined) weights.set(g, (weights.get(g) ?? 0) + 1);
    }
    let best = -1;
    let bestWeight = 0;
    for (const [g, w] of weights) {
      if (w > bestWeight) {
        best = g;
        bestWeight = w;
      }
    }
    if (best === -1) leftovers.push(id);
    else {
      groups[best].push(id);
      groupOf.set(id, best);
    }
  }

  // Singletons whose only neighbours were other singletons. Louvain always
  // pairs two tables joined only to each other, so this is close to
  // unreachable; they stay on their own rather than being lumped together.
  for (const id of leftovers) groups.push([id]);
  return groups;
}

function sum(values: Iterable<number>): number {
  let total = 0;
  for (const v of values) total += v;
  return total;
}
