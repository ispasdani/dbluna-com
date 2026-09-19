"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Crosshair,
  Search,
  Trash2,
  TriangleAlert,
} from "lucide-react";

import { useCanvasStore, type Column, type Relationship, type Table } from "@/store/useCanvasStore";
import { usePanelStyle } from "@/store/usePanelStyleStore";
import { relationshipRoles, type EndRole } from "@/components/diagram-sections/canvas/relationship-ends";
import { splitSchemaName } from "@/lib/schema-namespace";
import { cn } from "@/lib/utils";
import type { PanelLine, PanelVariant } from "./panel-style";
import { CommittedInput } from "./committed-input";
import { focusRelationshipOnCanvas, useDiagramIssues } from "./use-diagram-issues";
import styles from "./relationships-panel.module.scss";

type Action = Relationship["onDelete"];
type Cardinality = Relationship["cardinality"];

const ACTIONS: Action[] = ["No action", "Restrict", "Cascade", "Set null", "Set default"];
const CARDINALITIES: Cardinality[] = ["One to one", "One to many", "Many to one"];
/** Actions that rewrite or remove rows, as opposed to only blocking the change. */
const CHANGES_DATA = new Set<Action>(["Cascade", "Set null", "Set default"]);

interface End {
  table: Table;
  column: Column;
}

/**
 * A relationship read as "foreign key -> referenced key", which is how people
 * think about it, rather than the stored source/target order.
 */
interface ResolvedRel {
  rel: Relationship;
  fk: End;
  ref: End;
  fkIsSource: boolean;
}

/**
 * Which stored end holds the foreign key. The referenced end is nearly always a
 * primary key, so that decides it when it can; imported diagrams don't agree on
 * which way the cardinality label reads. Otherwise this falls back to the DBML
 * generator's convention, where only "Many to one" puts the FK on the target.
 */
function foreignKeyIsSource(rel: Relationship, source: Column, target: Column): boolean {
  if (target.isPrimaryKey && !source.isPrimaryKey) return true;
  if (source.isPrimaryKey && !target.isPrimaryKey) return false;
  return rel.cardinality !== "Many to one";
}

/** End roles in display order (FK end first), for any stored cardinality. */
function orientedRoles(cardinality: Cardinality, fkIsSource: boolean): [EndRole, EndRole] {
  const { source, target } = relationshipRoles(cardinality);
  return fkIsSource ? [source, target] : [target, source];
}

const roleLabel = (r: EndRole) => (r === "many" ? "N" : "1");

function bareName(name: string) {
  return splitSchemaName(name).table;
}

const tc = (table: Table) => ({ "--tc": table.color }) as CSSProperties;

// ─── Glyphs (same strokes as TableNode) ──────────────────────────────────────

function TableGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round">
      <rect x={1} y={1.5} width={10} height={9} rx={2} />
      <path d="M1 4.8H11M4.6 4.8V10.5" />
    </svg>
  );
}

function KeyGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="var(--tc)" strokeWidth={1.4} strokeLinecap="round">
      <circle cx={3.6} cy={6} r={2.6} />
      <path d="M6.2 6H11.4M9.6 6V8.2M11.4 6V7.8" />
    </svg>
  );
}

function LinkGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round">
      <path d="M4.6 7.4 7.4 4.6" />
      <path d="M6.2 3.2 7.3 2.1a2.3 2.3 0 0 1 3.3 3.3L9.5 6.5" />
      <path d="M5.8 8.8 4.7 9.9a2.3 2.3 0 0 1-3.3-3.3L2.5 5.5" />
    </svg>
  );
}

