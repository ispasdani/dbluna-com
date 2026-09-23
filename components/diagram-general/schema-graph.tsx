"use client";

import { memo, useMemo, useState } from "react";

import { buildGroupGraph, edgeWeight, type GroupGraphEdge } from "@/lib/schema-graph";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/store/useCanvasStore";
import { useSchemaVisibility } from "./use-schema-visibility";
import styles from "./schemas-panel.module.scss";

// Drawn in a fixed viewBox and scaled to the panel's width.
const W = 360;
const H = 236;
const CX = W / 2;
const CY = H / 2;
const RING = 74;
const NODE_MIN = 9;
const NODE_MAX = 20;
const LABEL_CHARS = 14;

const clip = (s: string) => (s.length > LABEL_CHARS ? `${s.slice(0, LABEL_CHARS - 1)}…` : s);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const edgeId = (e: GroupGraphEdge) => `${e.from}\u0000${e.to}`;

/**
 * Which group talks to which — the entry point into a large diagram. Groups are
 * schemas, TableGroups or FK clusters, per the active source. Click a group to
 * show only it; click a line to show only that pair. Hidden groups stay on the
 * graph, dimmed: the graph is the map, not the view.
 *
 * A circular layout rather than dagre: for the handful of groups a real
 * database has, a ring is more readable and far simpler.
 *
 * Its own component, built from the shared grouping (which subscribes to ids +
 * names rather than `tables`), so a canvas drag — which rewrites `tables` on
 * every pointermove but never a name — doesn't rebuild the graph or re-render it.
 */
