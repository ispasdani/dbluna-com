"use client";

import { useMemo } from "react";

import { buildGrouping, type GroupSource, type TableGrouping } from "@/lib/table-grouping";
import { useCanvasStore, type CanvasTableGroup, type Relationship, type Table } from "@/store/useCanvasStore";
import { getGroupSource, useGroupSource } from "@/store/useEditorStore";

/**
 * The active diagram's grouping — schemas, TableGroups or FK clusters, per the
 * editor's `groupBy` — for the Schemas tab, its graph and the toolbar menu.
 *
 * Subscribes to table ids and names as one string, not to `tables`: a canvas
 * drag replaces `tables` on every pointermove but never changes a name, so the
 * string compares equal and nothing using this re-renders or re-clusters
 * mid-drag. Relationships and table groups change identity only when edited.
 */
export function useActiveGrouping(): TableGrouping {
  const source = useGroupSource();
  const idNames = useCanvasStore((s) => s.tables.map((t) => `${t.id}\t${t.name}`).join("\n"));
  const relationships = useCanvasStore((s) => s.relationships);
  const tableGroups = useCanvasStore((s) => s.tableGroups);

  return useMemo(() => {
    const tables = idNames
      ? idNames.split("\n").map((line) => {
          const tab = line.indexOf("\t");
          return { id: line.slice(0, tab), name: line.slice(tab + 1) };
        })
      : [];
    return buildGrouping(source, tables, relationships, tableGroups);
  }, [source, idNames, relationships, tableGroups]);
}

let cache: {
  source: GroupSource;
  tables: Table[];
  relationships: Relationship[];
  tableGroups: CanvasTableGroup[];
  grouping: TableGrouping;
} | null = null;

/**
 * The same, read imperatively — for event handlers and camera helpers (fit,
 * reveal, Delete, export) that run outside render. Cached on the inputs'
 * identities, so repeated calls between edits cost nothing; clustering itself
 * is a few milliseconds when it does run.
 */
export function getActiveGrouping(): TableGrouping {
  const source = getGroupSource();
  const { tables, relationships, tableGroups } = useCanvasStore.getState();
  if (
    cache &&
    cache.source === source &&
    cache.tables === tables &&
    cache.relationships === relationships &&
    cache.tableGroups === tableGroups
  ) {
    return cache.grouping;
  }
  const grouping = buildGrouping(source, tables, relationships, tableGroups);
  cache = { source, tables, relationships, tableGroups, grouping };
  return grouping;
}