/** Small crow's-foot line: bar = one, fork = many. */
function CrowGlyph({ roles, width = 22 }: { roles: [EndRole, EndRole]; width?: number }) {
  const m = 7;
  const L = 2;
  const R = width - 2;
  const end = (role: EndRole, x: number, dir: 1 | -1) =>
    role === "many" ? (
      <path d={`M${x} ${m - 4.5}L${x + dir * 7} ${m}L${x} ${m + 4.5}`} />
    ) : (
      <line x1={x + dir * 4} y1={m - 4.5} x2={x + dir * 4} y2={m + 4.5} />
    );
  return (
    <svg
      className={styles.crow}
      width={width}
      height={14}
      viewBox={`0 0 ${width} 14`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1={L} y1={m} x2={R} y2={m} />
      {end(roles[0], L, 1)}
      {end(roles[1], R, -1)}
    </svg>
  );
}

function TableMark({ table, small }: { table: Table; small?: boolean }) {
  return (
    <span className={cn(styles.mk, small && styles.mkSmall)} style={tc(table)}>
      <TableGlyph />
    </span>
  );
}

function TableName({ table }: { table: Table }) {
  const { schema, table: bare } = splitSchemaName(table.name);
  return (
    <span className={styles.tname} title={table.name}>
      {schema && <span className={styles.schema}>{schema}.</span>}
      {bare}
    </span>
  );
}

// ─── Mini canvas ─────────────────────────────────────────────────────────────

const GEO: Record<PanelVariant, { hh: number; rh: number; pt: number; pb: number }> = {
  soft: { hh: 42, rh: 30, pt: 4, pb: 5 },
  header: { hh: 40, rh: 30, pt: 0, pb: 0 },
  dense: { hh: 34, rh: 26, pt: 0, pb: 0 },
  chips: { hh: 46, rh: 32, pt: 4, pb: 6 },
};
const STAGE_W = 340;
const STUB_W = 180;

function TableStub({
  table,
  columns,
  linkedColumnId,
  foreignKeys,
  style,
}: {
  table: Table;
  columns: Column[];
  linkedColumnId: string;
  foreignKeys: Set<string>;
  style?: CSSProperties;
}) {
  return (
    <div className={styles.tb} style={{ ...tc(table), ...style }}>
      <div className={styles.tbHead}>
        <TableMark table={table} />
        <span className={styles.tname} title={table.name}>
          {bareName(table.name)}
        </span>
        <span className={styles.cnt}>{table.columns.length} cols</span>
      </div>
      <div className={styles.tbBody}>
        {columns.map((col) => {
          const isFk = foreignKeys.has(col.id);
          const badge = col.isPrimaryKey ? "PK" : isFk ? "FK" : null;
          return (
            <div
              key={col.id}
              className={cn(styles.row, col.isPrimaryKey && styles.pk, col.id === linkedColumnId && styles.linked)}
            >
              <span className={styles.ic}>{col.isPrimaryKey ? <KeyGlyph /> : isFk ? <LinkGlyph /> : null}</span>
              {badge && <span className={styles.badge}>{badge}</span>}
              <span className={styles.cn}>{col.name}</span>
              <span className={styles.ty}>{col.type}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Up to `max` columns, always including `must`, primary keys first. */
function pickColumns(table: Table, must: Column, max: number): Column[] {
  const ordered = [
    ...table.columns.filter((c) => c.isPrimaryKey),
    must,
    ...table.columns.filter((c) => !c.isPrimaryKey),
  ];
  const seen = new Set<string>();
  const out: Column[] = [];
  for (const c of ordered) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
  }
  // Keep `must` visible even when the table has many primary-key columns.
  const shown = out.slice(0, max);
  if (!shown.includes(must)) shown[max - 1] = must;
  return shown;
}

function MiniCanvas({
  r,
  variant,
  line,
  foreignKeys,
}: {
  r: ResolvedRel;
  variant: PanelVariant;
  line: PanelLine;
  foreignKeys: Set<string>;
}) {
  const g = GEO[variant];
  const fkCols = pickColumns(r.fk.table, r.fk.column, 4);
  const refCols = pickColumns(r.ref.table, r.ref.column, 3);

  const pad = 14;
  const sx = 30;
  const tx = STAGE_W - STUB_W - 10;
  const stubH = (n: number) => g.hh + g.pt + n * g.rh + g.pb + 2;
  const tY = pad + stubH(fkCols.length) + 26;
  const rowY = (top: number, i: number) => top + 1 + g.hh + g.pt + i * g.rh + g.rh / 2;
  const y1 = rowY(pad, fkCols.indexOf(r.fk.column));
  const y2 = rowY(tY, refCols.indexOf(r.ref.column));
  const H = tY + stubH(refCols.length) + pad;

  const rx = 11;
  const k = line === "sharp" ? 0 : 10;
  const d = k
    ? `M${sx} ${y1}H${rx + k}Q${rx} ${y1} ${rx} ${y1 + k}V${y2 - k}Q${rx} ${y2} ${rx + k} ${y2}H${tx}`
    : `M${sx} ${y1}H${rx}V${y2}H${tx}`;

  const [fkRole, refRole] = orientedRoles(r.rel.cardinality, r.fkIsSource);
  const end = (role: EndRole, x: number, y: number) =>
    role === "many" ? (
      <path d={`M${x} ${y - 6}L${x - 9} ${y}L${x} ${y + 6}`} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    ) : (
      <line x1={x - 7} y1={y - 6} x2={x - 7} y2={y + 6} stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
    );

  const color = line === "tinted" ? r.fk.table.color : "var(--primary)";
  const gradientId = `rel-grad-${r.rel.id}`;
  const stroke = line === "gradient" ? `url(#${gradientId})` : color;
  const showLabel = variant === "chips" || variant === "header";

  return (
    <div className={styles.stageWrap}>
      <div className={styles.stage} style={{ width: STAGE_W, height: H }}>
        <svg viewBox={`0 0 ${STAGE_W} ${H}`} width={STAGE_W} height={H} style={{ color }}>
          {line === "gradient" && (
            <defs>
              <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={0} y1={y1} x2={0} y2={y2}>
                <stop offset={0} stopColor={r.fk.table.color} />
                <stop offset={1} stopColor={r.ref.table.color} />
              </linearGradient>
            </defs>
          )}
          {line === "tinted" && <path d={d} fill="none" stroke={color} strokeOpacity={0.22} strokeWidth={7} />}
          <path
            d={d}
            fill="none"
            stroke={stroke}
            strokeWidth={2}
            className={line === "flow" ? styles.flow : line === "gradient" ? styles.pulse : undefined}
          />
          {end(fkRole, sx, y1)}
          {end(refRole, tx, y2)}
          {showLabel && (
            <text x={rx + 8} y={(y1 + y2) / 2} fontSize={10.5} fontWeight={500} fill="currentColor" dominantBaseline="central">
              {roleLabel(fkRole)} : {roleLabel(refRole)}
            </text>
          )}
        </svg>
        <TableStub
          table={r.fk.table}
          columns={fkCols}
          linkedColumnId={r.fk.column.id}
          foreignKeys={foreignKeys}
          style={{ left: sx, top: pad }}
        />
        <TableStub
          table={r.ref.table}
          columns={refCols}
          linkedColumnId={r.ref.column.id}
          foreignKeys={foreignKeys}
          style={{ left: tx, top: tY }}
        />
      </div>
    </div>
  );
}

// ─── Inspector ───────────────────────────────────────────────────────────────

function consequence(r: ResolvedRel, kind: "delete" | "update"): ReactNode {
  const action = kind === "delete" ? r.rel.onDelete : r.rel.onUpdate;
  const verb = kind === "delete" ? "Deleting" : "Changing the key of";
  const fk = <b>{bareName(r.fk.table.name)}</b>;
  const ref = <b>{bareName(r.ref.table.name)}</b>;
  const col = <b>{r.fk.column.name}</b>;

  switch (action) {
    case "Cascade":
      return kind === "delete" ? (
        <>{verb} a {ref} also deletes every {fk} row that points at it.</>
      ) : (
        <>{verb} a {ref} rewrites {col} on its {fk} rows.</>
      );
    case "Set null":
      return <>{verb} a {ref} sets {col} to NULL on its {fk} rows.</>;
    case "Set default":
      return <>{verb} a {ref} resets {col} to its default value.</>;
    case "Restrict":
      return <>{verb} a {ref} is refused straight away while any {fk} row points at it.</>;
    default:
      return <>{verb} a {ref} fails while any {fk} row still points at it, checked at the end of the statement.</>;
  }
}

function Inspector({
  r,
  variant,
  line,
  issue,
  foreignKeys,
}: {
  r: ResolvedRel;
  variant: PanelVariant;
  line: PanelLine;
  issue?: string;
  foreignKeys: Set<string>;
}) {
  const updateRelationship = useCanvasStore((s) => s.updateRelationship);
  const deleteRelationship = useCanvasStore((s) => s.deleteRelationship);
  const { rel } = r;

  // The three stored values, labelled in display order and sorted by label.
  const cardinalityOptions = CARDINALITIES.map((value) => ({
    value,
    roles: orientedRoles(value, r.fkIsSource),
  })).sort((a, b) => a.roles.map(roleLabel).join().localeCompare(b.roles.map(roleLabel).join()));

  const ruleChips = (kind: "delete" | "update") => {
    const current = kind === "delete" ? rel.onDelete : rel.onUpdate;
    return (
      <div className={styles.chips} role="group" aria-label={kind === "delete" ? "On delete" : "On update"}>
        {ACTIONS.map((a) => (
          <button
            key={a}
            type="button"
            aria-pressed={a === current}
            className={cn(CHANGES_DATA.has(a) && styles.changesData)}
            onClick={() => updateRelationship(rel.id, kind === "delete" ? { onDelete: a } : { onUpdate: a })}
          >
            {a}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className={styles.detail} onClick={(e) => e.stopPropagation()}>
      <MiniCanvas r={r} variant={variant} line={line} foreignKeys={foreignKeys} />

      {issue && (
        <div className={styles.alert}>
          <TriangleAlert className="w-3.5 h-3.5" />
          <span>{issue}</span>
        </div>
      )}

      <div className={styles.sec}>
        <h4>Columns</h4>
        <dl className={styles.kv}>
          <dt>Foreign key</dt>
          <dd>
            <TableMark table={r.fk.table} small />
            <span title={`${r.fk.table.name}.${r.fk.column.name}`}>
              {bareName(r.fk.table.name)}.{r.fk.column.name}
            </span>
          </dd>
          <dt>References</dt>
          <dd>
            <TableMark table={r.ref.table} small />
            <span title={`${r.ref.table.name}.${r.ref.column.name}`}>
              {bareName(r.ref.table.name)}.{r.ref.column.name}
            </span>
          </dd>
        </dl>
      </div>

      <div className={styles.sec}>
        <h4>Cardinality</h4>
        <div className={styles.seg} role="group" aria-label="Cardinality">
          {cardinalityOptions.map(({ value, roles }) => (
            <button
              key={value}
              type="button"
              aria-pressed={rel.cardinality === value}
              onClick={() => updateRelationship(rel.id, { cardinality: value })}
            >
              <CrowGlyph roles={roles} />
              {roleLabel(roles[0])} : {roleLabel(roles[1])}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.sec}>
        <h4>When the referenced row changes</h4>
        <div className={styles.rule}>
          <span className={styles.ruleLabel}>On delete</span>
          {ruleChips("delete")}
          <span className={styles.say}>{consequence(r, "delete")}</span>
        </div>
        <div className={styles.rule}>
          <span className={styles.ruleLabel}>On update</span>
          {ruleChips("update")}
          <span className={styles.say}>{consequence(r, "update")}</span>
        </div>
      </div>

      <div className={styles.sec}>
        <h4>Constraint name</h4>
        <CommittedInput
          value={rel.name || ""}
          onCommit={(name) => updateRelationship(rel.id, { name })}
          placeholder="Relationship name"
          aria-label="Constraint name"
          className={styles.nameInput}
        />
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.btn}
          onClick={() => focusRelationshipOnCanvas(rel.sourceTableId, rel.targetTableId)}
        >
          <Crosshair className="w-3.5 h-3.5" />
          Show on canvas
        </button>
        <button type="button" className={cn(styles.btn, styles.btnDanger)} onClick={() => deleteRelationship(rel.id)}>
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </button>
      </div>
    </div>
  );
}

// ─── Panel ───────────────────────────────────────────────────────────────────

export function RelationshipsPanel() {
  const tables = useCanvasStore((s) => s.tables);
  const relationships = useCanvasStore((s) => s.relationships);
  const selectedRelationshipId = useCanvasStore((s) => s.selectedRelationshipId);
  const setSelectedRelationshipId = useCanvasStore((s) => s.setSelectedRelationshipId);
  const { variant, line } = usePanelStyle();
  const { issues } = useDiagramIssues();

  const [query, setQuery] = useState("");
  // Groups start folded; this holds the ones the user (or a selection) opened.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [flashId, setFlashId] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const { resolved, dangling } = useMemo(() => {
    const byId = new Map(tables.map((t) => [t.id, t]));
    const out: ResolvedRel[] = [];
    let missing = 0;
    for (const rel of relationships) {
      const st = byId.get(rel.sourceTableId);
      const tt = byId.get(rel.targetTableId);
      const sc = st?.columns.find((c) => c.id === rel.sourceColumnId);
      const tcol = tt?.columns.find((c) => c.id === rel.targetColumnId);
      if (!st || !tt || !sc || !tcol) {
        missing++;
        continue;
      }
      const fkIsSource = foreignKeyIsSource(rel, sc, tcol);
      const s = { table: st, column: sc };
      const t = { table: tt, column: tcol };
      out.push({ rel, fkIsSource, fk: fkIsSource ? s : t, ref: fkIsSource ? t : s });
    }
    return { resolved: out, dangling: missing };
  }, [tables, relationships]);

  const foreignKeys = useMemo(() => new Set(resolved.map((r) => r.fk.column.id)), [resolved]);

  const issueByRel = useMemo(() => {
    const map = new Map<string, string>();
    for (const issue of issues) {
      if (issue.relationshipId && !map.has(issue.relationshipId)) map.set(issue.relationshipId, issue.message);
    }
    return map;
  }, [issues]);
  const issueCount = resolved.filter((r) => issueByRel.has(r.rel.id)).length;

  const needle = query.trim().toLowerCase();
  const matches = (r: ResolvedRel) =>
    !needle ||
    needle.split(/\s+/).every((w) =>
      `${r.fk.table.name} ${r.fk.column.name} ${r.ref.table.name} ${r.ref.column.name} ${r.rel.name}`
        .toLowerCase()
        .includes(w)
    );

  // Groups follow the Tables tab order; only tables that own a foreign key.
  const groups = useMemo(() => {
    const byTable = new Map<string, ResolvedRel[]>();
    for (const r of resolved) {
      if (!matches(r)) continue;
      const list = byTable.get(r.fk.table.id);
      if (list) list.push(r);
      else byTable.set(r.fk.table.id, [r]);
    }
    return tables.filter((t) => byTable.has(t.id)).map((t) => ({ table: t, rels: byTable.get(t.id)! }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved, tables, needle]);

  const incoming = useMemo(() => {
    const map = new Map<string, Table[]>();
    for (const r of resolved) {
      const list = map.get(r.ref.table.id) ?? [];
      if (!list.includes(r.fk.table)) list.push(r.fk.table);
      map.set(r.ref.table.id, list);
    }
    return map;
  }, [resolved]);

  const reveal = (el: Element | null | undefined) => {
    const box = bodyRef.current;
    if (!el || !box) return;
    const r = el.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    if (r.top < b.top || r.top > b.bottom - 80) {
      box.scrollTo({ top: box.scrollTop + r.top - b.top - 12, behavior: "smooth" });
    }
  };

  // A line picked on the canvas opens its row here: unfold its group, scroll to it.
  const selectedFkTableId = resolved.find((r) => r.rel.id === selectedRelationshipId)?.fk.table.id;
  useEffect(() => {
    if (!selectedRelationshipId || !selectedFkTableId) return;
    setExpanded((prev) => (prev.has(selectedFkTableId) ? prev : new Set(prev).add(selectedFkTableId)));
    const raf = requestAnimationFrame(() =>
      reveal(bodyRef.current?.querySelector(`[data-rel-id="${CSS.escape(selectedRelationshipId)}"]`))
    );
    return () => cancelAnimationFrame(raf);
  }, [selectedRelationshipId, selectedFkTableId]);

  const toggleGroup = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allCollapsed = groups.every((g) => !expanded.has(g.table.id));
  const toggleAll = () => setExpanded(allCollapsed ? new Set(groups.map((g) => g.table.id)) : new Set());

  const jumpTo = (tableId: string) => {
    setExpanded((prev) => new Set(prev).add(tableId));
    setFlashId(null);
    requestAnimationFrame(() => {
      reveal(bodyRef.current?.querySelector(`[data-group-id="${CSS.escape(tableId)}"]`));
      setFlashId(tableId);
    });
  };

  const onKey = (e: React.KeyboardEvent, fn: () => void) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  };

  return (
    <div className={styles.panel} data-v={variant}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h3>Relationships</h3>
          <span className={styles.count}>
            {needle ? `${groups.reduce((n, g) => n + g.rels.length, 0)} / ` : ""}
            {relationships.length}
          </span>
          <span className={styles.spacer} />
          {issueCount > 0 && (
            <span className={styles.issueTag}>
              {issueCount} {issueCount === 1 ? "issue" : "issues"}
            </span>
          )}
          {groups.length > 0 && (
            <button
              type="button"
              className={styles.iconBtn}
              onClick={toggleAll}
              title={allCollapsed ? "Expand all" : "Collapse all"}
              aria-label={allCollapsed ? "Expand all" : "Collapse all"}
            >
              {allCollapsed ? <ChevronsUpDown className="w-3.5 h-3.5" /> : <ChevronsDownUp className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
        {relationships.length > 0 && (
          <label className={styles.search}>
            <Search className="w-3.5 h-3.5 shrink-0" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by table or column"
              aria-label="Filter relationships"
            />
          </label>
        )}
      </div>

      <div className={styles.body} ref={bodyRef}>
        {relationships.length === 0 ? (
          <div className={styles.empty}>No relationships yet. Connect two tables on the canvas.</div>
        ) : groups.length === 0 ? (
          <div className={styles.empty}>{needle ? `No relationships match “${query.trim()}”.` : "No relationships to show."}</div>
        ) : (
          <div className={styles.groups}>
            {groups.map(({ table, rels }) => {
              const isClosed = !expanded.has(table.id);
              const inc = incoming.get(table.id) ?? [];
              const incCount = resolved.filter((r) => r.ref.table.id === table.id).length;
              return (
                <div
                  key={table.id}
                  data-group-id={table.id}
                  className={cn(styles.tb, styles.group, isClosed && styles.closed, flashId === table.id && styles.flash)}
                  style={tc(table)}
                  onAnimationEnd={() => setFlashId(null)}
                >
                  <div
                    className={styles.tbHead}
                    role="button"
                    tabIndex={0}
                    aria-expanded={!isClosed}
                    onClick={() => toggleGroup(table.id)}
                    onKeyDown={(e) => onKey(e, () => toggleGroup(table.id))}
                  >
                    <span className={styles.chev}>
                      <ChevronDown className="w-3 h-3" />
                    </span>
                    <TableMark table={table} />
                    <TableName table={table} />
                    <span className={styles.cnt}>
                      {rels.length} out{incCount ? ` · ${incCount} in` : ""}
                    </span>
                  </div>

                  {!isClosed && (
                    <div className={styles.tbBody}>
                      {rels.map((r) => {
                        const isOpen = r.rel.id === selectedRelationshipId;
                        const issue = issueByRel.get(r.rel.id);
                        const toggle = () => setSelectedRelationshipId(isOpen ? null : r.rel.id);
                        return (
                          <Fragment key={r.rel.id}>
                            <div
                              data-rel-id={r.rel.id}
                              className={cn(styles.row, styles.relRow, isOpen && styles.open)}
                              role="button"
                              tabIndex={0}
                              aria-expanded={isOpen}
                              title={r.rel.name || undefined}
                              onClick={toggle}
                              onKeyDown={(e) => onKey(e, toggle)}
                            >
                              <span className={styles.ic}>
                                <LinkGlyph />
                              </span>
                              <span className={styles.badge}>FK</span>
                              <span className={styles.cn}>{r.fk.column.name}</span>
                              <span className={styles.to}>
                                {issue && <span className={styles.issueDot} title={issue} />}
                                {CHANGES_DATA.has(r.rel.onDelete) && (
                                  <span className={styles.tag}>{r.rel.onDelete}</span>
                                )}
                                <CrowGlyph roles={orientedRoles(r.rel.cardinality, r.fkIsSource)} />
                                <TableMark table={r.ref.table} small />
                                <span className={styles.tname} title={r.ref.table.name}>
                                  {bareName(r.ref.table.name)}
                                </span>
                              </span>
                              <span className={styles.rowChev}>
                                <ChevronDown className="w-3 h-3" />
                              </span>
                            </div>
                            {isOpen && (
                              <Inspector
                                r={r}
                                variant={variant}
                                line={line}
                                issue={issue}
                                foreignKeys={foreignKeys}
                              />
                            )}
                          </Fragment>
                        );
                      })}
                    </div>
                  )}

                  {!isClosed && inc.length > 0 && (
                    <div className={styles.incoming}>
                      Referenced by
                      {inc.map((t) => (
                        <button key={t.id} type="button" style={tc(t)} onClick={() => jumpTo(t.id)} title={t.name}>
                          <i />
                          <span className={styles.tname}>{bareName(t.name)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {dangling > 0 && (
          <p className={styles.dangling}>
            {dangling} {dangling === 1 ? "relationship points" : "relationships point"} at a missing table or column. See the
            Issues tab.
          </p>
        )}
      </div>
    </div>
  );
}
