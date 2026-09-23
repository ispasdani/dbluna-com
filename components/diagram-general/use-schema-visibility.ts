"use client";

import { useMemo } from "react";

import { schemaLabel } from "@/lib/schema-namespace";
import { countTablesBySchema } from "@/lib/schema-visibility";
import { useCanvasStore } from "@/store/useCanvasStore";
import { useEditorStore, useHiddenSchemas } from "@/store/useEditorStore";
import { fitDiagramOnCanvas } from "./use-diagram-issues";

export interface SchemaVisibilityEntry {
  schema: string | null;
  key: string;
  label: string;
  tableCount: number;
  isHidden: boolean;
}

/**
 * Which schemas are on the canvas, and the actions that change it — one state,
 * shared by the Schemas tab and the toolbar's Schemas menu so neither owns a
 * copy of the toggle logic.
 *
 * Subscribes to table *names* as one string: a canvas drag replaces `tables`
 * on every pointermove but never changes a name, so the string compares equal
 * and nothing using this re-renders mid-drag.
 */
export function useSchemaVisibility() {
  const names = useCanvasStore((s) => s.tables.map((t) => t.name).join("\n"));
  const hidden = useHiddenSchemas();
  const setSchemaHidden = useEditorStore((s) => s.setSchemaHidden);
  const setHiddenSchemas = useEditorStore((s) => s.setHiddenSchemas);

  const counts = useMemo(() => countTablesBySchema(names ? names.split("\n") : []), [names]);

  // Only schemas that exist count: a stale name left in the hidden set by a
  // rename elsewhere is ignored here rather than pruned from the store.
  const entries: SchemaVisibilityEntry[] = useMemo(
    () =>
      counts.map((c) => ({
        schema: c.schema,
        key: c.key,
        label: schemaLabel(c.schema),
        tableCount: c.tableCount,
        isHidden: hidden.includes(c.key),
      })),
    [counts, hidden]
  );

  const hiddenCount = entries.filter((e) => e.isHidden).length;
  const allKeys = () => entries.map((e) => e.key);

  return {
    entries,
    total: entries.length,
    shownCount: entries.length - hiddenCount,
    hiddenCount,
    isHidden: (key: string) => hidden.includes(key),
    toggle: (key: string) => setSchemaHidden(key, !hidden.includes(key)),
    /** Hides every other schema, then fits the camera to what is left. */
    showOnly: (keys: string | readonly string[]) => {
      const keep = typeof keys === "string" ? [keys] : keys;
      setHiddenSchemas(allKeys().filter((k) => !keep.includes(k)));
      fitDiagramOnCanvas();
    },
    showAll: () => setHiddenSchemas([]),
    hideAll: () => setHiddenSchemas(allKeys()),
  };
}