export const SchemaGraph = memo(function SchemaGraph() {
  const relationships = useCanvasStore((s) => s.relationships);
  const visibility = useSchemaVisibility();
  const { grouping, info } = visibility;
  const labelOf = grouping.labelOf;
  const [hover, setHover] = useState<{ node?: string; edge?: GroupGraphEdge } | null>(null);

  const graph = useMemo(() => buildGroupGraph(grouping, relationships), [grouping, relationships]);

  const layout = useMemo(() => {
    const n = graph.nodes.length;
    const maxTables = Math.max(1, ...graph.nodes.map((node) => node.tableCount));
    return new Map(
      graph.nodes.map((node, i) => {
        // Start at the top and go clockwise; two groups sit side by side.
        const angle = n === 2 ? (i === 0 ? Math.PI : 0) : -Math.PI / 2 + (i * 2 * Math.PI) / n;
        const r = NODE_MIN + (NODE_MAX - NODE_MIN) * Math.sqrt(node.tableCount / maxTables);
        return [node.key, { x: CX + RING * Math.cos(angle), y: CY + RING * Math.sin(angle), r, angle }];
      })
    );
  }, [graph]);

  if (graph.nodes.length < 2) return null;

  const onlyShown = visibility.shownCount === 1 ? visibility.entries.find((e) => !e.isHidden)?.key : undefined;

  // Clicking the group that is already the only one shown brings the rest
  // back, so the graph can undo what it did.
  const clickNode = (key: string) => {
    if (onlyShown === key) visibility.showAll();
    else visibility.showOnly(key);
  };

  const clickEdge = (edge: GroupGraphEdge) => {
    visibility.showOnly([edge.from, edge.to]);
    // Relationships select one at a time, so a single one is selected itself;
    // otherwise the tables carrying these keys are.
    const store = useCanvasStore.getState();
    if (edge.relIds.length === 1) store.setSelectedRelationshipId(edge.relIds[0]);
    else store.setSelectedTableIds(edge.tableIds);
  };

  const isNodeLit = (key: string) =>
    hover?.node === key ||
    (hover?.node !== undefined &&
      graph.edges.some((e) => (e.from === hover.node && e.to === key) || (e.to === hover.node && e.from === key))) ||
    (hover?.edge !== undefined && (hover.edge.from === key || hover.edge.to === key));
  const isEdgeLit = (e: GroupGraphEdge) =>
    hover?.edge === e || (hover?.node !== undefined && (e.from === hover.node || e.to === hover.node));

  const onKey = (e: React.KeyboardEvent, fn: () => void) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  };

  return (
    <div className={styles.graph}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={cn(styles.graphSvg, hover && styles.graphHovering)}
        role="group"
        aria-label={`${info.noun[0].toUpperCase()}${info.noun.slice(1)} graph`}
        onPointerLeave={() => setHover(null)}
      >
        {graph.edges.map((edge) => {
          const a = layout.get(edge.from)!;
          const b = layout.get(edge.to)!;
          // Bowed towards the centre, like a chord diagram, so lines between
          // neighbours don't run along the ring and hide behind the nodes.
          const qx = (a.x + b.x) / 2 + (CX - (a.x + b.x) / 2) * 0.45;
          const qy = (a.y + b.y) / 2 + (CY - (a.y + b.y) / 2) * 0.45;
          const d = `M${a.x},${a.y} Q${qx},${qy} ${b.x},${b.y}`;
          const hidden = visibility.isHidden(edge.from) || visibility.isHidden(edge.to);
          const title = `${labelOf(edge.from)} ↔ ${labelOf(edge.to)}: ${plural(edge.count, "relationship")}`;
          return (
            <g
              key={edgeId(edge)}
              className={cn(styles.graphEdge, hidden && styles.graphDim, isEdgeLit(edge) && styles.graphLit)}
              role="button"
              tabIndex={0}
              aria-label={`${title}. Show only these two ${info.plural}.`}
              onClick={() => clickEdge(edge)}
              onKeyDown={(e) => onKey(e, () => clickEdge(edge))}
              onPointerEnter={() => setHover({ edge })}
            >
              <title>{title}</title>
              {/* Wide invisible stroke: a 1px line is too thin to click. */}
              <path d={d} className={styles.graphEdgeHit} />
              <path d={d} className={styles.graphEdgeLine} style={{ strokeWidth: edgeWeight(edge.count) }} />
            </g>
          );
        })}

        {graph.nodes.map((node) => {
          const p = layout.get(node.key)!;
          const label = labelOf(node.key);
          const cos = Math.cos(p.angle);
          const sin = Math.sin(p.angle);
          const lx = p.x + (p.r + 6) * cos;
          const ly = p.y + (p.r + 6) * sin;
          const anchor = cos > 0.35 ? "start" : cos < -0.35 ? "end" : "middle";
          // Top and bottom labels clear the node vertically instead.
          const dy = anchor !== "middle" ? "0.35em" : sin < 0 ? "-0.2em" : "0.9em";
          const hidden = visibility.isHidden(node.key);
          const title = `${label}: ${plural(node.tableCount, "table")}, ${plural(node.internalRefs, "internal relationship")}${
            hidden ? " (hidden)" : ""
          }`;
          return (
            <g
              key={node.key}
              className={cn(styles.graphNode, hidden && styles.graphDim, isNodeLit(node.key) && styles.graphLit)}
              role="button"
              tabIndex={0}
              aria-label={`${title}. ${onlyShown === node.key ? `Show all ${info.plural}.` : `Show only this ${info.noun}.`}`}
              aria-pressed={onlyShown === node.key}
              onClick={() => clickNode(node.key)}
              onKeyDown={(e) => onKey(e, () => clickNode(node.key))}
              onPointerEnter={() => setHover({ node: node.key })}
            >
              <title>{title}</title>
              <circle cx={p.x} cy={p.y} r={p.r} />
              <text x={p.x} y={p.y} dy="0.35em" textAnchor="middle" className={styles.graphCount}>
                {node.tableCount}
              </text>
              <text
                x={lx}
                y={ly}
                dy={dy}
                textAnchor={anchor}
                className={cn(styles.graphLabel, node.isRemainder && styles.graphUnqualified)}
              >
                {clip(label)}
              </text>
            </g>
          );
        })}
      </svg>
      <p className={styles.graphHint}>
        {graph.edges.length === 0
          ? `No relationships cross ${info.plural}. Click a ${info.noun} to show only it.`
          : `Click a ${info.noun} to show only it, or a line to show a pair. Thicker lines carry more relationships.`}
      </p>
    </div>
  );
});
