import type { Area } from "@/store/useCanvasStore";
import type { SchemaBlock } from "@/lib/auto-arrange";

/**
 * One Area per schema, drawn by `arrange by schema` so a field of hundreds of
 * cards reads as districts even with nothing hidden. See
 * release-1-0/schemas-tab-and-visibility-plan.md Phase 5.
 *
 * Store-free so it can be unit-tested under vitest's `node` environment.
 *
 * These areas are ordinary content — they sync, and the user can rename,
 * recolour, move or lock them. What marks one as arrange-managed is its id
 * prefix, so a re-arrange updates the same area instead of stacking a copy on
 * top, and never touches an area the user drew themselves.
 */

export const SCHEMA_AREA_PREFIX = "schema-area:";

/** Room between a schema's tables and its area's dashed border. */
const PAD = 24;

/**
 * Soft, distinct colours so neighbouring districts don't read as one. The area
 * fill is drawn at 5% opacity, so these only really show in the border.
 */
const PALETTE = ["#6366f1", "#0ea5e9", "#14b8a6", "#22c55e", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6"];

export const schemaAreaId = (schema: string) => `${SCHEMA_AREA_PREFIX}${schema}`;
export const isSchemaArea = (area: Pick<Area, "id">) => area.id.startsWith(SCHEMA_AREA_PREFIX);

/**
 * The areas after an arrange.
 *
 * - The user's own areas are kept exactly as they are.
 * - Each named schema block gets an area around it. One that already exists is
 *   moved and resized but keeps its title, colour and stacking — the user may
 *   have changed those. A *locked* one is left entirely alone, the same rule
 *   arrange applies to locked tables.
 * - Unlocked managed areas with no block this time — the schema is gone, or the
 *   arrange wasn't by schema — are removed; they would frame the wrong tables.
 *
 * Unqualified tables get no area: "(no schema)" isn't a district anyone named.
 * With fewer than two blocks there is nothing to tell apart, so no areas either.
 */
export function schemaAreasAfterArrange(blocks: readonly SchemaBlock[], areas: readonly Area[]): Area[] {
  const named = blocks.length >= 2 ? blocks.filter((b): b is SchemaBlock & { schema: string } => b.schema !== null) : [];
  const wanted = new Map(named.map((b, i) => [schemaAreaId(b.schema), { block: b, index: i }]));

  const next: Area[] = [];
  const seen = new Set<string>();

  for (const area of areas) {
    if (!isSchemaArea(area) || area.isLocked) {
      next.push(area);
      seen.add(area.id);
      continue;
    }
    const hit = wanted.get(area.id);
    if (!hit) continue;
    next.push({ ...area, ...rectAround(hit.block) });
    seen.add(area.id);
  }

  for (const [id, { block, index }] of wanted) {
    if (seen.has(id)) continue;
    next.push({
      id,
      ...rectAround(block),
      title: block.schema,
      color: PALETTE[index % PALETTE.length],
      isLocked: false,
      zIndex: 0,
    });
  }

  return next;
}

/**
 * What Undo arrange puts back: the arrange-managed areas as they were before,
 * and every area the user has drawn since, as it is now.
 */
export function restoreSchemaAreas(before: readonly Area[], current: readonly Area[]): Area[] {
  return [...current.filter((a) => !isSchemaArea(a)), ...before.filter(isSchemaArea)];
}

/** Same members, same values — so an arrange that changed nothing writes nothing. */
export function sameAreas(a: readonly Area[], b: readonly Area[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((area, i) => {
    const other = b[i];
    return (
      area.id === other.id &&
      area.x === other.x &&
      area.y === other.y &&
      area.width === other.width &&
      area.height === other.height &&
      area.title === other.title &&
      area.color === other.color &&
      area.isLocked === other.isLocked &&
      area.zIndex === other.zIndex
    );
  });
}

// The area's title is drawn in the 30px above its top edge (see AreaNode), which
// lands inside the GROUP_HEADER strip arrange leaves above every block.
function rectAround(block: SchemaBlock) {
  return {
    x: block.x - PAD,
    y: block.y - PAD,
    width: Math.round(block.width) + PAD * 2,
    height: Math.round(block.height) + PAD * 2,
  };
}
