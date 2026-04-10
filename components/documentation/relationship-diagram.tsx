"use client";

import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import dagre from "@dagrejs/dagre";
import { useDocumentationStore } from "@/store/useDocumentationStore";

// ─── Types ──────────────────────────────────────────────────────────────────────

interface GraphNode {
    id: string;
    label: string;
    isActive: boolean;
    fields: string[];  // We only show the FK / linked fields for compactness
    width: number;
    height: number;
    x: number;
    y: number;
}

interface GraphEdge {
    id: string;
    source: string;
    target: string;
    sourceField: string;
    targetField: string;
    // The cardinality markers to draw (e.g. "1" on source, "*" on target)
    sourceCardinality: string;
    targetCardinality: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const NODE_WIDTH = 180;
const NODE_HEADER_H = 36;
const NODE_FIELD_H = 28;
const NODE_PADDING_BOTTOM = 8;
const HORIZONTAL_SEP = 80;
const VERTICAL_SEP = 50;

// ─── Helpers ────────────────────────────────────────────────────────────────────

function calcNodeHeight(fieldCount: number) {
    return NODE_HEADER_H + fieldCount * NODE_FIELD_H + NODE_PADDING_BOTTOM;
}

function buildGraph(table: any, parsedDbml: any, tables: any[]) {
    // 1. Collect all refs involving our table
    const raw = parsedDbml.raw;
    let allRefs: any[] = [];
    if (raw.schemas) {
        raw.schemas.forEach((s: any) => {
            if (s.refs) allRefs.push(...s.refs);
        });
    }

    const relevantRefs = allRefs.filter((r: any) => {
        const eps = r.endpoints || [];
        return eps.some((ep: any) => ep.tableName === table.name);
    });

    if (relevantRefs.length === 0) return null;

    // 2. Build the node & edge sets
    const nodeMap = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];

    // Always add the active table
    const activeFields: string[] = [];

    relevantRefs.forEach((ref: any, idx: number) => {
        const eps = ref.endpoints || [];
        if (eps.length < 2) return;

        const ep1 = eps[0];
        const ep2 = eps[1];

        // The "other" table
        const otherEp = ep1.tableName === table.name ? ep2 : ep1;
        const thisEp = ep1.tableName === table.name ? ep1 : ep2;

        // Track linked fields for the active table
        if (!activeFields.includes(thisEp.fieldNames?.[0])) {
            activeFields.push(thisEp.fieldNames?.[0]);
        }

        // Create the other node if needed
        if (!nodeMap.has(otherEp.tableName)) {
            const otherTable = tables.find((t) => t.name === otherEp.tableName);
            const linkedFields = [otherEp.fieldNames?.[0]].filter(Boolean);
            nodeMap.set(otherEp.tableName, {
                id: otherEp.tableName,
                label: otherEp.tableName,
                isActive: false,
                fields: linkedFields,
                width: NODE_WIDTH,
                height: calcNodeHeight(linkedFields.length || 1),
                x: 0,
                y: 0,
            });
        } else {
            // Add additional fields
            const existing = nodeMap.get(otherEp.tableName)!;
            const f = otherEp.fieldNames?.[0];
            if (f && !existing.fields.includes(f)) {
                existing.fields.push(f);
                existing.height = calcNodeHeight(existing.fields.length);
            }
        }

        // Determine cardinality symbols
        let sourceCard = "1";
        let targetCard = "*";
        const rel = ep1.relation;
        if (rel === "1") { sourceCard = "1"; targetCard = "1"; }
        else if (rel === "*") { sourceCard = "*"; targetCard = "1"; }

        edges.push({
            id: `edge-${idx}`,
            source: ep1.tableName,
            target: ep2.tableName,
            sourceField: ep1.fieldNames?.[0] || "",
            targetField: ep2.fieldNames?.[0] || "",
            sourceCardinality: sourceCard,
            targetCardinality: targetCard,
        });
    });

    // Add active table node
    const filteredFields = activeFields.filter(Boolean);
    nodeMap.set(table.name, {
        id: table.name,
        label: table.name,
        isActive: true,
        fields: filteredFields.length > 0 ? filteredFields : ["—"],
        width: NODE_WIDTH,
        height: calcNodeHeight(filteredFields.length || 1),
        x: 0,
        y: 0,
    });

    // 3. Layout with dagre
    const g = new dagre.graphlib.Graph();
    g.setGraph({
        rankdir: "LR",
        nodesep: VERTICAL_SEP,
        ranksep: HORIZONTAL_SEP,
        marginx: 40,
        marginy: 40,
    });
    g.setDefaultEdgeLabel(() => ({}));

    nodeMap.forEach((node) => {
        g.setNode(node.id, { width: node.width, height: node.height });
    });

    edges.forEach((edge) => {
        g.setEdge(edge.source, edge.target);
    });

