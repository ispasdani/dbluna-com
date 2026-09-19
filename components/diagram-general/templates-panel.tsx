"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Check, ChevronDown, ChevronsDownUp, Plus, Search } from "lucide-react";

import { useCanvasStore, type Relationship, type Table } from "@/store/useCanvasStore";
import { useEditorStore } from "@/store/useEditorStore";
import { usePanelStyle } from "@/store/usePanelStyleStore";
import { useCanvasStyle } from "@/store/useCanvasStyleStore";
import { TABLE_GEOMETRY, tableHeight, type TableGeometry } from "@/components/diagram-sections/canvas/canvas-style";
import { TEMPLATES, type Template } from "@/constants/templates";
import { cn } from "@/lib/utils";
import { TemplateGlyph } from "./panel-glyphs";
import styles from "./templates-panel.module.scss";

const TEMPLATE_TINT = { "--tc": "var(--primary)" } as CSSProperties;

/**
 * Appends a copy of the template to the canvas, centred on the viewport, with
 * fresh ids so the same template can be added more than once. Returns the new
 * table ids.
 */
function applyTemplate(template: Template): string[] {
  const { viewport, camera } = useEditorStore.getState();
  const store = useCanvasStore.getState();

  const idMap = new Map<string, string>();
  for (const t of template.tables) {
    idMap.set(t.id, crypto.randomUUID());
    for (const c of t.columns) idMap.set(c.id, crypto.randomUUID());
  }

  const worldCenterX = (viewport.w / 2 - camera.x) / camera.zoom;
  const worldCenterY = (viewport.h / 2 - camera.y) / camera.zoom;

  const newTables: Table[] = template.tables.map((t) => ({
    ...t,
    id: idMap.get(t.id)!,
    // The template layouts are roughly 900 × 700; centre that on the viewport.
    x: worldCenterX + t.x - 450,
    y: worldCenterY + t.y - 350,
    columns: t.columns.map((c) => ({ ...c, id: idMap.get(c.id)! })),
  }));

  const newRelationships: Relationship[] = template.relationships.map((r) => ({
    ...r,
    id: crypto.randomUUID(),
    sourceTableId: idMap.get(r.sourceTableId)!,
    sourceColumnId: idMap.get(r.sourceColumnId)!,
    targetTableId: idMap.get(r.targetTableId)!,
    targetColumnId: idMap.get(r.targetColumnId)!,
  }));

  store.setTables([...store.tables, ...newTables]);
  for (const rel of newRelationships) useCanvasStore.getState().addRelationship(rel);

  return newTables.map((t) => t.id);
}

