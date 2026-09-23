import type { Area, Relationship, Table } from "@/store/useCanvasStore";

/**
 * Group visibility — which groups of tables the canvas shows. View state, not
 * content: the hidden set lives in `useEditorStore` and never reaches the model,
 * the DBML or the cloud. See release-1-0/schemas-tab-and-visibility-plan.md D2.
 *
 * A "group" is whatever the active source says it is — a schema, a DBML
 * TableGroup or a foreign-key cluster (lib/table-grouping.ts). Everything here
 * takes the grouping's table-id → key index rather than deriving keys itself,
 * so it works the same for every source.
 *
 * Store-free so it can be unit-tested under vitest's `node` environment.
 */

type KeyIndex = ReadonlyMap<string, string>;

/**
 * The tables the canvas draws.
 *
 * Returns `tables` itself — same identity — when nothing is hidden, and also
 * when every hidden key is stale (its group no longer exists, or it belongs to
 * another source), so every memo downstream behaves exactly as it would with no
 * filter at all. Stale keys are ignored here rather than pruned from the store:
 * pruning on read needs no migration and no store write as a side effect of
 * rendering. A table the index doesn't know yet (added since it was built)
 * stays visible.
 */
export function filterVisibleTables(tables: Table[], hidden: readonly string[], index: KeyIndex): Table[] {
  if (hidden.length === 0) return tables;
  const hiddenSet = new Set(hidden);
  const visible = tables.filter((t) => {
    const key = index.get(t.id);
    return key === undefined || !hiddenSet.has(key);
  });
  return visible.length === tables.length ? tables : visible;
}

/**
 * The hidden group keys among `tableIds`' groups — what has to be revealed
 * before the camera can land on those tables. Unknown ids are skipped.
 */
export function hiddenGroupsOf(tableIds: readonly string[], index: KeyIndex, hidden: readonly string[]): string[] {
  if (hidden.length === 0) return [];
  const hiddenSet = new Set(hidden);
  const out = new Set<string>();
  for (const id of tableIds) {
    const key = index.get(id);
    if (key !== undefined && hiddenSet.has(key)) out.add(key);
  }
  return [...out];
}

/**
 * The hidden set after a schema rename. Returns `hidden` itself when `from`
 * isn't in it, so a rename with nothing hidden writes nothing.
 */
export function renameInHiddenSet(hidden: readonly string[], from: string, to: string): readonly string[] {
  if (!hidden.includes(from)) return hidden;
  const next = hidden.filter((k) => k !== from && k !== to);
  next.push(to);
  return next;
}

// ─── Cross-group stubs ───────────────────────────────────────────────────

export interface CrossGroupStubTarget {
  tableId: string;
  name: string;
  groupKey: string;
}

/**
 * A hint drawn where a relationship leaves the view: one per visible column
 * that is joined to a table in a hidden group. Several hidden tables on one
 * column share one stub, so a heavily referenced key draws one hint, not dozens.
 */
export interface CrossGroupStub {
  /** The visible end. */
  tableId: string;
  columnId: string;
  /** The hidden ends, deduplicated, in relationship order. */
  targets: CrossGroupStubTarget[];
}

/**
 * Where relationships cross into hidden groups. Reads only ids and names, so
 * callers can memoise it on a name signature rather than on positions — it
 * then runs on a rename or a visibility change, never during a drag.
 * Relationships with both ends visible, both ends hidden, or a dangling end
 * produce nothing.
 */
export function buildCrossGroupStubs(
  tables: readonly Pick<Table, "id" | "name">[],
  relationships: readonly Pick<Relationship, "sourceTableId" | "sourceColumnId" | "targetTableId" | "targetColumnId">[],
  hidden: readonly string[],
  index: KeyIndex
): CrossGroupStub[] {
  if (hidden.length === 0 || relationships.length === 0) return [];
  const hiddenSet = new Set(hidden);
  const nameById = new Map(tables.map((t) => [t.id, t.name]));
  const stubs = new Map<string, CrossGroupStub>();

  const isHidden = (tableId: string) => {
    const key = index.get(tableId);
    return key !== undefined && hiddenSet.has(key);
  };

  const add = (visibleTableId: string, columnId: string, targetId: string) => {
    const id = `${visibleTableId}\u0000${columnId}`;
    let stub = stubs.get(id);
    if (!stub) {
      stub = { tableId: visibleTableId, columnId, targets: [] };
      stubs.set(id, stub);
    }
    if (!stub.targets.some((t) => t.tableId === targetId)) {
      stub.targets.push({ tableId: targetId, name: nameById.get(targetId)!, groupKey: index.get(targetId)! });
    }
  };

  for (const rel of relationships) {
    if (!nameById.has(rel.sourceTableId) || !nameById.has(rel.targetTableId)) continue;
    const aHidden = isHidden(rel.sourceTableId);
    const bHidden = isHidden(rel.targetTableId);
    if (aHidden === bHidden) continue;
    if (bHidden) add(rel.sourceTableId, rel.sourceColumnId, rel.targetTableId);
    else add(rel.targetTableId, rel.targetColumnId, rel.sourceTableId);
  }
  return [...stubs.values()];
}

/** The short text on a stub: the table itself when there is one, else a count. */
export function crossGroupStubLabel(stub: CrossGroupStub, labelOf: (key: string) => string): string {
  const { targets } = stub;
  if (targets.length === 1) return targets[0].name;
  const groups = new Set(targets.map((t) => t.groupKey));
  if (groups.size === 1) return `${targets.length} in ${labelOf(targets[0].groupKey)}`;
  return `${targets.length} hidden tables`;
}

/**
 * Areas that only frame hidden tables. Drawing them would leave empty dashed
 * boxes where a hidden group sits (arrange by schema puts an Area around every
 * schema), and fitting to them would frame empty space — so they hide with
 * their tables. An area with no tables in it at all is not "emptied" and stays.
 *
 * Membership is by table centre, the same rule dragging an area uses.
 */
export function emptiedAreaIds(
  areas: readonly Pick<Area, "id" | "x" | "y" | "width" | "height">[],
  tables: readonly Pick<Table, "id" | "x" | "y" | "columns">[],
  visibleIds: ReadonlySet<string>,
  size: (table: Pick<Table, "columns">) => { width: number; height: number }
): Set<string> {
  const out = new Set<string>();
  for (const area of areas) {
    let hasHidden = false;
    let hasVisible = false;
    for (const t of tables) {
      const { width, height } = size(t);
      const cx = t.x + width / 2;
      const cy = t.y + height / 2;
      if (cx <= area.x || cx >= area.x + area.width || cy <= area.y || cy >= area.y + area.height) continue;
      if (visibleIds.has(t.id)) {
        hasVisible = true;
        break;
      }
      hasHidden = true;
    }
    if (hasHidden && !hasVisible) out.add(area.id);
  }
  return out;
}