    dagre.layout(g);

    // Apply positions
    g.nodes().forEach((id: string) => {
        const pos = g.node(id);
        const node = nodeMap.get(id);
        if (node && pos) {
            node.x = pos.x - node.width / 2;
            node.y = pos.y - node.height / 2;
        }
    });

    // Calculate edge paths using dagre's edge points
    const layoutEdges = edges.map((edge) => {
        const dagreEdge = g.edge(edge.source, edge.target);
        return { ...edge, points: dagreEdge?.points || [] };
    });

    return { nodes: Array.from(nodeMap.values()), edges: layoutEdges };
}

// ─── SVG Edge Rendering ─────────────────────────────────────────────────────────

function EdgePath({ edge, nodes }: { edge: GraphEdge & { points: Array<{ x: number; y: number }> }; nodes: GraphNode[] }) {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);
    if (!sourceNode || !targetNode) return null;

    // Use dagre's computed points for smooth paths
    const points = edge.points;
    if (!points || points.length < 2) {
        // Fallback: straight line from right edge of source to left edge of target
        const sx = sourceNode.x + sourceNode.width;
        const sy = sourceNode.y + sourceNode.height / 2;
        const tx = targetNode.x;
        const ty = targetNode.y + targetNode.height / 2;
        return (
            <g>
                <line x1={sx} y1={sy} x2={tx} y2={ty} stroke="url(#edgeGradient)" strokeWidth={1.5} />
            </g>
        );
    }

    // Bezier curve through points
    let d = `M ${points[0].x} ${points[0].y}`;
    if (points.length === 2) {
        d += ` L ${points[1].x} ${points[1].y}`;
    } else {
        // Use smooth quadratic approach through intermediate points
        for (let i = 1; i < points.length - 1; i++) {
            const cp = points[i];
            const next = points[i + 1];
            if (i === points.length - 2) {
                d += ` Q ${cp.x} ${cp.y} ${next.x} ${next.y}`;
            } else {
                const midX = (cp.x + next.x) / 2;
                const midY = (cp.y + next.y) / 2;
                d += ` Q ${cp.x} ${cp.y} ${midX} ${midY}`;
            }
        }
    }

    const edgeId = `edge-anim-${edge.id}`;

    return (
        <g>
            {/* Main edge line */}
            <path
                d={d}
                fill="none"
                stroke="var(--border)"
                strokeWidth={1.5}
                strokeLinecap="round"
                opacity={0.8}
            />
            {/* Animated flow particle */}
            <circle r={2.5} fill="var(--primary)" opacity={0.6}>
                <animateMotion
                    dur="4s"
                    repeatCount="indefinite"
                    path={d}
                />
            </circle>
            {/* Cardinality labels */}
            <text
                x={points[0].x + 8}
                y={points[0].y - 8}
                fill="var(--muted-foreground)"
                fontSize={10}
                fontFamily="monospace"
                fontWeight={600}
            >
                {edge.sourceCardinality}
            </text>
            <text
                x={points[points.length - 1].x - 14}
                y={points[points.length - 1].y - 8}
                fill="var(--muted-foreground)"
                fontSize={10}
                fontFamily="monospace"
                fontWeight={600}
            >
                {edge.targetCardinality}
            </text>
        </g>
    );
}

// ─── SVG Node Rendering ─────────────────────────────────────────────────────────

