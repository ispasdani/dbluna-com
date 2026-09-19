"use client";

import { useCanvasStore, type Table, type Column, TABLE_COLORS } from "@/store/useCanvasStore";
import { Lock, Unlock, MoreVertical, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import React, { memo, useState, useSyncExternalStore } from "react";
import {
  getCanvasFontFamily,
  getFontsReadyServerSnapshot,
  getFontsReadySnapshot,
  measureTextWidth,
  subscribeFontsReady,
  truncateTextToWidth,
} from "@/lib/svg-text";
import {
  TABLE_GEOMETRY,
  rowTopY,
  tableHeight,
  type CanvasStyle,
  type HandleShape,
  type Side,
  type TableGeometry,
  type TableVariant,
} from "./canvas-style";
import styles from "./table-node.module.scss";

interface TableNodeProps {
  table: Table;
  canvasStyle: CanvasStyle;
  selected?: boolean;
  /** Focus mode: outside the selection's neighbourhood — faded and inert. */
  isDimmed?: boolean;
  /** Hover focus elsewhere — faded but still interactive. */
  isFaded?: boolean;
  readOnly?: boolean;
  /** Hide connection handles (read-only viewer, SVG export). */
  hidePorts?: boolean;
  /**
   * Connected handles, `colId|side|color` joined by `;` (color may be empty).
   * A string so the memo comparison stays a cheap equality check.
   */
  connectedPorts?: string;
  /** Column ids whose relationships are currently lit, joined by `;`. */
  linkedColumns?: string;
  /** Column ids that are foreign keys, joined by `;`. */
  foreignKeys?: string;
  /** Row the in-progress connection would drop onto. */
  dropColumnId?: string;
  /** `colId|side` of the handle a connection is being dragged from. */
  sourcePort?: string;
  onColumnPointerDown?: (e: React.PointerEvent, tableId: string, columnId: string, side: Side) => void;
  /** `undefined` = pointer left the table; `null` = over the table but not a row. */
  onHoverChange?: (tableId: string, columnId: string | null | undefined) => void;
}

const MONO = "var(--font-mono)";
const SANS = "var(--font-sans)";
const ACTIONS_WIDTH = 60;

const splitList = (s?: string) => new Set(s ? s.split(";") : []);

function topRoundedPath(w: number, h: number, r: number, o = 0) {
  return `M${o} ${h}V${r}A${r - o} ${r - o} 0 0 1 ${r} ${o}H${w - r}A${r - o} ${r - o} 0 0 1 ${w - o} ${r}V${h}Z`;
}

function bottomRoundedRow(w: number, h: number, r: number) {
  const rr = r - 0.5;
  return `M.5 0H${w - 0.5}V${h - rr - 0.5}A${rr} ${rr} 0 0 1 ${w - rr - 0.5} ${h - 0.5}H${rr + 0.5}A${rr} ${rr} 0 0 1 .5 ${h - rr - 0.5}Z`;
}

// 12×12 glyphs drawn with strokes so they inherit the row's colour tokens.
function KeyIcon({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g transform={`translate(${x},${y})`} fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round">
      <circle cx={3.6} cy={6} r={2.6} />
      <path d="M6.2 6H11.4M9.6 6V8.2M11.4 6V7.8" />
    </g>
  );
}
function LinkIcon({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g transform={`translate(${x},${y})`} fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round">
      <path d="M4.6 7.4 7.4 4.6" />
      <path d="M6.2 3.2 7.3 2.1a2.3 2.3 0 0 1 3.3 3.3L9.5 6.5" />
      <path d="M5.8 8.8 4.7 9.9a2.3 2.3 0 0 1-3.3-3.3L2.5 5.5" />
    </g>
  );
}
function UniqueIcon({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <path
      transform={`translate(${x},${y})`}
      d="M6 2.4 9.6 6 6 9.6 2.4 6Z"
      fill="none"
      stroke={color}
      strokeWidth={1.4}
      strokeLinejoin="round"
    />
  );
}
function TableIcon({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g transform={`translate(${x},${y})`} fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round">
      <rect x={1} y={1.5} width={10} height={9} rx={2} />
      <path d="M1 4.8H11M4.6 4.8V10.5" />
    </g>
  );
}

function ColumnIcon({ col, isFk, x, y }: { col: Column; isFk: boolean; x: number; y: number }) {
  if (col.isPrimaryKey) return <KeyIcon x={x} y={y} color="var(--tc)" />;
  if (isFk) return <LinkIcon x={x} y={y} color="var(--muted-foreground)" />;
  if (col.isUnique) return <UniqueIcon x={x} y={y} color="var(--muted-foreground)" />;
  return null;
}

function Port({
  shape,
  side,
  x,
  y,
  rowHeight,
  tableId,
  colId,
  color,
  connected,
  hot,
  source,
  onPointerDown,
}: {
  shape: HandleShape;
  side: Side;
  x: number;
  y: number;
  rowHeight: number;
  tableId: string;
  colId: string;
  color?: string;
  connected: boolean;
  hot: boolean;
  source: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
}) {
  let idle: React.ReactNode;
  let conn: React.ReactNode;
  if (shape === "tab") {
    idle = <rect className={styles.idle} x={-3.5} y={-8} width={7} height={16} rx={3.5} />;
    conn = <rect className={styles.conn} x={-3} y={-7.5} width={6} height={15} rx={3} />;
  } else if (shape === "plus") {
    idle = (
      <g className={styles.idle}>
        <circle r={7.5} />
        <path d="M-3.2 0H3.2M0 -3.2V3.2" />
      </g>
    );
    conn = <circle className={styles.conn} r={3.75} />;
  } else if (shape === "notch") {
    const h = rowHeight - 12;
    idle = <circle className={styles.idle} r={4.5} />;
    conn = <rect className={cn(styles.conn, styles.connFlat)} x={-1.75} y={-h / 2} width={3.5} height={h} rx={1.75} />;
  } else {
    idle = <circle className={styles.idle} r={4.5} />;
    conn = <circle className={styles.conn} r={3.75} />;
  }

  return (
    <g
      className={styles.port}
      transform={`translate(${x},${y})`}
      data-connected={connected || undefined}
      data-hot={hot || undefined}
      data-source={source || undefined}
      data-table-id={tableId}
      data-col-id={colId}
      data-side={side}
      style={color ? ({ "--pc": color } as React.CSSProperties) : undefined}
      onPointerDown={onPointerDown}
    >
      <g className={styles.portInner}>
        <circle className={styles.portHit} r={10} />
        {idle}
        {conn}
      </g>
    </g>
  );
}

interface HeaderProps {
  table: Table;
  variant: TableVariant;
  g: TableGeometry;
  height: number;
  readOnly?: boolean;
  titleFont: string;
}

function Header({ table, variant, g, height, readOnly, titleFont }: HeaderProps) {
  const W = g.width;
  const H = g.headerHeight;
  const cy = H / 2;

  const nameX = variant === "chips" ? 48 : variant === "dense" ? 26 : 34;
  const nameMax = W - nameX - 14 - (readOnly ? 0 : ACTIONS_WIDTH - 10);

  // Dense cards show a `schema.` prefix in muted text when the name has one.
  const dot = variant === "dense" ? table.name.lastIndexOf(".") : -1;
  const schema = dot > 0 ? table.name.slice(0, dot + 1) : "";
  const bare = dot > 0 ? table.name.slice(dot + 1) : table.name;
  const nameFont = variant === "dense" ? `500 12.5px monospace` : titleFont;
  const fitted = truncateTextToWidth(schema + bare, nameFont, nameMax);

  const nameFill = variant === "header" ? "#fff" : "var(--foreground)";
  const count = table.columns.length;
  const countLabel = variant === "chips" ? `${count} columns` : `${count} cols`;

  return (
    <>
      {variant === "header" && <path d={topRoundedPath(W, H, g.radius)} fill="var(--tc)" />}
      {variant === "dense" && (
        <>
          <path
            d={`M.5 ${H}H26V${height - 0.5}H${g.radius}A${g.radius - 0.5} ${g.radius - 0.5} 0 0 1 .5 ${height - g.radius}Z`}
            className={styles.gutter}
          />
          <line x1={26} x2={26} y1={H} y2={height} stroke="var(--border)" />
        </>
      )}

      {variant === "soft" && <rect x={14} y={cy - 6} width={12} height={12} rx={3.5} fill="var(--tc)" />}
      {variant === "header" && <TableIcon x={14} y={cy - 6} color="#fff" />}
      {variant === "dense" && <circle cx={13} cy={cy} r={4} fill="var(--tc)" />}
      {variant === "chips" && (
        <>
          <rect className={styles.chipIcon} x={12} y={cy - 13} width={26} height={26} rx={8} />
          <TableIcon x={19} y={cy - 6} color="var(--tc)" />
        </>
      )}

      <text
        x={nameX}
        y={cy}
        dominantBaseline="central"
        fill={nameFill}
        fontSize={variant === "dense" ? 12.5 : 13.5}
        fontWeight={variant === "dense" ? 500 : 600}
        fontFamily={variant === "dense" ? MONO : SANS}
        className={styles.noEvents}
      >
        {schema && !fitted.truncated ? (
          <>
            <tspan fill="var(--muted-foreground)" fontWeight={400}>{schema}</tspan>
            {bare}
          </>
        ) : (
          fitted.text
        )}
      </text>
      {fitted.truncated && (
        // Transparent hit area carrying a native <title>; pointer events still
        // bubble to the parent group, so dragging the table is unaffected.
        <rect x={nameX} y={0} width={nameMax} height={H} fill="transparent">
          <title>{table.name}</title>
        </rect>
      )}

      <text
        x={W - 14}
        y={cy}
        textAnchor="end"
        dominantBaseline="central"
        fontSize={10.5}
        fontWeight={500}
        fontFamily={MONO}
        fill={variant === "header" ? "rgba(255,255,255,.78)" : "var(--muted-foreground)"}
        className={cn(styles.count, styles.noEvents)}
      >
        {countLabel}
      </text>

      {variant !== "header" && <line x1={0} x2={W} y1={H} y2={H} stroke="var(--border)" />}
    </>
  );
}

function HeaderActions({ table, g, onHeader }: { table: Table; g: TableGeometry; onHeader: boolean }) {
  const updateTable = useCanvasStore((s) => s.updateTable);
  const deleteTable = useCanvasStore((s) => s.deleteTable);
  const [menuOpen, setMenuOpen] = useState(false);
  const btn = onHeader
    ? "h-7 w-7 text-white/80 hover:text-white hover:bg-white/15"
    : "h-7 w-7 text-muted-foreground/70 hover:text-foreground";

  return (
    <foreignObject
      x={g.width - ACTIONS_WIDTH - 6}
      y={(g.headerHeight - 28) / 2}
      width={ACTIONS_WIDTH}
      height={28}
      className={cn("overflow-visible", styles.actions)}
      data-open={menuOpen || table.isLocked || undefined}
    >
      <div className="flex items-center justify-end gap-1" onPointerDown={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="icon"
          className={btn}
          onClick={() => updateTable(table.id, { isLocked: !table.isLocked })}
        >
          {table.isLocked ? (
            <Lock className={cn("h-3.5 w-3.5", !onHeader && "text-primary")} />
          ) : (
            <Unlock className="h-3.5 w-3.5" />
          )}
        </Button>

        <DropdownMenu onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className={btn}>
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {table.comment && (
              <>
                <div className="px-2 py-1.5 text-xs text-muted-foreground whitespace-pre-wrap max-h-32 overflow-y-auto italic">
                  {table.comment}
                </div>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Change Color</DropdownMenuLabel>
            <div className="grid grid-cols-4 gap-1 p-2">
              {TABLE_COLORS.map((color) => (
                <button
                  key={color}
                  className={cn(
                    "w-6 h-6 rounded-full border border-black/10 transition-transform hover:scale-110",
                    table.color === color && "ring-2 ring-primary ring-offset-1"
                  )}
                  style={{ backgroundColor: color }}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateTable(table.id, { color });
                  }}
                />
              ))}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive gap-2"
              onSelect={() => deleteTable(table.id)}
            >
              <Trash className="h-4 w-4" />
              <span>Delete</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </foreignObject>
  );
}

export const TableNode = memo(function TableNode({
  table,
  canvasStyle,
  selected,
  isDimmed,
  isFaded,
  readOnly,
  hidePorts,
  connectedPorts,
  linkedColumns,
  foreignKeys,
  dropColumnId,
  sourcePort,
  onColumnPointerDown,
  onHoverChange,
}: TableNodeProps) {
  // Re-render once when web fonts settle so measurements stop using fallback
  // metrics. After that first flip this is a constant and costs nothing.
  useSyncExternalStore(subscribeFontsReady, getFontsReadySnapshot, getFontsReadyServerSnapshot);

  const variant = canvasStyle.table;
  const g = TABLE_GEOMETRY[variant];
  const W = g.width;
  const R = g.rowHeight;
  const height = tableHeight(g, table.columns.length);
  const showPorts = !readOnly && !hidePorts;

  const bodyFamily = getCanvasFontFamily();
  const titleFont = `600 13.5px ${bodyFamily}`;
  const nameSize = variant === "dense" ? 12.5 : 12.75;
  const typeSize = variant === "chips" ? 10.5 : 11;
  const columnFont = `${nameSize}px ${bodyFamily}`;
  const columnFontBold = `600 ${nameSize}px ${bodyFamily}`;
  const typeFont = `${typeSize}px monospace`;

  const connected = new Map<string, string>();
  if (connectedPorts) {
    for (const entry of connectedPorts.split(";")) {
      const [colId, side, color] = entry.split("|");
      connected.set(`${colId}|${side}`, color);
    }
  }
  const linked = splitList(linkedColumns);
  const fks = splitList(foreignKeys);

  const nameX = variant === "chips" ? 46 : variant === "dense" ? 36 : 34;
  const typeRight = W - (variant === "dense" || variant === "chips" ? 12 : 14);

  return (
    <g
      className={cn(styles.table, isDimmed && styles.dimmed, isFaded && styles.faded)}
      data-variant={variant}
      data-visibility={canvasStyle.handleVisibility}
      data-selected={selected || undefined}
      style={{ "--tc": table.color } as React.CSSProperties}
      onPointerEnter={() => onHoverChange?.(table.id, null)}
      onPointerLeave={() => onHoverChange?.(table.id, undefined)}
    >
      {/* Rendered only when selected: the SVG export keeps colours but not
          CSS opacity, so anything merely hidden by a class would show up there. */}
      {selected && (
        <rect
          className={styles.selRing}
          x={-4.5}
          y={-4.5}
          width={W + 9}
          height={height + 9}
          rx={g.radius + 4}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={1.5}
        />
      )}
      <rect className={styles.card} width={W} height={height} rx={g.radius} strokeWidth={1} />

      <Header table={table} variant={variant} g={g} height={height} readOnly={readOnly} titleFont={titleFont} />

      {table.columns.map((col, i) => {
        const isFk = fks.has(col.id);
        const cy = R / 2;
        const last = i === table.columns.length - 1;
        const nameFont = col.isPrimaryKey ? columnFontBold : columnFont;
        const nullable = variant === "dense" && !col.isNotNull && !col.isPrimaryKey;

        // The type is right-aligned, so it claims its space first and the name
        // gets whatever is left — that way neither can spill past the card edge.
        const columnType = truncateTextToWidth(col.type, typeFont, 88);
        const typeWidth = measureTextWidth(columnType.text, typeFont);
        const chipWidth = Math.ceil(typeWidth) + 14;
        const typeSpace = variant === "chips" ? chipWidth : typeWidth + (nullable ? 7 : 0);
        const columnName = truncateTextToWidth(col.name, nameFont, typeRight - typeSpace - 8 - nameX);
        const showFullRow = columnName.truncated || columnType.truncated;

        let rowBg: React.ReactNode;
        if (g.rowInset) {
          rowBg = <rect className={styles.rowBg} x={g.rowInset} y={1} width={W - 2 * g.rowInset} height={R - 2} rx={g.rowRadius} />;
        } else if (last && !g.padBottom) {
          rowBg = <path className={styles.rowBg} d={bottomRoundedRow(W, R, g.radius)} />;
        } else {
          rowBg = <rect className={styles.rowBg} x={0.5} y={0} width={W - 1} height={R} />;
        }

        const badge = col.isPrimaryKey ? "PK" : isFk ? "FK" : col.isUnique ? "UQ" : null;

        return (
          <g
            key={col.id}
            className={styles.row}
            transform={`translate(0, ${rowTopY(g, i)})`}
            data-table-id={table.id}
            data-col-id={col.id}
            data-linked={linked.has(col.id) || undefined}
            data-drop={dropColumnId === col.id || undefined}
            onPointerEnter={() => onHoverChange?.(table.id, col.id)}
            onPointerLeave={() => onHoverChange?.(table.id, null)}
          >
            {/* Hover zone reaches past the card edge so a handle doesn't vanish as you reach for it */}
            <rect
              className={styles.rowHit}
              x={showPorts ? -14 : 0}
              y={0}
              width={showPorts ? W + 28 : W}
              height={R}
              fill="transparent"
            >
              {showFullRow && <title>{`${col.name} ${col.type}`}</title>}
            </rect>
            {rowBg}

            {(variant === "header" || variant === "dense") && i > 0 && (
              <line x1={0} x2={W} y1={0} y2={0} stroke="var(--border)" strokeOpacity={0.65} />
            )}

            {variant === "chips" ? (
              badge && (
                <>
                  <rect
                    className={badge === "PK" ? styles.badgePk : styles.badge}
                    x={12}
                    y={cy - 8}
                    width={24}
                    height={16}
                    rx={5}
                  />
                  <text
                    x={24}
                    y={cy}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={9}
                    fontWeight={600}
                    fontFamily={MONO}
                    letterSpacing={0.3}
                    fill={badge === "PK" ? "var(--tc)" : "var(--muted-foreground)"}
                    className={styles.noEvents}
                  >
                    {badge}
                  </text>
                </>
              )
            ) : (
              <ColumnIcon col={col} isFk={isFk} x={variant === "dense" ? 7 : 14} y={cy - 6} />
            )}

            <text
              x={nameX}
              y={cy}
              dominantBaseline="central"
              fill="var(--foreground)"
              fontSize={nameSize}
              fontWeight={col.isPrimaryKey ? 600 : 400}
              fontFamily={SANS}
              className={styles.noEvents}
            >
              {columnName.text}
            </text>

            {variant === "chips" && (
              <rect className={styles.typeChip} x={typeRight - chipWidth} y={cy - 9} width={chipWidth} height={18} rx={5} />
            )}
            <text
              x={variant === "chips" ? typeRight - chipWidth / 2 : typeRight}
              y={cy}
              textAnchor={variant === "chips" ? "middle" : "end"}
              dominantBaseline="central"
              fill="var(--muted-foreground)"
              fontSize={typeSize}
              fontFamily={MONO}
              className={styles.noEvents}
            >
              {columnType.text}
              {nullable && <tspan fillOpacity={0.55}>?</tspan>}
            </text>

            {showPorts &&
              ([-1, 1] as Side[]).map((side) => {
                const key = `${col.id}|${side === 1 ? "r" : "l"}`;
                const isConnected = connected.has(key);
                return (
                  <Port
                    key={side}
                    shape={canvasStyle.handles}
                    side={side}
                    x={side === 1 ? W : 0}
                    y={cy}
                    rowHeight={R}
                    tableId={table.id}
                    colId={col.id}
                    color={connected.get(key) || undefined}
                    connected={isConnected}
                    hot={isConnected && linked.has(col.id)}
                    source={sourcePort === key}
                    onPointerDown={(e) => onColumnPointerDown?.(e, table.id, col.id, side)}
                  />
                );
              })}
          </g>
        );
      })}

      {/* Rendered last so the row hover zones never sit on top of the buttons */}
      {!readOnly && !hidePorts && <HeaderActions table={table} g={g} onHeader={variant === "header"} />}
    </g>
  );
},
(prev, next) =>
  prev.table === next.table &&
  prev.canvasStyle === next.canvasStyle &&
  prev.selected === next.selected &&
  prev.isDimmed === next.isDimmed &&
  prev.isFaded === next.isFaded &&
  prev.readOnly === next.readOnly &&
  prev.hidePorts === next.hidePorts &&
  prev.connectedPorts === next.connectedPorts &&
  prev.linkedColumns === next.linkedColumns &&
  prev.foreignKeys === next.foreignKeys &&
  prev.dropColumnId === next.dropColumnId &&
  prev.sourcePort === next.sourcePort
);
