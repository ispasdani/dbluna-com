"use client";

import { useMemo } from "react";

import {
  analyzeDiagram,
  countIssues,
  issuesSignature,
  type DiagramModel,
  type Issue,
  type IssueCounts,
} from "@/lib/diagram-issues";
import { useCanvasStore } from "@/store/useCanvasStore";
import { useEditorStore } from "@/store/useEditorStore";

/**
 * Live schema issues for the active diagram.
 *
 * Every subscription here is a narrow selector rather than `useCanvasStore()`,
 * and the analysis is memoised on `issuesSignature` rather than on the array
 * identities. Both matter for the same reason: `moveTables` replaces `tables`
 * on every pointermove of a canvas drag, so a whole-store subscription plus an
 * identity-keyed memo would re-lint the entire schema once per frame. The
 * signature ignores x/y, so a drag costs one cheap string build and nothing else.
 */
export function useDiagramIssues(): { issues: Issue[]; counts: IssueCounts } {
  const tables = useCanvasStore((s) => s.tables);
  const relationships = useCanvasStore((s) => s.relationships);
  const enums = useCanvasStore((s) => s.enums);
  const tableGroups = useCanvasStore((s) => s.tableGroups);

  const model: DiagramModel = { tables, relationships, enums, tableGroups };
  const signature = issuesSignature(model);

  const issues = useMemo(
    () => analyzeDiagram(model),
    // The signature IS the dependency — `model` is a fresh object every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature]
  );

  const counts = useMemo(() => countIssues(issues), [issues]);

  return { issues, counts };
}

/** Rendered size of a table card on the canvas; mirrors table-node.tsx. */
const TABLE_WIDTH = 220;
const TABLE_HEADER_HEIGHT = 36;
const TABLE_ROW_HEIGHT = 30;

/**
 * Centres the camera on a table.
 *
 * Selecting a table without moving the camera (what the panel used to do) is
 * invisible whenever the table is off-screen, which on a large diagram is most
 * of the time. Reads both stores imperatively so the caller doesn't have to
 * subscribe to the camera and re-render on every pan.
 */
export function focusTableOnCanvas(tableId: string) {
  const table = useCanvasStore.getState().tables.find((t) => t.id === tableId);
  if (!table) return;

  const { camera, viewport, setCameraXY } = useEditorStore.getState();
  // The canvas reports a 1x1 viewport until it has been measured — recentering
  // against that would fling the camera somewhere arbitrary.
  if (viewport.w <= 1 || viewport.h <= 1) return;

  const worldX = table.x + TABLE_WIDTH / 2;
  const worldY =
    table.y + (TABLE_HEADER_HEIGHT + table.columns.length * TABLE_ROW_HEIGHT) / 2;

  setCameraXY(viewport.w / 2 - worldX * camera.zoom, viewport.h / 2 - worldY * camera.zoom);
}