/** Miniature of the template's layout: tables in their colours, links as lines. */
function TemplateThumb({ template, geo, height }: { template: Template; geo: TableGeometry; height: number }) {
  const { boxes, viewBox } = useMemo(() => {
    const b = template.tables.map((t) => ({ t, w: geo.width, h: tableHeight(geo, t.columns.length) }));
    const pad = 40;
    const minX = Math.min(...b.map((x) => x.t.x)) - pad;
    const minY = Math.min(...b.map((x) => x.t.y)) - pad;
    const maxX = Math.max(...b.map((x) => x.t.x + x.w)) + pad;
    const maxY = Math.max(...b.map((x) => x.t.y + x.h)) + pad;
    return { boxes: b, viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}` };
  }, [template, geo]);

  const byId = new Map(boxes.map((b) => [b.t.id, b]));
  const centre = (id: string) => {
    const b = byId.get(id);
    return b ? { x: b.t.x + b.w / 2, y: b.t.y + b.h / 2 } : null;
  };

  return (
    <svg className={styles.thumb} viewBox={viewBox} height={height} preserveAspectRatio="xMidYMid meet" aria-hidden>
      {template.relationships.map((r) => {
        const a = centre(r.sourceTableId);
        const z = centre(r.targetTableId);
        if (!a || !z) return null;
        return (
          <line
            key={r.id}
            x1={a.x}
            y1={a.y}
            x2={z.x}
            y2={z.y}
            stroke="var(--muted-foreground)"
            strokeOpacity={0.45}
            strokeWidth={1.2}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
      {boxes.map(({ t, w, h }) => (
        <g key={t.id}>
          <rect x={t.x} y={t.y} width={w} height={h} rx={geo.radius} fill="var(--table-bg)" />
          <rect
            x={t.x}
            y={t.y}
            width={w}
            height={h}
            rx={geo.radius}
            fill={t.color}
            fillOpacity={0.1}
            stroke={t.color}
            strokeOpacity={0.7}
            strokeWidth={1.2}
            vectorEffect="non-scaling-stroke"
          />
          <rect x={t.x} y={t.y} width={w} height={geo.headerHeight} rx={geo.radius} fill={t.color} fillOpacity={0.85} />
          <rect x={t.x} y={t.y + geo.headerHeight / 2} width={w} height={geo.headerHeight / 2} fill={t.color} fillOpacity={0.85} />
          {t.columns.map((c, i) => (
            <rect
              key={c.id}
              x={t.x + 14}
              y={t.y + geo.headerHeight + geo.padTop + i * geo.rowHeight + geo.rowHeight / 2 - 3}
              width={c.isPrimaryKey ? w * 0.35 : w * (0.45 + ((i * 37) % 25) / 100)}
              height={6}
              rx={3}
              fill={c.isPrimaryKey ? t.color : "var(--muted-foreground)"}
              fillOpacity={c.isPrimaryKey ? 0.6 : 0.22}
            />
          ))}
        </g>
      ))}
    </svg>
  );
}

export function TemplatesPanel() {
  const setSelectedTableIds = useCanvasStore((s) => s.setSelectedTableIds);
  const { variant } = usePanelStyle("templates");
  const geo = TABLE_GEOMETRY[useCanvasStyle().table];

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addedId, setAddedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // The "Added" confirmation clears itself after a moment.
  useEffect(() => {
    if (!addedId) return;
    const timer = setTimeout(() => setAddedId(null), 2500);
    return () => clearTimeout(timer);
  }, [addedId]);

  const needle = query.trim().toLowerCase();
  const visible = TEMPLATES.filter(
    (t) =>
      !needle ||
      needle
        .split(/\s+/)
        .every((w) =>
          `${t.name} ${t.description} ${t.tables.map((x) => x.name).join(" ")}`.toLowerCase().includes(w)
        )
  );

  const add = (template: Template) => {
    const ids = applyTemplate(template);
    // Select what was just added so it's obvious on the canvas.
    setSelectedTableIds(ids);
    setAddedId(template.id);
  };

  const onKey = (e: React.KeyboardEvent, fn: () => void) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  };

  const renderTemplate = (template: Template) => {
    const isOpen = expandedId === template.id;
    const toggle = () => setExpandedId(isOpen ? null : template.id);
    const columnCount = template.tables.reduce((n, t) => n + t.columns.length, 0);
    const justAdded = addedId === template.id;

    return (
      <div
        key={template.id}
        className={cn(styles.tb, styles.card, !isOpen && styles.closed, isOpen && styles.cardOpen)}
        style={TEMPLATE_TINT}
      >
        <div
          className={styles.tbHead}
          role="button"
          tabIndex={0}
          aria-expanded={isOpen}
          onClick={toggle}
          onKeyDown={(e) => onKey(e, toggle)}
        >
          <span className={styles.chev}>
            <ChevronDown className="w-3 h-3" />
          </span>
          <span className={styles.mk}>
            <TemplateGlyph />
          </span>
          <span className={styles.tname}>{template.name}</span>
          <span className={styles.meta}>
            {template.tables.length} tables
          </span>
        </div>

        {/* Closed cards show the layout and the pitch; the compact style stays one line. */}
        {!isOpen && variant !== "dense" && (
          <div className={styles.closedBody} onClick={toggle}>
            <TemplateThumb template={template} geo={geo} height={110} />
            <p className={cn(styles.description, styles.clamp)}>{template.description}</p>
          </div>
        )}

        {isOpen && (
          <div className={styles.settings}>
            <TemplateThumb template={template} geo={geo} height={170} />
            <p className={styles.description}>{template.description}</p>

            <div className={styles.stats}>
              <div>
                <b>{template.tables.length}</b>tables
              </div>
              <div>
                <b>{template.relationships.length}</b>relationships
              </div>
              <div>
                <b>{columnCount}</b>columns
              </div>
            </div>

            <div className={styles.sec}>
              <h4>Tables</h4>
              <div className={styles.tableChips}>
                {template.tables.map((t) => (
                  <span key={t.id} className={styles.chip} style={{ "--tc": t.color } as CSSProperties}>
                    <i />
                    {t.name}
                    <span className={styles.cols}>{t.columns.length}</span>
                  </span>
                ))}
              </div>
            </div>

            <div className={styles.apply}>
              <button type="button" className={styles.primaryBtn} onClick={() => add(template)}>
                <Plus className="w-3.5 h-3.5" />
                Add to canvas
              </button>
              {justAdded && (
                <span className={styles.added} role="status">
                  <Check className="w-3.5 h-3.5" />
                  Added
                </span>
              )}
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
          <h3>Templates</h3>
          <span className={styles.count}>{needle ? `${visible.length} / ${TEMPLATES.length}` : TEMPLATES.length}</span>
          <span className={styles.spacer} />
          {expandedId && (
            <button
              type="button"
              className={styles.iconBtn}
              title="Close the open template"
              aria-label="Close the open template"
              onClick={() => setExpandedId(null)}
            >
              <ChevronsDownUp className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <p className={styles.intro}>Start from a ready-made schema. It&apos;s added next to what you already have.</p>
        <label className={styles.search}>
          <Search className="w-3.5 h-3.5 shrink-0" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter templates or tables"
            aria-label="Filter templates"
          />
        </label>
      </div>

      <div className={styles.body}>
        {visible.length === 0 ? (
          <div className={styles.empty}>No templates match “{query.trim()}”.</div>
        ) : (
          <div className={styles.list}>{visible.map(renderTemplate)}</div>
        )}
      </div>
    </div>
  );
}
