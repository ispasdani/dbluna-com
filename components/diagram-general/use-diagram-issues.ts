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
import { getHiddenSchemas, useEditorStore } from "@/store/useEditorStore";
import { useNoticeStore } from "@/store/useNoticeStore";
import { filterVisibleTables, hiddenSchemasOf } from "@/lib/schema-visibility";
import { schemaLabel, NO_SCHEMA_KEY } from "@/lib/schema-namespace";
import { getTableGeometry } from "@/store/useCanvasStyleStore";
import { tableHeight } from "@/components/diagram-sections/canvas/canvas-style";

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

/**
 * Un-hides whichever of these tables' schemas are hidden, and says so.
 *
 * Every path that focuses a table goes through here first: hiding a schema is a
 * view, not a deletion, so the Issues, Tables and Relationships panels must
 * still land on a table in a hidden schema — and centring the camera on a card
 * that isn't drawn would look like the jump failed. Also what a cross-schema
 * stub on the canvas calls when clicked.
 */
export function revealTablesOnCanvas(tableIds: readonly string[]) {
  const hidden = getHiddenSchemas();
  const toReveal = hiddenSchemasOf(tableIds, useCanvasStore.getState().tables, hidden);
  if (toReveal.length === 0) return;

  useEditorStore.getState().setHiddenSchemas(hidden.filter((k) => !toReveal.includes(k)));
  const names = toReveal.map((k) => schemaLabel(k === NO_SCHEMA_KEY ? null : k)).join(", ");
  useNoticeStore.getState().show(`Showing ${toReveal.length === 1 ? "schema" : "schemas"} ${names}`);
}

/**
 * Centres the camera on a table, revealing its schema if it is hidden.
 *
 * Selecting a table without moving the camera (what the panel used to do) is
 * invisible whenever the table is off-screen, which on a large diagram is most
 * of the time. Reads both stores imperatively so the caller doesn't have to
 * subscribe to the camera and re-render on every pan.
 */
export function focusTableOnCanvas(tableId: string) {
  const table = useCanvasStore.getState().tables.find((t) => t.id === tableId);
  if (!table) return;
  revealTablesOnCanvas([tableId]);

  const { camera, viewport, setCameraXY } = useEditorStore.getState();
  // The canvas reports a 1x1 viewport until it has been measured — recentering
  // against that would fling the camera somewhere arbitrary.
  if (viewport.w <= 1 || viewport.h <= 1) return;

  const geo = getTableGeometry();
  const worldX = table.x + geo.width / 2;
  const worldY =
    table.y + tableHeight(geo, table.columns.length) / 2;

  setCameraXY(viewport.w / 2 - worldX * camera.zoom, viewport.h / 2 - worldY * camera.zoom);
}

/**
 * Centres the camera between the two tables a relationship joins, revealing
 * either schema if it is hidden.
 */
export function focusRelationshipOnCanvas(sourceTableId: string, targetTableId: string) {
  const { tables } = useCanvasStore.getState();
  const a = tables.find((t) => t.id === sourceTableId);
  const b = tables.find((t) => t.id === targetTableId);
  if (!a || !b) return;
  revealTablesOnCanvas([sourceTableId, targetTableId]);

  const { camera, viewport, setCameraXY } = useEditorStore.getState();
  if (viewport.w <= 1 || viewport.h <= 1) return;

  const geo = getTableGeometry();
  const centre = (t: typeof a) => ({
    x: t.x + geo.width / 2,
    y: t.y + tableHeight(geo, t.columns.length) / 2,
  });
  const ca = centre(a);
  const cb = centre(b);

  setCameraXY(
    viewport.w / 2 - ((ca.x + cb.x) / 2) * camera.zoom,
    viewport.h / 2 - ((ca.y + cb.y) / 2) * camera.zoom
  );
}

/** Centres the camera on a sticky note. */
export function focusNoteOnCanvas(noteId: string) {
  const note = useCanvasStore.getState().notes.find((n) => n.id === noteId);
  if (!note) return;

  const { camera, viewport, setCameraXY } = useEditorStore.getState();
  if (viewport.w <= 1 || viewport.h <= 1) return;

  setCameraXY(
    viewport.w / 2 - (note.x + note.width / 2) * camera.zoom,
    viewport.h / 2 - (note.y + note.height / 2) * camera.zoom
  );
}

/** Centres the camera on an area. */
export function focusAreaOnCanvas(areaId: string) {
  const area = useCanvasStore.getState().areas.find((a) => a.id === areaId);
  if (!area) return;

  const { camera, viewport, setCameraXY } = useEditorStore.getState();
  if (viewport.w <= 1 || viewport.h <= 1) return;

  setCameraXY(
    viewport.w / 2 - (area.x + area.width / 2) * camera.zoom,
    viewport.h / 2 - (area.y + area.height / 2) * camera.zoom
  );
}

/**
 * Zooms and centres the camera so every visible table, and every note and area,
 * is in view, with some breathing room. Tables in hidden schemas don't count —
 * fitting around them would frame empty space. Notes and areas aren't
 * schema-scoped, so they always do. Never zooms in past 100%, so a tiny diagram
 * isn't blown up to fill the screen.
 */
export function fitDiagramOnCanvas() {
  const { notes, areas } = useCanvasStore.getState();
  const tables = filterVisibleTables(useCanvasStore.getState().tables, getHiddenSchemas());
  const { viewport, setZoomAt, setCameraXY } = useEditorStore.getState();
  if (viewport.w <= 1 || viewport.h <= 1) return;

  const geo = getTableGeometry();
  const boxes = [
    ...tables.map((t) => ({ x: t.x, y: t.y, w: geo.width, h: tableHeight(geo, t.columns.length) })),
    ...notes.map((n) => ({ x: n.x, y: n.y, w: n.width, h: n.height })),
    ...areas.map((a) => ({ x: a.x, y: a.y, w: a.width, h: a.height })),
  ];
  if (boxes.length === 0) return;

  const minX = Math.min(...boxes.map((b) => b.x));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxX = Math.max(...boxes.map((b) => b.x + b.w));
  const maxY = Math.max(...boxes.map((b) => b.y + b.h));

  // Room for the floating toolbar and minimap along the edges.
  const pad = 80;
  const zoom = Math.min(1, (viewport.w - pad * 2) / (maxX - minX), (viewport.h - pad * 2) / (maxY - minY));

  // setZoomAt clamps to the store's zoom range; read back what it settled on.
  setZoomAt(zoom, 0, 0);
  const applied = useEditorStore.getState().camera.zoom;
  setCameraXY(
    viewport.w / 2 - ((minX + maxX) / 2) * applied,
    viewport.h / 2 - ((minY + maxY) / 2) * applied
  );
}
