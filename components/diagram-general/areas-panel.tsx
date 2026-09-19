"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ChevronDown, ChevronsDownUp, Crosshair, Lock, Plus, Search, SquareDashed, Trash2 } from "lucide-react";

import { useCanvasStore, TABLE_COLORS, type Area, type Table } from "@/store/useCanvasStore";
import { usePanelStyle } from "@/store/usePanelStyleStore";
import { useCanvasStyle } from "@/store/useCanvasStyleStore";
import { TABLE_GEOMETRY, tableHeight } from "@/components/diagram-sections/canvas/canvas-style";
import { splitSchemaName } from "@/lib/schema-namespace";
import { cn } from "@/lib/utils";
import { CommittedInput } from "./committed-input";
import { AreaGlyph } from "./panel-glyphs";
import { focusAreaOnCanvas, focusTableOnCanvas } from "./use-diagram-issues";
import styles from "./areas-panel.module.scss";

const tc = (color: string) => ({ "--tc": color }) as CSSProperties;
/** Tables listed on a closed card before the rest collapse into "+N". */
const PREVIEW_TABLES = 4;

export function AreasPanel() {
  const areas = useCanvasStore((s) => s.areas);
  const tables = useCanvasStore((s) => s.tables);
  const selectedAreaIds = useCanvasStore((s) => s.selectedAreaIds);
  const addArea = useCanvasStore((s) => s.addArea);
  const updateArea = useCanvasStore((s) => s.updateArea);
  const deleteArea = useCanvasStore((s) => s.deleteArea);
  const setSelectedAreaIds = useCanvasStore((s) => s.setSelectedAreaIds);
  const { variant } = usePanelStyle("areas");
  // Table sizes depend on the canvas look, so containment reads its geometry.
  const geo = TABLE_GEOMETRY[useCanvasStyle().table];

  const isSingleSelection = selectedAreaIds.length === 1;
  const selectionKey = selectedAreaIds.join(",");

  // Cards start closed. Expansion is tracked apart from selection so a card can
  // be folded by clicking its header again without losing the canvas selection.
  const [expandedAreaId, setExpandedAreaId] = useState<string | null>(
    isSingleSelection ? selectedAreaIds[0] : null
  );
  const [query, setQuery] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);

  // An area picked on the canvas opens its card and scrolls to it.
  useEffect(() => {
    const id = selectedAreaIds.length === 1 ? selectedAreaIds[0] : null;
    setExpandedAreaId(id);
    if (!id) return;
    const raf = requestAnimationFrame(() => {
      const box = bodyRef.current;
      const el = box?.querySelector(`[data-area-id="${CSS.escape(id)}"]`);
      if (!box || !el) return;
      const r = el.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      if (r.top < b.top || r.top > b.bottom - 80) {
        box.scrollTo({ top: box.scrollTop + r.top - b.top - 12, behavior: "smooth" });
      }
    });
    return () => cancelAnimationFrame(raf);
    // Only react to an actual change of selection, not to unrelated store updates,
    // so a manual collapse isn't immediately undone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey]);

  // A table counts as inside an area when its centre is.
  const contained = useMemo(() => {
    const map = new Map<string, Table[]>();
    for (const area of areas) {
      map.set(
        area.id,
        tables.filter((t) => {
          const cx = t.x + geo.width / 2;
          const cy = t.y + tableHeight(geo, t.columns.length) / 2;
          return cx >= area.x && cx <= area.x + area.width && cy >= area.y && cy <= area.y + area.height;
        })
      );
    }
    return map;
  }, [areas, tables, geo]);

  const needle = query.trim().toLowerCase();
  const visible = areas.filter(
    (a) =>
      !needle ||
      needle
        .split(/\s+/)
        .every((w) =>
          `${a.title} ${(contained.get(a.id) ?? []).map((t) => t.name).join(" ")}`.toLowerCase().includes(w)
        )
  );

  const onHeaderClick = (e: React.MouseEvent | React.KeyboardEvent, area: Area) => {
    const isSelected = selectedAreaIds.includes(area.id);
    if (e.ctrlKey || e.metaKey) {
      setSelectedAreaIds(
        isSelected ? selectedAreaIds.filter((id) => id !== area.id) : [...selectedAreaIds, area.id]
      );
      return;
    }
    if (isSelected && isSingleSelection) {
      setExpandedAreaId(expandedAreaId === area.id ? null : area.id);
    } else {
      setSelectedAreaIds([area.id]);
    }
  };

  const onKey = (e: React.KeyboardEvent, fn: () => void) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  };

  const renderArea = (area: Area) => {
    const isSelected = selectedAreaIds.includes(area.id);
    const isOpen = expandedAreaId === area.id && isSingleSelection;
    const title = area.title.trim();
    const inside = contained.get(area.id) ?? [];

    return (
      <div
        key={area.id}
        data-area-id={area.id}
        className={cn(
          styles.tb,
          styles.card,
          styles.area,
          !isOpen && styles.closed,
          isOpen ? styles.cardOpen : isSelected && styles.cardSelected
        )}
        style={tc(area.color)}
      >
        <div
          className={styles.tbHead}
          role="button"
          tabIndex={0}
          aria-expanded={isOpen}
          onClick={(e) => onHeaderClick(e, area)}
          onKeyDown={(e) => onKey(e, () => onHeaderClick(e, area))}
        >
          <span className={styles.chev}>
            <ChevronDown className="w-3 h-3" />
          </span>
          <span className={styles.mk} style={tc(area.color)}>
            <AreaGlyph />
          </span>
          <span className={cn(styles.tname, !title && styles.untitled)} title={title || undefined}>
            {title || "Untitled area"}
          </span>
          <span className={styles.meta}>
            {area.isLocked && (
              <span className={cn(styles.metaItem, styles.locked)} title="Locked">
                <Lock className="w-3 h-3" />
              </span>
            )}
            <span>
              {inside.length} table{inside.length === 1 ? "" : "s"}
            </span>
          </span>
        </div>

        {/* Closed cards list what the area holds; the compact style stays one line. */}
        {!isOpen && variant !== "dense" && (
          <div className={styles.contains} onClick={(e) => onHeaderClick(e, area)}>
            {inside.length === 0 ? (
              <span>No tables inside yet</span>
            ) : (
              <div className={styles.tableChips}>
                {inside.slice(0, PREVIEW_TABLES).map((t) => (
                  <span key={t.id} className={styles.chip} style={tc(t.color)} title={t.name}>
                    <i />
                    <span className={styles.tname}>{splitSchemaName(t.name).table}</span>
                  </span>
                ))}
                {inside.length > PREVIEW_TABLES && (
                  <span className={styles.more}>+{inside.length - PREVIEW_TABLES}</span>
                )}
              </div>
            )}
          </div>
        )}

        {isOpen && (
          <div className={styles.settings}>
            <label className={styles.field}>
              Title
              <CommittedInput
                value={area.title}
                onCommit={(next) => updateArea(area.id, { title: next })}
                placeholder="Untitled area"
                className={styles.input}
              />
            </label>

            <div className={styles.sec}>
              <h4>Color</h4>
              <div className={styles.swatches}>
                {TABLE_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Color ${color}`}
                    aria-pressed={area.color === color}
                    style={{ "--c": color } as CSSProperties}
                    onClick={() => updateArea(area.id, { color })}
                  />
                ))}
              </div>
            </div>

            <div className={styles.sec}>
              <h4>Tables inside</h4>
              {inside.length === 0 ? (
                <p className={styles.hint}>Drag tables into this area on the canvas to group them.</p>
              ) : (
                <div className={styles.tableChips}>
                  {inside.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      style={tc(t.color)}
                      title={`Show ${t.name} on the canvas`}
                      onClick={() => focusTableOnCanvas(t.id)}
                    >
                      <i />
                      <span className={styles.tname}>{splitSchemaName(t.name).table}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <p className={styles.size}>
              {Math.round(area.width)} × {Math.round(area.height)} px
            </p>

            <div className={styles.actions}>
              <button type="button" className={styles.btn} onClick={() => focusAreaOnCanvas(area.id)}>
                <Crosshair className="w-3.5 h-3.5" />
                Show on canvas
              </button>
              <button
                type="button"
                className={cn(styles.btn, area.isLocked && styles.btnOn)}
                aria-pressed={area.isLocked}
                onClick={() => updateArea(area.id, { isLocked: !area.isLocked })}
              >
                <Lock className="w-3.5 h-3.5" />
                {area.isLocked ? "Locked" : "Lock"}
              </button>
              <button type="button" className={cn(styles.btn, styles.btnDanger)} onClick={() => deleteArea(area.id)}>
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.panel} data-v={variant}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h3>Areas</h3>
          <span className={styles.count}>{needle ? `${visible.length} / ${areas.length}` : areas.length}</span>
          <span className={styles.spacer} />
          {expandedAreaId && isSingleSelection && (
            <button
              type="button"
              className={styles.iconBtn}
              title="Close the open area"
              aria-label="Close the open area"
              onClick={() => setExpandedAreaId(null)}
            >
              <ChevronsDownUp className="w-3.5 h-3.5" />
            </button>
          )}
          <button type="button" className={styles.addBtn} onClick={addArea}>
            <Plus className="w-3.5 h-3.5" />
            Add area
          </button>
        </div>
        {areas.length > 0 && (
          <label className={styles.search}>
            <Search className="w-3.5 h-3.5 shrink-0" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter areas or tables"
              aria-label="Filter areas"
            />
          </label>
        )}
      </div>

      <div className={styles.body} ref={bodyRef}>
        {areas.length === 0 ? (
          <div className={styles.emptyState}>
            <SquareDashed className="w-8 h-8" />
            <p>Areas frame groups of tables on the canvas, like a module or a bounded context.</p>
            <button type="button" className={styles.btn} onClick={addArea}>
              <Plus className="w-3.5 h-3.5" />
              Add area
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className={styles.empty}>No areas match “{query.trim()}”.</div>
        ) : (
          <div className={styles.list}>{visible.map(renderArea)}</div>
        )}
      </div>
    </div>
  );
}
