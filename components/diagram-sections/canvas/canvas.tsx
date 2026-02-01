"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useEditorStore } from "@/store/useEditorStore";
import { useCanvasStore, type Area } from "@/store/useCanvasStore";
import { useDockStore } from "@/store/useDockStore";
import { WorldBackground } from "@/components/diagram-general/canvas-world-background";
import { Minimap } from "./minimap";
import { TableNode } from "./table-node";
import { NoteNode } from "./note-node";
import { AreaNode } from "./area-node";
import styles from "./canvas.module.scss";

const WORLD_WIDTH = 6000;
const WORLD_HEIGHT = 6000;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function CanvasStage() {
  const rootRef = useRef<HTMLDivElement>(null);

  const background = useCanvasStore((s) => s.background);
  const tables = useCanvasStore((s) => s.tables);
  const selectedTableIds = useCanvasStore((s) => s.selectedTableIds);
  const setSelectedTableIds = useCanvasStore((s) => s.setSelectedTableIds);
  const notes = useCanvasStore((s) => s.notes);
  const selectedNoteIds = useCanvasStore((s) => s.selectedNoteIds);
  const setSelectedNoteIds = useCanvasStore((s) => s.setSelectedNoteIds);
  const selectedRelationshipId = useCanvasStore((s) => s.selectedRelationshipId);
  const setSelectedRelationshipId = useCanvasStore((s) => s.setSelectedRelationshipId);
  const moveTables = useCanvasStore((s) => s.moveTables);
  const deleteTables = useCanvasStore((s) => s.deleteTables);
  const moveNotes = useCanvasStore((s) => s.moveNotes);
  const deleteNote = useCanvasStore((s) => s.deleteNote);
  const areas = useCanvasStore((s) => s.areas);
  const selectedAreaIds = useCanvasStore((s) => s.selectedAreaIds);
  const setSelectedAreaIds = useCanvasStore((s) => s.setSelectedAreaIds);
  const moveAreas = useCanvasStore((s) => s.moveAreas);

  const openTab = useDockStore((s) => s.openTab);

  const camera = useEditorStore((s) => s.camera);
  const panBy = useEditorStore((s) => s.panBy);
  const zoomAt = useEditorStore((s) => s.zoomAt);

  const setViewportStore = useEditorStore((s) => s.setViewport);
  const setWorldStore = useEditorStore((s) => s.setWorld);
  const setCameraXY = useEditorStore((s) => s.setCameraXY);

  const [viewport, setViewport] = useState({ w: 1, h: 1 });
  const [hoveredRelationshipId, setHoveredRelationshipId] = useState<string | null>(null);

  // Selection Rect State (in world coordinates)
  const [selectionRect, setSelectionRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null);

  // Tell store the world bounds (so clamping uses the same world as the grid)
  useEffect(() => {
    setWorldStore(WORLD_WIDTH, WORLD_HEIGHT);
  }, [setWorldStore]);

  // Measure viewport (so minimap + zoomAt math is correct) + inform store (for clamping)
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const update = () => {
      const r = el.getBoundingClientRect();
      setViewport({ w: r.width, h: r.height });
      setViewportStore(r.width, r.height);
    };

    const ro = new ResizeObserver(update);
    ro.observe(el);

    update();

    return () => ro.disconnect();
  }, [setViewportStore]);

  // Space-to-pan
  const [spaceDown, setSpaceDown] = useState(false);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;

      const t = e.target as HTMLElement | null;
      const isTyping =
        t?.tagName === "INPUT" ||
        t?.tagName === "TEXTAREA" ||
        t?.isContentEditable;

      if (isTyping) return;

      e.preventDefault();
      setSpaceDown(true);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setSpaceDown(false);
      }
      if ((e.code === "Delete" || e.code === "Backspace") && selectedTableIds.length > 0) {
        // Prevent deleting if typing in input !! 
        // We already check "isTyping" in onKeyDown but not here.
        // We should check here too or move logic. 
        const t = e.target as HTMLElement | null;
        const isTyping = t?.tagName === "INPUT" || t?.tagName === "TEXTAREA" || t?.isContentEditable;
        if (!isTyping) {
          if (selectedTableIds.length > 0) deleteTables(selectedTableIds);
          if (selectedNoteIds.length > 0) selectedNoteIds.forEach(id => deleteNote(id));
        }
      }
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [selectedTableIds, deleteTables]);

  // Pointer panning
  const drag = useRef<{
    active: boolean;
    lastX: number;
    lastY: number;
    pointerId: number | null;
  }>({ active: false, lastX: 0, lastY: 0, pointerId: null });

  // Table dragging
  const dragTable = useRef<{
    active: boolean;
    initialMouseX: number;
    initialMouseY: number;
    // Map of table ID to its initial position {x, y}
    initialPositions: Map<string, { x: number, y: number }>;
    pointerId: number | null;
  }>({ active: false, initialMouseX: 0, initialMouseY: 0, initialPositions: new Map(), pointerId: null });

  // Note dragging
  const dragNote = useRef<{
    active: boolean;
    initialMouseX: number;
    initialMouseY: number;
    initialPositions: Map<string, { x: number, y: number }>;
    pointerId: number | null;
  }>({ active: false, initialMouseX: 0, initialMouseY: 0, initialPositions: new Map(), pointerId: null });

  // Note Resizing
  const resizeNote = useRef<{
    active: boolean;
    noteId: string;
    direction: "left" | "right";
    initialMouseX: number;
    initialX: number;
    initialWidth: number;
    pointerId: number | null;
  }>({ active: false, noteId: "", direction: "right", initialMouseX: 0, initialX: 0, initialWidth: 0, pointerId: null });

  // Area Dragging
  const dragArea = useRef<{
    active: boolean;
    initialMouseX: number;
    initialMouseY: number;
    initialPositions: Map<string, { x: number, y: number }>;
    childTables: string[]; // IDs of tables being dragged with area
    childNotes: string[];  // IDs of notes being dragged with area
    // We need original positions of children too to avoid drift
    childInitPositions: Map<string, { x: number, y: number }>;
    pointerId: number | null;
  }>({
    active: false,
    initialMouseX: 0,
    initialMouseY: 0,
    initialPositions: new Map(),
    childTables: [],
    childNotes: [],
    childInitPositions: new Map(),
    pointerId: null
  });

  // Area Resizing
  const resizeArea = useRef<{
    active: boolean;
    areaId: string;
    direction: "tl" | "tr" | "bl" | "br"; // corners
    initialMouseX: number;
    initialMouseY: number;
    initialX: number;
    initialY: number;
    initialWidth: number;
    initialHeight: number;
    pointerId: number | null;
  }>({
    active: false,
    areaId: "",
    direction: "br",
    initialMouseX: 0,
    initialMouseY: 0,
    initialX: 0,
    initialY: 0,
    initialWidth: 0,
    initialHeight: 0,
    pointerId: null
  });

  // Marquee Selection dragging
  const dragSelection = useRef<{
    active: boolean;
    startX: number; // World coordinates
    startY: number;
    currentX: number;
    currentY: number;
    pointerId: number | null;
  }>({ active: false, startX: 0, startY: 0, currentX: 0, currentY: 0, pointerId: null });

  // Actions
  const relationships = useCanvasStore((s) => s.relationships);
  const addRelationship = useCanvasStore((s) => s.addRelationship);

  const snapToGrid = useCanvasStore((s) => s.snapToGrid);

  // Connection dragging
  const dragConnection = useRef<{
    active: boolean;
    sourceTableId: string;
    sourceColumnId: string;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    pointerId: number | null;
  }>({ active: false, sourceTableId: "", sourceColumnId: "", startX: 0, startY: 0, currentX: 0, currentY: 0, pointerId: null });

  const [, setTick] = useState(0);

  // Helper to get column position in world coordinates
  const getColumnPosition = (tableId: string, columnId: string, isSource: boolean) => {
    const table = tables.find(t => t.id === tableId);
    if (!table) return null;
    const colIndex = table.columns.findIndex(c => c.id === columnId);
    if (colIndex === -1) return null;

    const HEADER_HEIGHT = 36;
    const ROW_HEIGHT = 30;
    const WIDTH = 220;

    const x = table.x + (isSource ? WIDTH : 0);
    const y = table.y + HEADER_HEIGHT + colIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
    return { x, y };
  };

  // Orthogonal path calculator with rounded corners (DrawDB style)
  const calculatePath = (x1: number, y1: number, x2: number, y2: number) => {
    const cornerRadius = 8;
    const midX = (x1 + x2) / 2;

    // Determine if we need to go around obstacles
    const dx = x2 - x1;
    const dy = y2 - y1;

    // Simple case: straight horizontal or mostly horizontal
    if (Math.abs(dy) < 10) {
      return `M ${x1} ${y1} L ${x2} ${y2}`;
    }

    // Orthogonal routing: horizontal -> vertical -> horizontal
    // Start horizontal from x1
    const segments: string[] = [];

    if (dx > cornerRadius * 2) {
      // Going right: x1 -> midX (horizontal), midX -> y2 (vertical), midX -> x2 (horizontal)
      segments.push(`M ${x1} ${y1}`);

      // Horizontal segment to midpoint
      segments.push(`L ${midX - cornerRadius} ${y1}`);

      // Rounded corner going down/up
      if (dy > 0) {
        segments.push(`Q ${midX} ${y1} ${midX} ${y1 + cornerRadius}`);
      } else {
        segments.push(`Q ${midX} ${y1} ${midX} ${y1 - cornerRadius}`);
      }

      // Vertical segment
      if (dy > 0) {
        segments.push(`L ${midX} ${y2 - cornerRadius}`);
      } else {
        segments.push(`L ${midX} ${y2 + cornerRadius}`);
      }

      // Rounded corner going right
      if (dy > 0) {
        segments.push(`Q ${midX} ${y2} ${midX + cornerRadius} ${y2}`);
      } else {
        segments.push(`Q ${midX} ${y2} ${midX + cornerRadius} ${y2}`);
      }

      // Final horizontal segment to end
      segments.push(`L ${x2} ${y2}`);
    } else {
      // Going left or very short distance: need different routing
      const offset = 30;

      segments.push(`M ${x1} ${y1}`);

      // Go right a bit
      segments.push(`L ${x1 + offset - cornerRadius} ${y1}`);

      // Turn down/up
      if (dy > 0) {
        segments.push(`Q ${x1 + offset} ${y1} ${x1 + offset} ${y1 + cornerRadius}`);
        segments.push(`L ${x1 + offset} ${y2 - cornerRadius}`);
        segments.push(`Q ${x1 + offset} ${y2} ${x1 + offset - cornerRadius} ${y2}`);
      } else {
        segments.push(`Q ${x1 + offset} ${y1} ${x1 + offset} ${y1 - cornerRadius}`);
        segments.push(`L ${x1 + offset} ${y2 + cornerRadius}`);
        segments.push(`Q ${x1 + offset} ${y2} ${x1 + offset - cornerRadius} ${y2}`);
      }

      // Go to end
      segments.push(`L ${x2} ${y2}`);
    }

    return segments.join(' ');
  };

  const calculateMidpoint = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = x2 - x1;
    const cornerRadius = 8;
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    if (dx > cornerRadius * 2) {
      return { x: midX, y: midY };
    } else {
      const offset = 30;
      return { x: x1 + offset, y: midY };
    }
  };

  const onColumnPointerDown = (e: React.PointerEvent, tableId: string, columnId: string, isSource: boolean) => {
    e.stopPropagation();
    e.preventDefault();

    const pos = getColumnPosition(tableId, columnId, isSource);
    if (!pos) return;

    const target = e.currentTarget as Element;
    target.setPointerCapture(e.pointerId);

    dragConnection.current = {
      active: true,
      sourceTableId: tableId,
      sourceColumnId: columnId,
      startX: pos.x,
      startY: pos.y,
      currentX: pos.x,
      currentY: pos.y,
      pointerId: e.pointerId
    };
    setTick(t => t + 1);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    // If dragging a table, don't pan
    if (dragTable.current.active) return;

    // Middle mouse or Space+Left = Pan
    const shouldPan = e.button === 1 || (e.button === 0 && spaceDown);

    if (shouldPan) {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      drag.current = {
        active: true,
        lastX: e.clientX,
        lastY: e.clientY,
        pointerId: e.pointerId,
      };
      return;
    }

    // Left click on background -> Marquee Selection
    if (e.button === 0) {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const worldX = (e.clientX - rect.left - camera.x) / camera.zoom;
      const worldY = (e.clientY - rect.top - camera.y) / camera.zoom;

      dragSelection.current = {
        active: true,
        startX: worldX,
        startY: worldY,
        currentX: worldX,
        currentY: worldY,
        pointerId: e.pointerId
      };
      // Clear selection unless shift is held (DrawDB behavior usually clears)
      // Let's clear for now to be simple
      if (!e.shiftKey) {
        setSelectedTableIds([]);
      }
      setSelectionRect({ x: worldX, y: worldY, w: 0, h: 0 });
    }
  };

  const onTablePointerDown = (e: React.PointerEvent, tableId: string) => {
    if (spaceDown) return; // If panning mode, ignore table drag

    e.stopPropagation();
    e.preventDefault();

    const table = tables.find(t => t.id === tableId);
    if (!table) return;

    // If table is locked, just select it (single) and return
    if (table.isLocked) {
      setSelectedTableIds([tableId]);
      openTab("tables", "left");
      return;
    }

    const target = e.currentTarget as Element;
    target.setPointerCapture(e.pointerId);

    // Selection Logic:
    // If clicking an unselected table, select it (exclusive) unless Shift
    // If clicking a selected table, keep selection (to allow group drag)
    let newSelectedIds = [...selectedTableIds];
    if (!selectedTableIds.includes(tableId)) {
      if (e.shiftKey) {
        newSelectedIds.push(tableId);
      } else {
        newSelectedIds = [tableId];
      }
      setSelectedTableIds(newSelectedIds);
      openTab("tables", "left");
      // Force update local variable for initPositions
    }
    // If shift clicking an already selected table, deselect it? 
    // Standard behavior: 
    // - Click selected: Start drag
    // - Shift+Click selected: Deselect (and don't drag typically, or drag remaining)
    else if (e.shiftKey) {
      newSelectedIds = newSelectedIds.filter(id => id !== tableId);
      setSelectedTableIds(newSelectedIds);
      return; // Don't drag if we just deselected it
    }

    // Prepare group drag
    const initialPositions = new Map<string, { x: number, y: number }>();
    newSelectedIds.forEach(id => {
      const t = tables.find(t => t.id === id);
      if (t) initialPositions.set(id, { x: t.x, y: t.y });
    });

    dragTable.current = {
      active: true,
      initialMouseX: e.clientX,
      initialMouseY: e.clientY,
      initialPositions,
      pointerId: e.pointerId
    };
  };

  const onNotePointerDown = (e: React.PointerEvent, noteId: string) => {
    if (spaceDown) return;
    e.stopPropagation();
    e.preventDefault();

    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    const target = e.target as Element;
    const resizeDir = target.getAttribute("data-note-resize");

    // Handle Resizing
    if (resizeDir && (resizeDir === "left" || resizeDir === "right") && !note.isLocked) {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      resizeNote.current = {
        active: true,
        noteId,
        direction: resizeDir,
        initialMouseX: e.clientX,
        initialX: note.x,
        initialWidth: note.width,
        pointerId: e.pointerId
      };
      return;
    }

    // If locked, just select
    if (note.isLocked) {
      setSelectedNoteIds([noteId]);
      openTab("notes", "left");
      return;
    }

    (e.currentTarget as Element).setPointerCapture(e.pointerId);

    // Selection Logic (similar to tables)
    let newSelectedIds = [...selectedNoteIds];
    if (!selectedNoteIds.includes(noteId)) {
      if (e.shiftKey) {
        newSelectedIds.push(noteId);
      } else {
        newSelectedIds = [noteId];
      }
      setSelectedNoteIds(newSelectedIds);
      openTab("notes", "left");
    } else if (e.shiftKey) {
      newSelectedIds = newSelectedIds.filter(id => id !== noteId);
      setSelectedNoteIds(newSelectedIds);
      return;
    }

    // Group Drag Init
    const initialPositions = new Map<string, { x: number, y: number }>();
    newSelectedIds.forEach(id => {
      const n = notes.find(n => n.id === id);
      if (n) initialPositions.set(id, { x: n.x, y: n.y });
    });

    dragNote.current = {
      active: true,
      initialMouseX: e.clientX,
      initialMouseY: e.clientY,
      initialPositions,
      pointerId: e.pointerId
    };
  };

  const onAreaPointerDown = (e: React.PointerEvent, areaId: string) => {
    if (spaceDown) return;
    e.stopPropagation();
    e.preventDefault();

    const area = areas.find(a => a.id === areaId);
    if (!area) return;

    const target = e.target as Element;
    const resizeDir = target.getAttribute("data-area-resize") as "tl" | "tr" | "bl" | "br" | null;

    // Handle Resizing
    if (resizeDir && !area.isLocked) {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      resizeArea.current = {
        active: true,
        areaId,
        direction: resizeDir,
        initialMouseX: e.clientX,
        initialMouseY: e.clientY,
        initialX: area.x,
        initialY: area.y,
        initialWidth: area.width,
        initialHeight: area.height,
        pointerId: e.pointerId
      };
      return;
    }

    // If locked, select only
    if (area.isLocked) {
      setSelectedAreaIds([areaId]);
      openTab("areas", "left");
      return;
    }

    (e.currentTarget as Element).setPointerCapture(e.pointerId);

    // Selection Logic
    let newSelectedIds = [...selectedAreaIds];
    if (!selectedAreaIds.includes(areaId)) {
      if (e.shiftKey) {
        newSelectedIds.push(areaId);
      } else {
        newSelectedIds = [areaId];
      }
      setSelectedAreaIds(newSelectedIds);
      openTab("areas", "left");
    } else if (e.shiftKey) {
      newSelectedIds = newSelectedIds.filter(id => id !== areaId);
      setSelectedAreaIds(newSelectedIds);
      return;
    }


    // DRAG LOGIC FOR AREA + CHILDREN
    const initialPositions = new Map();
    newSelectedIds.forEach(id => {
      const a = areas.find(a => a.id === id);
      if (a) initialPositions.set(id, { x: a.x, y: a.y });
    });

    // Find children ONLY if dragging a SINGLE area (for simplicity first, or all selected areas?)
    // Let's implement for single area drag first or union of children. 
    // DrawDB behavior: when moving a group (area), everything inside moves.

    const childTables: string[] = [];
    const childNotes: string[] = [];
    const childInitPositions = new Map();

    // Only check children if we are dragging actual areas (not just selection)
    // Check intersection for "this" area or ALL selected areas? 
    // Usually dragging multiple areas moves their respective children.

    const relevantAreas = newSelectedIds.map(id => areas.find(a => a.id === id)).filter(Boolean) as Area[];

    relevantAreas.forEach(a => {
      const rect = { l: a.x, r: a.x + a.width, t: a.y, b: a.y + a.height };

      // Find Tables inside
      tables.forEach(t => {
        // Rough center checks or full containment? Center is best feel.
        const tW = 220; const tH = 100; // approx
        const tCx = t.x + tW / 2;
        const tCy = t.y + tH / 2;
        if (tCx > rect.l && tCx < rect.r && tCy > rect.t && tCy < rect.b) {
          if (!childTables.includes(t.id)) {
            childTables.push(t.id);
            childInitPositions.set(`t:${t.id}`, { x: t.x, y: t.y });
          }
        }
      });

      // Find Notes inside
      notes.forEach(n => {
        const nCx = n.x + n.width / 2;
        const nCy = n.y + n.height / 2;
        if (nCx > rect.l && nCx < rect.r && nCy > rect.t && nCy < rect.b) {
          if (!childNotes.includes(n.id)) {
            childNotes.push(n.id);
            childInitPositions.set(`n:${n.id}`, { x: n.x, y: n.y });
          }
        }
      });
    });

    dragArea.current = {
      active: true,
      initialMouseX: e.clientX,
      initialMouseY: e.clientY,
      initialPositions,
      childTables,
      childNotes,
      childInitPositions,
      pointerId: e.pointerId
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    // 1. Handle Table Drag
    if (dragTable.current.active) {
      e.preventDefault();
      const dx = (e.clientX - dragTable.current.initialMouseX) / camera.zoom;
      const dy = (e.clientY - dragTable.current.initialMouseY) / camera.zoom;

      const moves: { id: string, x: number, y: number }[] = [];
      const SNAP = 24;

      dragTable.current.initialPositions.forEach((initPos, id) => {
        let newX = initPos.x + dx;
        let newY = initPos.y + dy;

        if (snapToGrid) {
          newX = Math.round(newX / SNAP) * SNAP;
          newY = Math.round(newY / SNAP) * SNAP;
        }
        moves.push({ id, x: newX, y: newY });
      });

      if (moves.length > 0) {
        moveTables(moves);
      }
      return;
    }

    // 1.5 Handle Note Drag & Resize
    if (dragNote.current.active) {
      e.preventDefault();
      const dx = (e.clientX - dragNote.current.initialMouseX) / camera.zoom;
      const dy = (e.clientY - dragNote.current.initialMouseY) / camera.zoom;

      const moves: { id: string, x: number, y: number }[] = [];
      const SNAP = 24;

      dragNote.current.initialPositions.forEach((initPos, id) => {
        let newX = initPos.x + dx;
        let newY = initPos.y + dy;

        if (snapToGrid) {
          newX = Math.round(newX / SNAP) * SNAP;
          newY = Math.round(newY / SNAP) * SNAP;
        }
        moves.push({ id, x: newX, y: newY });
      });

      if (moves.length > 0) {
        moveNotes(moves);
      }
      return;
    }

    if (resizeNote.current.active) {
      e.preventDefault();
      const dx = (e.clientX - resizeNote.current.initialMouseX) / camera.zoom;
      const updateNote = useCanvasStore.getState().updateNote;

      const { initialWidth, initialX, direction, noteId } = resizeNote.current;

      if (direction === "right") {
        const newWidth = Math.max(100, initialWidth + dx); // Min width 100
        updateNote(noteId, { width: newWidth });
      } else {
        const newWidth = Math.max(100, initialWidth - dx);
        const newX = initialX + (initialWidth - newWidth); // Shift X to keep right side fixed
        updateNote(noteId, { width: newWidth, x: newX });
      }
      return;
    }



    // 1.8 Handle Area Drag & Resize
    if (dragArea.current.active) {
      e.preventDefault();
      const dx = (e.clientX - dragArea.current.initialMouseX) / camera.zoom;
      const dy = (e.clientY - dragArea.current.initialMouseY) / camera.zoom;
      const SNAP = 24;

      const moves: { id: string, x: number, y: number }[] = [];
      // Move Areas
      const areasState = useCanvasStore.getState().areas;
      dragArea.current.initialPositions.forEach((initPos, id) => {
        const area = areasState.find(a => a.id === id);
        if (area?.isLocked) return;

        let newX = initPos.x + dx;
        let newY = initPos.y + dy;
        if (snapToGrid) {
          newX = Math.round(newX / SNAP) * SNAP;
          newY = Math.round(newY / SNAP) * SNAP;
        }
        moves.push({ id, x: newX, y: newY });
      });
      if (moves.length > 0) moveAreas(moves);

      // Move Children (Tables)
      const tableMoves: { id: string, x: number, y: number }[] = [];
      dragArea.current.childTables.forEach(tId => {
        const init = dragArea.current.childInitPositions.get(`t:${tId}`);
        if (init) {
          let newX = init.x + dx;
          let newY = init.y + dy;
          if (snapToGrid) {
            newX = Math.round(newX / SNAP) * SNAP;
            newY = Math.round(newY / SNAP) * SNAP;
          }
          tableMoves.push({ id: tId, x: newX, y: newY });
        }
      });
      if (tableMoves.length > 0) moveTables(tableMoves);

      // Move Children (Notes)
      const noteMoves: { id: string, x: number, y: number }[] = [];
      dragArea.current.childNotes.forEach(nId => {
        const init = dragArea.current.childInitPositions.get(`n:${nId}`);
        if (init) {
          let newX = init.x + dx;
          let newY = init.y + dy;
          if (snapToGrid) {
            newX = Math.round(newX / SNAP) * SNAP;
            newY = Math.round(newY / SNAP) * SNAP;
          }
          noteMoves.push({ id: nId, x: newX, y: newY });
        }
      });
      if (noteMoves.length > 0) moveNotes(noteMoves);

      return;
    }

    if (resizeArea.current.active) {
      e.preventDefault();
      const dx = (e.clientX - resizeArea.current.initialMouseX) / camera.zoom;
      const dy = (e.clientY - resizeArea.current.initialMouseY) / camera.zoom;
      const updateArea = useCanvasStore.getState().updateArea;

      const { initialWidth, initialHeight, initialX, initialY, direction, areaId } = resizeArea.current;

      let newX = initialX;
      let newY = initialY;
      let newW = initialWidth;
      let newH = initialHeight;

      if (direction.includes("r")) {
        newW = Math.max(100, initialWidth + dx);
      }
      if (direction.includes("b")) {
        newH = Math.max(100, initialHeight + dy);
      }
      if (direction.includes("l")) {
        const proposedW = initialWidth - dx;
        if (proposedW >= 100) {
          newX = initialX + dx;
          newW = proposedW;
        }
      }
      if (direction.includes("t")) {
        const proposedH = initialHeight - dy;
        if (proposedH >= 100) {
          newY = initialY + dy;
          newH = proposedH;
        }
      }

      updateArea(areaId, { x: newX, y: newY, width: newW, height: newH });
      return;
    }

    // 2. Handle Connection Drag
    if (dragConnection.current.active) {
      e.preventDefault();
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;

      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      const worldX = (clientX - camera.x) / camera.zoom;
      const worldY = (clientY - camera.y) / camera.zoom;

      dragConnection.current.currentX = worldX;
      dragConnection.current.currentY = worldY;
      setTick(t => t + 1);
      return;
    }

    // 3. Handle Marquee Selection
    if (dragSelection.current.active) {
      e.preventDefault();
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;

      const worldX = (e.clientX - rect.left - camera.x) / camera.zoom;
      const worldY = (e.clientY - rect.top - camera.y) / camera.zoom;

      dragSelection.current.currentX = worldX;
      dragSelection.current.currentY = worldY;

      // Calculate normalized rect
      const x = Math.min(dragSelection.current.startX, worldX);
      const y = Math.min(dragSelection.current.startY, worldY);
      const w = Math.abs(worldX - dragSelection.current.startX);
      const h = Math.abs(worldY - dragSelection.current.startY);

      setSelectionRect({ x, y, w, h });
      return;
    }

    // 4. Handle Canvas Pan
    if (!drag.current.active) return;
    const dx = e.clientX - drag.current.lastX;
    const dy = e.clientY - drag.current.lastY;
    drag.current.lastX = e.clientX;
    drag.current.lastY = e.clientY;
    panBy(dx, dy);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const target = e.currentTarget as Element;

    // Handle Table Drop
    if (dragTable.current.active && dragTable.current.pointerId === e.pointerId) {
      dragTable.current.active = false;
      dragTable.current.pointerId = null;
      dragTable.current.initialPositions.clear();
      if (target.hasPointerCapture(e.pointerId)) {
        target.releasePointerCapture(e.pointerId);
      }
      return;
    }

    // Handle Note Drop
    if (dragNote.current.active && dragNote.current.pointerId === e.pointerId) {
      dragNote.current.active = false;
      dragNote.current.pointerId = null;
      dragNote.current.initialPositions.clear();
      if (target.hasPointerCapture(e.pointerId)) {
        target.releasePointerCapture(e.pointerId);
      }
      return;
    }

    if (resizeNote.current.active && resizeNote.current.pointerId === e.pointerId) {
      resizeNote.current.active = false;
      resizeNote.current.pointerId = null;
      if (target.hasPointerCapture(e.pointerId)) {
        target.releasePointerCapture(e.pointerId);
      }
      return;
    }

    if (dragArea.current.active && dragArea.current.pointerId === e.pointerId) {
      dragArea.current.active = false;
      dragArea.current.pointerId = null;
      dragArea.current.initialPositions.clear();
      dragArea.current.childInitPositions.clear();
      dragArea.current.childTables = [];
      dragArea.current.childNotes = [];
      if (target.hasPointerCapture(e.pointerId)) {
        target.releasePointerCapture(e.pointerId);
      }
      return;
    }

    if (resizeArea.current.active && resizeArea.current.pointerId === e.pointerId) {
      resizeArea.current.active = false;
      resizeArea.current.pointerId = null;
      if (target.hasPointerCapture(e.pointerId)) {
        target.releasePointerCapture(e.pointerId);
      }
      return;
    }

    // Handle Connection Drop
    if (dragConnection.current.active && dragConnection.current.pointerId === e.pointerId) {
      dragConnection.current.active = false;
      dragConnection.current.pointerId = null;
      if (target.hasPointerCapture(e.pointerId)) {
        target.releasePointerCapture(e.pointerId);
      }
      setTick(t => t + 1);

      // Check what we dropped on using data attributes
      const hitEl = document.elementFromPoint(e.clientX, e.clientY);
      const gripTableId = hitEl?.getAttribute("data-table-id");
      const gripColId = hitEl?.getAttribute("data-col-id");

      // Valid drop? (different table)
      if (gripTableId && gripColId && gripTableId !== dragConnection.current.sourceTableId) {
        addRelationship({
          id: crypto.randomUUID(),
          sourceTableId: dragConnection.current.sourceTableId,
          sourceColumnId: dragConnection.current.sourceColumnId,
          targetTableId: gripTableId,
          targetColumnId: gripColId
        });
      }

      return;
    }

    // Handle Marquee Drop
    if (dragSelection.current.active && dragSelection.current.pointerId === e.pointerId) {
      dragSelection.current.active = false;
      dragSelection.current.pointerId = null;
      if (target.hasPointerCapture(e.pointerId)) {
        target.releasePointerCapture(e.pointerId);
      }

      // Sync Calculation using Ref (more reliable than state during rapid events)
      const { startX, startY, currentX, currentY } = dragSelection.current;

      // Normalize bounds
      const rX = Math.min(startX, currentX);
      const rY = Math.min(startY, currentY);
      const rR = Math.max(startX, currentX);
      const rB = Math.max(startY, currentY);

      // Only select if box has some size (avoid accidental clicks acting as tiny drags)
      if (Math.abs(currentX - startX) > 5 || Math.abs(currentY - startY) > 5) {
        const insideIds: string[] = [];

        tables.forEach(t => {
          // Estimate Table Bounds
          const estWidth = 220;
          const estHeight = 36 + (t.columns?.length || 0) * 30; // Exact match to TableNode

          const tX = t.x;
          const tY = t.y;
          const tR = t.x + estWidth;
          const tB = t.y + estHeight;

          // AABB Intersection: Rect overlaps Table
          // Check if rectangles overlap
          const overlaps = (rX < tR && rR > tX && rY < tB && rB > tY);

          if (overlaps) {
            insideIds.push(t.id);
          }
        });

        if (insideIds.length > 0) {
          setSelectedTableIds(e.shiftKey ? [...selectedTableIds, ...insideIds] : insideIds);
        } else if (!e.shiftKey) {
          setSelectedTableIds([]);
        }
      }

      setSelectionRect(null);
      return;
    }

    if (drag.current.pointerId !== e.pointerId) return;
    drag.current.active = false;
    drag.current.pointerId = null;
  };

  /**
   * DrawDB-like wheel behavior:
   * - wheel => pan
   * - shift+wheel => horizontal pan
   * - ctrl/meta+wheel => zoom at cursor
   */
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      const isZoomGesture = e.ctrlKey || e.metaKey;

      if (isZoomGesture) {
        const factor = Math.exp(-e.deltaY * 0.0015);
        const safeFactor = clamp(factor, 0.85, 1.15);
        zoomAt(safeFactor, sx, sy);
        return;
      }

      let dx = -e.deltaX;
      let dy = -e.deltaY;

      if (e.shiftKey) {
        dx = -e.deltaY;
        dy = 0;
      }

      dx = clamp(dx, -120, 120);
      dy = clamp(dy, -120, 120);

      panBy(dx, dy);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [panBy, zoomAt]);

  const worldTransform = useMemo(
    () => `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
    [camera.x, camera.y, camera.zoom]
  );

  return (
    <div
      ref={rootRef}
      className="relative h-full w-full overflow-hidden bg-background"
    >
      {/* World */}
      <div
        className="absolute inset-0 touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{ cursor: spaceDown ? "grab" : "default" }}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width: WORLD_WIDTH,
            height: WORLD_HEIGHT,
            transform: worldTransform,
          }}
        >
          <WorldBackground
            w={WORLD_WIDTH}
            h={WORLD_HEIGHT}
            variant={background}
          />

          {/* SVG Layer for Tables */}
          <svg
            width={WORLD_WIDTH}
            height={WORLD_HEIGHT}
            className="absolute inset-0 overflow-visible pointer-events-none"
          >
            {/* Existing Relationships */}
            {relationships.map(rel => {
              const start = getColumnPosition(rel.sourceTableId, rel.sourceColumnId, true);
              const end = getColumnPosition(rel.targetTableId, rel.targetColumnId, false);

              if (!start || !end) return null;

              const pathData = calculatePath(start.x, start.y, end.x, end.y);
              const mid = calculateMidpoint(start.x, start.y, end.x, end.y);
              const isHovered = hoveredRelationshipId === rel.id;
              const isSelected = selectedRelationshipId === rel.id;
              const label = rel.name || "Relationship";

              return (
                <g
                  key={rel.id}
                  onPointerEnter={() => setHoveredRelationshipId(rel.id)}
                  onPointerLeave={() => setHoveredRelationshipId(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedRelationshipId(rel.id);
                    openTab("relationships", "left");
                  }}
                  className="cursor-pointer"
                >
                  {/* Invisible hit area for easier hovering */}
                  <path
                    d={pathData}
                    fill="none"
                    strokeWidth={12}
                    className={styles["relationship-hit-area"]}
                    style={{ pointerEvents: "auto" }}
                  />
                  {/* The actual visible line */}
                  <path
                    d={pathData}
                    stroke={isSelected ? "var(--primary)" : "var(--primary)"}
                    strokeWidth={isSelected ? 3 : 2}
                    fill="none"
                    className={`${styles["relationship-path"]} ${isHovered ? styles["marching-ants"] : ""}`}
                    style={{
                      filter: isSelected ? "drop-shadow(0 0 4px var(--primary))" : "none",
                      opacity: isSelected ? 1 : 0.8
                    }}
                  />

                  {/* Hover Label */}
                  {isHovered && (
                    <g transform={`translate(${mid.x}, ${mid.y})`}>
                      {/* Background for label */}
                      <rect
                        x={-label.length * 4 - 8}
                        y={-12}
                        width={label.length * 8 + 16}
                        height={24}
                        rx={4}
                        fill="var(--popover)"
                        stroke="var(--border)"
                        strokeWidth={1}
                        className="shadow-md"
                      />
                      <text
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="var(--popover-foreground)"
                        fontSize={11}
                        fontWeight="600"
                        style={{ pointerEvents: "none", userSelect: "none" }}
                      >
                        {label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Pending Connection */}
            {dragConnection.current.active && (
              <path
                d={calculatePath(
                  dragConnection.current.startX,
                  dragConnection.current.startY,
                  dragConnection.current.currentX,
                  dragConnection.current.currentY
                )}
                stroke="var(--primary)"
                strokeWidth={2}
                fill="none"
                strokeDasharray="5,5"
                opacity={0.6}
              />
            )}

            {/* Areas */}
            {areas.map((area) => (
              <g
                key={area.id}
                className="pointer-events-auto cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => onAreaPointerDown(e, area.id)}
              >
                <AreaNode
                  area={area}
                  selected={selectedAreaIds.includes(area.id)}
                />
              </g>
            ))}

            {/* Notes */}
            {notes.map((note) => (
              <g
                key={note.id}
                className="pointer-events-auto cursor-pointer"
                onPointerDown={(e) => onNotePointerDown(e, note.id)}
              >
                <NoteNode
                  note={note}
                  selected={selectedNoteIds.includes(note.id)}
                />
              </g>
            ))}

            {/* Tables */}
            {tables.map((table) => (
              <g
                key={table.id}
                className="pointer-events-auto cursor-pointer"
                onPointerDown={(e) => onTablePointerDown(e, table.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  // Click logic now handled in onPointerDown/Up mostly, 
                  // but we might want to ensure robust behavior here if needed.
                  // For now, let's leave it empty or remove this handler as selection is pointer-down based.
                  // However, let's keep it to catch any edge cases or bubbling, but do nothing 
                  // to avoid conflict with drag start selection logic.
                }}
              >
                <TableNode
                  table={table}
                  selected={selectedTableIds.includes(table.id)}
                  onColumnPointerDown={(e, colId, isSource) => onColumnPointerDown(e, table.id, colId, isSource)}
                />
              </g>
            ))}

            {/* Marquee Selection Rectangle */}
            {selectionRect && (
              <rect
                x={selectionRect.x}
                y={selectionRect.y}
                width={selectionRect.w}
                height={selectionRect.h}
                fill="rgba(59, 130, 246, 0.1)" // blue-500 with opacity
                stroke="rgba(59, 130, 246, 0.5)"
                strokeWidth={1}
                pointerEvents="none"
              />
            )}
          </svg>
        </div>
      </div>

      {/* Minimap overlay */}
      <Minimap
        className="absolute bottom-4 right-4"
        world={{ w: WORLD_WIDTH, h: WORLD_HEIGHT }}
        viewport={viewport}
        camera={camera}
        tables={tables}
        notes={notes}
        areas={areas}
        onRecenter={(worldX, worldY) => {
          const targetScreenX = viewport.w / 2;
          const targetScreenY = viewport.h / 2;

          const nextX = targetScreenX - worldX * camera.zoom;
          const nextY = targetScreenY - worldY * camera.zoom;

          // ✅ go through store action so clamping is applied
          setCameraXY(nextX, nextY);
        }}
      />
    </div>
  );
}
