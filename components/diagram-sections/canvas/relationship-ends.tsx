import type { Relationship } from "@/store/useCanvasStore";
import type { LineEnds, PortPoint } from "./canvas-style";
import styles from "./canvas.module.scss";

export type EndRole = "one" | "many";

/** Which end of a relationship is the "one" and which the "many". */
export function relationshipRoles(cardinality: Relationship["cardinality"]): { source: EndRole; target: EndRole } {
  switch (cardinality) {
    case "One to many":
      return { source: "one", target: "many" };
    case "Many to one":
      return { source: "many", target: "one" };
    default:
      return { source: "one", target: "one" };
  }
}

export function cardinalityShort(cardinality: Relationship["cardinality"]): string {
  const { source, target } = relationshipRoles(cardinality);
  return `${source === "many" ? "N" : "1"}:${target === "many" ? "N" : "1"}`;
}

interface RelationshipEndProps {
  ends: LineEnds;
  point: PortPoint;
  role: EndRole;
  /** "Zero or one" — the foreign key on the other end is nullable. */
  optional?: boolean;
  color: string;
}

/**
 * Marker drawn on the straight stub where a line meets a table edge.
 * Crow's foot: bar = exactly one, fork = many, ring = optional.
 */
export function RelationshipEnd({ ends, point, role, optional, color }: RelationshipEndProps) {
  const { x, y, d } = point;
  const X = (offset: number) => x + d * offset;

  if (ends === "labels") {
    const cx = X(20);
    const cy = y - 11;
    return (
      <g className={styles.relEnd}>
        <rect x={cx - 8} y={cy - 7.5} width={16} height={15} rx={7.5} fill="var(--table-bg)" stroke={color} strokeWidth={1.2} />
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={9.5}
          fontWeight={600}
          fontFamily="var(--font-mono)"
          fill={color}
        >
          {role === "many" ? "N" : "1"}
        </text>
      </g>
    );
  }

  if (role === "many") {
    return (
      <g className={styles.relEnd} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round">
        <path d={`M${X(13)} ${y}L${x} ${y - 6}M${X(13)} ${y}L${x} ${y}M${X(13)} ${y}L${x} ${y + 6}`} />
        <circle cx={X(19.5)} cy={y} r={3.5} fill="var(--canvas-bg)" />
      </g>
    );
  }

  return (
    <g className={styles.relEnd} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round">
      {optional ? (
        <>
          <path d={`M${X(9)} ${y - 6}V${y + 6}`} />
          <circle cx={X(16.5)} cy={y} r={3.5} fill="var(--canvas-bg)" />
        </>
      ) : (
        <path d={`M${X(9)} ${y - 6}V${y + 6}M${X(14)} ${y - 6}V${y + 6}`} />
      )}
    </g>
  );
}
