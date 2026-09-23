"use client";

import { useMemo } from "react";

import { sourceInfo, type TableGroupInfo } from "@/lib/table-grouping";
import { useEditorStore, useHiddenSchemas } from "@/store/useEditorStore";
import { fitDiagramOnCanvas } from "./use-diagram-issues";
import { useActiveGrouping } from "./use-grouping";

export interface GroupVisibilityEntry extends TableGroupInfo {
  tableCount: number;
  isHidden: boolean;
}

/**
 * Which groups are on the canvas, and the actions that change it — one state,
 * shared by the Schemas tab, its graph and the toolbar menu so none of them owns
 * a copy of the toggle logic. Groups are whatever the active source makes them
 * (schemas, TableGroups, FK clusters).
 *
 * Every action rewrites only the active source's keys. The hidden list is
 * shared by all sources, so "Show all" under FK clusters leaves the schemas you
 * hid under Schemas hidden for when you switch back.
 */
export function useSchemaVisibility() {
  const grouping = useActiveGrouping();
  const hidden = useHiddenSchemas();
  const setHiddenSchemas = useEditorStore((s) => s.setHiddenSchemas);

  // Only groups that exist count: a stale key left in the hidden set is
  // ignored here rather than pruned from the store.
  const entries: GroupVisibilityEntry[] = useMemo(
    () =>
      grouping.groups.map((g) => ({
        ...g,
        tableCount: g.tableIds.length,
        isHidden: hidden.includes(g.key),
      })),
    [grouping, hidden]
  );

  const hiddenCount = entries.filter((e) => e.isHidden).length;
  const activeKeys = () => new Set(entries.map((e) => e.key));
  // Keys belonging to other sources (or to groups gone stale), kept as-is.
  const others = () => {
    const mine = activeKeys();
    return hidden.filter((k) => !mine.has(k));
  };

  return {
    grouping,
    source: grouping.source,
    info: sourceInfo(grouping.source),
    entries,
    total: entries.length,
    shownCount: entries.length - hiddenCount,
    hiddenCount,
    isHidden: (key: string) => hidden.includes(key),
    toggle: (key: string) =>
      setHiddenSchemas(hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key]),
    /** Hides every other group, then fits the camera to what is left. */
    showOnly: (keys: string | readonly string[]) => {
      const keep = typeof keys === "string" ? [keys] : keys;
      setHiddenSchemas([...others(), ...entries.map((e) => e.key).filter((k) => !keep.includes(k))]);
      fitDiagramOnCanvas();
    },
    showAll: () => setHiddenSchemas(others()),
    hideAll: () => setHiddenSchemas([...others(), ...entries.map((e) => e.key)]),
  };
}