function NodeRect({ node, onClick }: { node: GraphNode; onClick: (name: string) => void }) {
    const borderColor = node.isActive ? "var(--primary)" : "var(--border)";
    const headerBg = node.isActive ? "var(--primary)" : "var(--muted)";
    const headerText = node.isActive ? "var(--primary-foreground)" : "var(--foreground)";
    const bodyBg = "var(--card)";
    const cornerRadius = 8;

    return (
        <g
            transform={`translate(${node.x}, ${node.y})`}
            style={{ cursor: node.isActive ? "default" : "pointer" }}
            onClick={() => !node.isActive && onClick(node.label)}
        >
            {/* Drop shadow */}
            <rect
                x={2}
                y={2}
                width={node.width}
                height={node.height}
                rx={cornerRadius}
                ry={cornerRadius}
                fill="rgba(0,0,0,0.08)"
            />
            {/* Body background */}
            <rect
                width={node.width}
                height={node.height}
                rx={cornerRadius}
                ry={cornerRadius}
                fill={bodyBg}
                stroke={borderColor}
                strokeWidth={node.isActive ? 2 : 1}
            />
            {/* Header clip + fill */}
            <clipPath id={`clip-header-${node.id}`}>
                <rect width={node.width} height={NODE_HEADER_H} rx={cornerRadius} ry={cornerRadius} />
                <rect width={node.width} height={NODE_HEADER_H / 2} y={NODE_HEADER_H / 2} />
            </clipPath>
            <rect
                width={node.width}
                height={NODE_HEADER_H}
                fill={headerBg}
                clipPath={`url(#clip-header-${node.id})`}
            />
            {/* Divider */}
            <line
                x1={0}
                y1={NODE_HEADER_H}
                x2={node.width}
                y2={NODE_HEADER_H}
                stroke={borderColor}
                strokeWidth={node.isActive ? 2 : 1}
            />
            {/* Table name */}
            <text
                x={node.width / 2}
                y={NODE_HEADER_H / 2 + 1}
                textAnchor="middle"
                dominantBaseline="central"
                fill={headerText}
                fontSize={12}
                fontWeight={600}
                fontFamily="system-ui, -apple-system, sans-serif"
            >
                {node.label}
            </text>
            {/* Field rows */}
            {node.fields.map((field, i) => (
                <g key={field + i} transform={`translate(0, ${NODE_HEADER_H + i * NODE_FIELD_H})`}>
                    {/* Hover band */}
                    <rect
                        x={1}
                        y={0}
                        width={node.width - 2}
                        height={NODE_FIELD_H}
                        fill="transparent"
                        rx={2}
                    />
                    {/* Field name */}
                    <text
                        x={12}
                        y={NODE_FIELD_H / 2}
                        dominantBaseline="central"
                        fill="var(--foreground)"
                        fontSize={11}
                        fontFamily="'Consolas', 'Courier New', monospace"
                        opacity={0.8}
                    >
                        {field}
                    </text>
                    {/* FK icon dot */}
                    <circle
                        cx={node.width - 16}
                        cy={NODE_FIELD_H / 2}
                        r={3}
                        fill={node.isActive ? "var(--primary)" : "var(--muted-foreground)"}
                        opacity={0.4}
                    />
                </g>
            ))}
        </g>
    );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export const RelationshipDiagram = ({ table }: { table: any }) => {
    const { parsedDbml, tables, setSelectedTableId } = useDocumentationStore();
    const containerRef = useRef<HTMLDivElement>(null);
    const [viewBox, setViewBox] = useState("0 0 800 400");

    const graph = useMemo(() => {
        if (!table || !parsedDbml) return null;
        return buildGraph(table, parsedDbml, tables);
    }, [table, parsedDbml, tables]);

    // Calculate viewBox based on computed layout
    useEffect(() => {
        if (!graph) return;
        const { nodes } = graph;
        if (nodes.length === 0) return;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        nodes.forEach((n) => {
            minX = Math.min(minX, n.x);
            minY = Math.min(minY, n.y);
            maxX = Math.max(maxX, n.x + n.width);
            maxY = Math.max(maxY, n.y + n.height);
        });

        const padding = 40;
        const w = maxX - minX + padding * 2;
        const h = maxY - minY + padding * 2;
        setViewBox(`${minX - padding} ${minY - padding} ${w} ${h}`);
    }, [graph]);

    const handleNodeClick = useCallback((name: string) => {
        const target = tables.find((t) => t.name === name);
        if (target) setSelectedTableId(target.id);
    }, [tables, setSelectedTableId]);

    if (!graph || graph.nodes.length <= 1) return null;

    return (
        <div
            ref={containerRef}
            className="mt-6 rounded-xl border border-border bg-sidebar/50 overflow-hidden backdrop-blur-sm"
            style={{ minHeight: 200 }}
        >
            {/* Mini toolbar */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/50 bg-sidebar/80">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-[11px] font-medium text-muted-foreground tracking-wide">
                    Relationship Graph
                </span>
                <span className="text-[10px] text-muted-foreground/50 ml-auto tabular-nums">
                    {graph.nodes.length} tables · {graph.edges.length} refs
                </span>
            </div>

            <svg
                viewBox={viewBox}
                width="100%"
                style={{ maxHeight: 400 }}
                className="block"
                preserveAspectRatio="xMidYMid meet"
            >
                {/* Defs for gradients / patterns */}
                <defs>
                    <linearGradient id="edgeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.1} />
                    </linearGradient>
                    {/* Subtle grid pattern */}
                    <pattern id="miniGrid" width="30" height="30" patternUnits="userSpaceOnUse">
                        <path d="M 30 0 L 0 0 0 30" fill="none" stroke="var(--border)" strokeWidth="0.5" opacity="0.2" />
                    </pattern>
                </defs>

                {/* Background grid */}
                <rect width="100%" height="100%" fill="url(#miniGrid)" />

                {/* Render edges first (behind nodes) */}
                {graph.edges.map((edge) => (
                    <EdgePath key={edge.id} edge={edge} nodes={graph.nodes} />
                ))}

                {/* Render nodes */}
                {graph.nodes.map((node) => (
                    <NodeRect key={node.id} node={node} onClick={handleNodeClick} />
                ))}
            </svg>
        </div>
    );
};
