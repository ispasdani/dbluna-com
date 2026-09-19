import type { Column, Relationship } from "@/store/useCanvasStore";

/**
 * Which stored end of a relationship holds the foreign key. The referenced end
 * is nearly always a primary key, so that decides it when it can; imported
 * diagrams don't agree on which way the cardinality label reads. Otherwise this
 * falls back to the DBML generator's convention, where only "Many to one" puts
 * the FK on the target.
 */
export function foreignKeyIsSource(rel: Relationship, source: Column, target: Column): boolean {
  if (target.isPrimaryKey && !source.isPrimaryKey) return true;
  if (source.isPrimaryKey && !target.isPrimaryKey) return false;
  return rel.cardinality !== "Many to one";
}
