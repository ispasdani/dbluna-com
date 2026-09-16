import type {
  CanvasEnum,
  CanvasTableGroup,
  Column,
  Relationship,
  Table,
} from "@/store/useCanvasStore";
import { splitSchemaName } from "@/lib/schema-namespace";

/**
 * Schema linting for the Issues tab.
 *
 * Kept as a pure function of the canvas model (rather than living inside the
 * panel the way it used to) for three reasons: it is the only part of the app
 * that can be unit-tested without a DOM, the Issues tab badge needs the same
 * numbers the panel renders, and the memo key below has to be derivable
 * without re-running the analysis.
 *
 * Deliberately NOT in scope here: DBML syntax errors. Those already surface as
 * CodeMirror diagnostics in the Code tab (see `dbmlLinter` in
 * components/diagram-general/code-editor.tsx), and a schema that fails to parse
 * never reaches the canvas model in the first place.
 */

export type IssueSeverity = "error" | "warning" | "info";

export type IssueCategory =
  | "naming"
  | "structure"
  | "keys"
  | "types"
  | "relationships"
  | "enums";

/** Stable identifiers so tests assert on a rule, not on message wording. */
export type IssueRule =
  // naming
  | "table-name-empty"
  | "table-name-duplicate"
  | "table-name-reserved"
  | "table-name-needs-quoting"
  | "column-name-empty"
  | "column-name-duplicate"
  | "column-name-reserved"
  | "column-name-needs-quoting"
  // structure
  | "table-no-columns"
  | "table-orphaned"
  | "table-group-unknown-member"
  // keys
  | "table-no-primary-key"
  | "table-multiple-auto-increment"
  | "column-auto-increment-non-integer"
  | "column-primary-key-nullable"
  // types
  | "column-type-missing"
  | "relationship-type-incompatible"
  | "relationship-type-width"
  // relationships
  | "relationship-dangling"
  | "relationship-self-column"
  | "relationship-duplicate"
  | "relationship-target-not-unique"
  | "relationship-set-null-on-not-null"
  | "relationship-circular"
  // enums
  | "enum-name-empty"
  | "enum-name-duplicate"
  | "enum-no-values"
  | "enum-duplicate-value"
  | "enum-unused";

export interface Issue {
  /** Unique and stable across re-analysis — used as the React key. */
  id: string;
  rule: IssueRule;
  severity: IssueSeverity;
  category: IssueCategory;
  /** One-line statement of the problem. */
  message: string;
  /** Why it matters / how to fix it. Rendered as secondary text. */
  hint?: string;
  /** Bucket the panel groups rows under. */
  groupKey: string;
  groupLabel: string;
  /** Navigation targets. `tableId` also drives click-to-focus on the canvas. */
  tableId?: string;
  columnId?: string;
  relationshipId?: string;
  enumId?: string;
}

export interface DiagramModel {
  tables: Table[];
  relationships: Relationship[];
  enums?: CanvasEnum[];
  tableGroups?: CanvasTableGroup[];
}

export interface IssueCounts {
  error: number;
  warning: number;
  info: number;
  total: number;
}

// ─── Reserved words ──────────────────────────────────────────────────────────
// Words that need quoting in at least one of the dialects we export to
// (Postgres / MySQL / SQL Server / Oracle). Deliberately excludes type names
// (INT, TEXT, DATE…): every dialect accepts those as identifiers, and flagging
// a column called `date` would be noise rather than a finding.

const SQL_RESERVED_KEYWORDS = new Set([
  "add", "all", "alter", "analyze", "and", "any", "as", "asc", "asymmetric",
  "authorization", "begin", "between", "both", "by", "case", "cast", "check",
  "close", "cluster", "collate", "column", "comment", "commit", "concurrently",
  "constraint", "count", "create", "cross", "current_date", "current_time",
  "current_timestamp", "current_user", "cursor", "database", "declare",
  "default", "deferrable", "delete", "desc", "distinct", "drop", "else", "end",
  "escape", "except", "exists", "explain", "fetch", "first", "for", "foreign",
  "from", "full", "function", "grant", "group", "having", "if", "ilike", "in",
  "index", "initially", "inner", "insert", "intersect", "interval", "into",
  "is", "join", "key", "last", "leading", "left", "like", "limit", "localtime",
  "localtimestamp", "lock", "loop", "match", "max", "merge", "min", "natural",
  "not", "null", "offset", "on", "only", "open", "or", "order", "outer", "over",
  "overlaps", "owner", "partition", "password", "placing", "primary",
  "procedure", "public", "range", "rank", "read", "recursive", "references",
  "rename", "returning", "revoke", "right", "role", "rollback", "row", "rows",
  "schema", "select", "sequence", "session_user", "set", "similar", "some",
  "sum", "symmetric", "system_user", "table", "temp", "temporary", "then",
  "transaction", "trigger", "truncate", "union", "unique", "unlock", "update",
  "user", "using", "vacuum", "values", "variadic", "verbose", "view", "when",
  "where", "while", "window", "with", "within", "write",
]);

/** An identifier every dialect accepts bare, with no quoting. */
const SAFE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_$]*$/;

// ─── Type normalization ──────────────────────────────────────────────────────

/**
 * Canvas column types arrive from three places with three conventions: the
 * Tables-tab picker (`VARCHAR`), a DBML round-trip (uppercased by
 * `parsedTablesToCanvasTables`) and SQL import (`varchar(255)`, `int8[]`). The
 * FK checks below have to compare across all three, so everything is reduced
 * to an uppercase base name with its length/precision arguments split off.
 */
export function normalizeTypeName(raw: string): { base: string; args: string | null } {
  const trimmed = (raw ?? "").trim().replace(/\[\s*\]\s*$/, "");
  const parenIdx = trimmed.indexOf("(");
  const base = (parenIdx === -1 ? trimmed : trimmed.slice(0, parenIdx))
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
  const args =
    parenIdx === -1
      ? null
      : trimmed
          .slice(parenIdx + 1)
          .replace(/\)\s*$/, "")
          .replace(/\s+/g, "")
          .toUpperCase();
  return { base, args: args || null };
}

const TYPE_FAMILIES: Record<string, string[]> = {
  integer: [
    "TINYINT", "SMALLINT", "MEDIUMINT", "INT", "INTEGER", "BIGINT", "INT2",
    "INT4", "INT8", "SERIAL", "SMALLSERIAL", "BIGSERIAL", "SERIAL2", "SERIAL4",
    "SERIAL8", "NUMBER",
  ],
  decimal: [
    "DECIMAL", "NUMERIC", "REAL", "FLOAT", "DOUBLE", "DOUBLE PRECISION",
    "FLOAT4", "FLOAT8", "MONEY", "SMALLMONEY",
  ],
  string: [
    "CHAR", "CHARACTER", "VARCHAR", "CHARACTER VARYING", "VARCHAR2", "NCHAR",
    "NVARCHAR", "NVARCHAR2", "TEXT", "TINYTEXT", "MEDIUMTEXT", "LONGTEXT",
    "NTEXT", "CLOB", "NCLOB", "CITEXT", "STRING",
  ],
  boolean: ["BOOL", "BOOLEAN", "BIT"],
  datetime: [
    "DATE", "TIME", "TIMETZ", "DATETIME", "DATETIME2", "SMALLDATETIME",
    "TIMESTAMP", "TIMESTAMPTZ", "TIMESTAMP WITH TIME ZONE",
    "TIMESTAMP WITHOUT TIME ZONE", "TIME WITH TIME ZONE", "YEAR",
    "DATETIMEOFFSET", "INTERVAL",
  ],
  uuid: ["UUID", "UNIQUEIDENTIFIER", "GUID"],
  json: ["JSON", "JSONB"],
  binary: [
    "BLOB", "BYTEA", "BINARY", "VARBINARY", "IMAGE", "LONGBLOB", "MEDIUMBLOB",
    "TINYBLOB",
  ],
};

const BASE_TO_FAMILY = new Map<string, string>();
for (const [family, bases] of Object.entries(TYPE_FAMILIES)) {
  for (const base of bases) BASE_TO_FAMILY.set(base, family);
}

/**
 * Family for a base type, or null when it isn't a builtin we recognise —
 * an enum name or a user-defined type. Those compare by exact name instead,
 * which is the right answer for both.
 */
function familyOf(base: string): string | null {
  return BASE_TO_FAMILY.get(base) ?? null;
}

const isIntegerType = (type: string) =>
  familyOf(normalizeTypeName(type).base) === "integer";

// ─── Small helpers ───────────────────────────────────────────────────────────

const isBlank = (value: string | undefined | null) => !value || value.trim() === "";
const fold = (value: string) => value.trim().toLowerCase();

/** Labels for messages, falling back when the name is blank. */
const columnLabel = (col: Column) => (isBlank(col.name) ? "(unnamed)" : col.name);
const tableLabel = (table: Table) =>
  isBlank(table.name) ? "(unnamed table)" : table.name;

/**
 * Which end of a relationship holds the foreign key.
 *
 * The canvas cardinality maps onto DBML operators in `generateDbmlFromCanvas`:
 * "One to many" -> `>`, "Many to one" -> `<`, "One to one" -> `-`. In DBML the
 * `>` side is the many end, i.e. the one carrying the FK column, so `>` and `-`
 * put the FK on the source and `<` puts it on the target.
 */
function fkEnds(rel: Relationship): { fk: "source" | "target"; ref: "source" | "target" } {
  return rel.cardinality === "Many to one"
    ? { fk: "target", ref: "source" }
    : { fk: "source", ref: "target" };
}

const SEVERITY_ORDER: Record<IssueSeverity, number> = { error: 0, warning: 1, info: 2 };

// ─── Analysis ────────────────────────────────────────────────────────────────

export function analyzeDiagram(model: DiagramModel): Issue[] {
  const { tables, relationships } = model;
  const enums = model.enums ?? [];
  const tableGroups = model.tableGroups ?? [];

  const findings: Issue[] = [];
  const tablesById = new Map(tables.map((t) => [t.id, t]));

  const schemaGroup = (label: string): Pick<Issue, "groupKey" | "groupLabel"> => ({
    groupKey: `__${label}__`,
    groupLabel: label,
  });
  const tableGroupOf = (table: Table): Pick<Issue, "groupKey" | "groupLabel"> => ({
    groupKey: table.id,
    groupLabel: tableLabel(table),
  });

  // ── Tables ────────────────────────────────────────────────────────────────

  // Duplicate detection folds case: SQL identifiers are case-insensitive in
  // every dialect we export to, so `Users` and `users` collide on CREATE TABLE.
  const tableNameCounts = new Map<string, number>();
  for (const table of tables) {
    if (isBlank(table.name)) continue;
    const key = fold(table.name);
    tableNameCounts.set(key, (tableNameCounts.get(key) ?? 0) + 1);
  }

  const connectedTableIds = new Set<string>();
  for (const rel of relationships) {
    // Only count an edge as connectivity when both ends actually resolve — a
    // dangling relationship left over from a deleted table shouldn't stop its
    // surviving partner from being reported as orphaned.
    if (tablesById.has(rel.sourceTableId) && tablesById.has(rel.targetTableId)) {
      connectedTableIds.add(rel.sourceTableId);
      connectedTableIds.add(rel.targetTableId);
    }
  }

  for (const table of tables) {
    const group = tableGroupOf(table);
    const { schema, table: bareName } = splitSchemaName(table.name);

    if (isBlank(table.name)) {
      findings.push({
        id: `table-name-empty:${table.id}`,
        rule: "table-name-empty",
        severity: "error",
        category: "naming",
        message: "Table has no name.",
        hint: "An unnamed table can't be exported to SQL or DBML.",
        tableId: table.id,
        ...group,
      });
    } else {
      if ((tableNameCounts.get(fold(table.name)) ?? 0) > 1) {
        findings.push({
          id: `table-name-duplicate:${table.id}`,
          rule: "table-name-duplicate",
          severity: "error",
          category: "naming",
          message: `Duplicate table name '${table.name}'.`,
          hint: "Table names are case-insensitive in SQL — rename one, or move it to another schema.",
          tableId: table.id,
          ...group,
        });
      }

      if (SQL_RESERVED_KEYWORDS.has(fold(bareName))) {
        findings.push({
          id: `table-name-reserved:${table.id}`,
          rule: "table-name-reserved",
          severity: "warning",
          category: "naming",
          message: `Table name '${bareName}' is a reserved SQL keyword.`,
          hint: "It will have to be quoted in every query that touches it.",
          tableId: table.id,
          ...group,
        });
      }

      // Checked on the parts, not the whole string: the `schema.` prefix is a
      // dbluna convention, and the dot itself is not an illegal character.
      const unsafePart = [schema, bareName].find(
        (part) => part !== null && part !== "" && !SAFE_IDENTIFIER.test(part)
      );
      if (unsafePart !== undefined) {
        findings.push({
          id: `table-name-needs-quoting:${table.id}`,
          rule: "table-name-needs-quoting",
          severity: "warning",
          category: "naming",
          message: `Table name '${table.name}' needs quoting.`,
          hint: "Stick to letters, digits and underscores, and don't start with a digit, to keep the generated SQL portable.",
          tableId: table.id,
          ...group,
        });
      }
    }

    if (table.columns.length === 0) {
      findings.push({
        id: `table-no-columns:${table.id}`,
        rule: "table-no-columns",
        severity: "warning",
        category: "structure",
        message: `Table '${tableLabel(table)}' has no columns.`,
        hint: "Add at least one column, or delete the table.",
        tableId: table.id,
        ...group,
      });
    }

    if (!connectedTableIds.has(table.id) && tables.length > 1) {
      findings.push({
        id: `table-orphaned:${table.id}`,
        rule: "table-orphaned",
        severity: "info",
        category: "structure",
        message: `Table '${tableLabel(table)}' isn't connected to any other table.`,
        hint: "Expected for lookup and config tables — otherwise it may be missing a relationship.",
        tableId: table.id,
        ...group,
      });
    }

    // ── Columns ─────────────────────────────────────────────────────────────

    const columnNameCounts = new Map<string, number>();
    for (const col of table.columns) {
      if (isBlank(col.name)) continue;
      const key = fold(col.name);
      columnNameCounts.set(key, (columnNameCounts.get(key) ?? 0) + 1);
    }

    let hasPrimaryKey = false;
    const autoIncrementColumns: Column[] = [];

    for (const col of table.columns) {
      if (col.isPrimaryKey) hasPrimaryKey = true;
      if (col.isAutoIncrement) autoIncrementColumns.push(col);

      if (isBlank(col.name)) {
        findings.push({
          id: `column-name-empty:${table.id}:${col.id}`,
          rule: "column-name-empty",
          severity: "error",
          category: "naming",
          message: `A column in '${tableLabel(table)}' has no name.`,
          tableId: table.id,
          columnId: col.id,
          ...group,
        });
      } else {
        if ((columnNameCounts.get(fold(col.name)) ?? 0) > 1) {
          findings.push({
            // Keyed on the column id, not the name: three columns sharing a
            // name have to produce three distinct rows with distinct React keys.
            id: `column-name-duplicate:${table.id}:${col.id}`,
            rule: "column-name-duplicate",
            severity: "error",
            category: "naming",
            message: `Duplicate column '${col.name}' in '${tableLabel(table)}'.`,
            tableId: table.id,
            columnId: col.id,
            ...group,
          });
        }

        if (SQL_RESERVED_KEYWORDS.has(fold(col.name))) {
          findings.push({
            id: `column-name-reserved:${table.id}:${col.id}`,
            rule: "column-name-reserved",
            severity: "warning",
            category: "naming",
            message: `Column '${tableLabel(table)}.${col.name}' is a reserved SQL keyword.`,
            hint: "It will have to be quoted in every query that selects it.",
            tableId: table.id,
            columnId: col.id,
            ...group,
          });
        }

        if (!SAFE_IDENTIFIER.test(col.name.trim())) {
          findings.push({
            id: `column-name-needs-quoting:${table.id}:${col.id}`,
            rule: "column-name-needs-quoting",
            severity: "warning",
            category: "naming",
            message: `Column name '${col.name}' needs quoting.`,
            hint: "Stick to letters, digits and underscores, and don't start with a digit.",
            tableId: table.id,
            columnId: col.id,
            ...group,
          });
        }
      }

      if (isBlank(col.type)) {
        findings.push({
          id: `column-type-missing:${table.id}:${col.id}`,
          rule: "column-type-missing",
          severity: "error",
          category: "types",
          message: `Column '${tableLabel(table)}.${columnLabel(col)}' has no type.`,
          tableId: table.id,
          columnId: col.id,
          ...group,
        });
      } else if (col.isAutoIncrement && !isIntegerType(col.type)) {
        findings.push({
          id: `column-auto-increment-non-integer:${table.id}:${col.id}`,
          rule: "column-auto-increment-non-integer",
          severity: "warning",
          category: "keys",
          message: `'${tableLabel(table)}.${columnLabel(col)}' is auto-increment but typed ${col.type}.`,
          hint: "Auto-increment only applies to integer columns.",
          tableId: table.id,
          columnId: col.id,
          ...group,
        });
      }

      if (col.isPrimaryKey && !col.isNotNull) {
        findings.push({
          id: `column-primary-key-nullable:${table.id}:${col.id}`,
          rule: "column-primary-key-nullable",
          severity: "info",
          category: "keys",
          message: `Primary key '${tableLabel(table)}.${columnLabel(col)}' isn't marked NOT NULL.`,
          hint: "Databases enforce NOT NULL on primary keys anyway — marking it keeps the diagram honest.",
          tableId: table.id,
          columnId: col.id,
          ...group,
        });
      }
    }

    if (!hasPrimaryKey && table.columns.length > 0) {
      findings.push({
        id: `table-no-primary-key:${table.id}`,
        rule: "table-no-primary-key",
        severity: "warning",
        category: "keys",
        message: `Table '${tableLabel(table)}' has no primary key.`,
        hint: "Without one, rows can't be addressed individually and most ORMs won't map the table.",
        tableId: table.id,
        ...group,
      });
    }

    if (autoIncrementColumns.length > 1) {
      findings.push({
        id: `table-multiple-auto-increment:${table.id}`,
        rule: "table-multiple-auto-increment",
        severity: "error",
        category: "keys",
        message: `Table '${tableLabel(table)}' has ${autoIncrementColumns.length} auto-increment columns.`,
        hint: `Only one is allowed per table (${autoIncrementColumns.map(columnLabel).join(", ")}).`,
        tableId: table.id,
        ...group,
      });
    }
  }

  // ── Relationships ─────────────────────────────────────────────────────────

  // Order-insensitive: the canvas draws one edge between two columns, so
  // A.x -> B.y and B.y -> A.x are the same duplicate, not two directions.
  const seenEdges = new Map<string, string>();

  for (const rel of relationships) {
    const sourceTable = tablesById.get(rel.sourceTableId);
    const targetTable = tablesById.get(rel.targetTableId);
    const sourceCol = sourceTable?.columns.find((c) => c.id === rel.sourceColumnId);
    const targetCol = targetTable?.columns.find((c) => c.id === rel.targetColumnId);

    const anchorTable = sourceTable ?? targetTable;
    const group = anchorTable ? tableGroupOf(anchorTable) : schemaGroup("Relationships");
    const relName = rel.name?.trim();

    // A relationship whose table or column was deleted underneath it. The old
    // panel skipped these silently, which is exactly the case a user can't see
    // on the canvas (the edge renders as nothing) and so can't fix.
    if (!sourceTable || !targetTable || !sourceCol || !targetCol) {
      const missing: string[] = [];
      if (!sourceTable) missing.push("source table");
      else if (!sourceCol) missing.push(`source column in '${tableLabel(sourceTable)}'`);
      if (!targetTable) missing.push("target table");
      else if (!targetCol) missing.push(`target column in '${tableLabel(targetTable)}'`);

      findings.push({
        id: `relationship-dangling:${rel.id}`,
        rule: "relationship-dangling",
        severity: "error",
        category: "relationships",
        message: relName
          ? `Relationship '${relName}' points at something that no longer exists.`
          : "A relationship points at something that no longer exists.",
        hint: `Missing ${missing.join(" and ")}. Delete the relationship, or re-point it.`,
        tableId: anchorTable?.id,
        relationshipId: rel.id,
        ...group,
      });
      continue;
    }

    const sourceRef = `${tableLabel(sourceTable)}.${columnLabel(sourceCol)}`;
    const targetRef = `${tableLabel(targetTable)}.${columnLabel(targetCol)}`;

    if (rel.sourceTableId === rel.targetTableId && rel.sourceColumnId === rel.targetColumnId) {
      findings.push({
        id: `relationship-self-column:${rel.id}`,
        rule: "relationship-self-column",
        severity: "warning",
        category: "relationships",
        message: `'${sourceRef}' references itself.`,
        hint: "A self-referencing table needs two columns (e.g. id and parent_id), not one.",
        tableId: sourceTable.id,
        columnId: sourceCol.id,
        relationshipId: rel.id,
        ...group,
      });
    } else {
      const endA = `${rel.sourceTableId}.${rel.sourceColumnId}`;
      const endB = `${rel.targetTableId}.${rel.targetColumnId}`;
      const edgeKey = [endA, endB].sort().join("::");
      if (seenEdges.has(edgeKey)) {
        findings.push({
          id: `relationship-duplicate:${rel.id}`,
          rule: "relationship-duplicate",
          severity: "warning",
          category: "relationships",
          message: `Duplicate relationship between '${sourceRef}' and '${targetRef}'.`,
          hint: "The same pair of columns is already linked — delete one of the two.",
          tableId: sourceTable.id,
          relationshipId: rel.id,
          ...group,
        });
      } else {
        seenEdges.set(edgeKey, rel.id);
      }
    }

    // Type compatibility across the FK. Enums and user-defined types have no
    // family, so they fall back to an exact base-name compare.
    if (!isBlank(sourceCol.type) && !isBlank(targetCol.type)) {
      const src = normalizeTypeName(sourceCol.type);
      const tgt = normalizeTypeName(targetCol.type);
      const srcFamily = familyOf(src.base);
      const tgtFamily = familyOf(tgt.base);
      const sameFamily =
        srcFamily !== null && tgtFamily !== null
          ? srcFamily === tgtFamily
          : src.base === tgt.base;

      if (!sameFamily) {
        findings.push({
          id: `relationship-type-incompatible:${rel.id}`,
          rule: "relationship-type-incompatible",
          severity: "warning",
          category: "types",
          message: `Type mismatch: '${sourceRef}' is ${sourceCol.type}, '${targetRef}' is ${targetCol.type}.`,
          hint: "A foreign key has to be comparable to the column it references.",
          tableId: sourceTable.id,
          columnId: sourceCol.id,
          relationshipId: rel.id,
          ...group,
        });
      } else if (src.base !== tgt.base || src.args !== tgt.args) {
        findings.push({
          id: `relationship-type-width:${rel.id}`,
          rule: "relationship-type-width",
          severity: "info",
          category: "types",
          message: `'${sourceRef}' (${sourceCol.type}) and '${targetRef}' (${targetCol.type}) differ in width.`,
          hint: "Same type family, different size — values can overflow or be truncated on join.",
          tableId: sourceTable.id,
          columnId: sourceCol.id,
          relationshipId: rel.id,
          ...group,
        });
      }
    }

    const ends = fkEnds(rel);
    const fkTable = ends.fk === "source" ? sourceTable : targetTable;
    const fkCol = ends.fk === "source" ? sourceCol : targetCol;
    const refTable = ends.ref === "source" ? sourceTable : targetTable;
    const refCol = ends.ref === "source" ? sourceCol : targetCol;
    const fkRef = `${tableLabel(fkTable)}.${columnLabel(fkCol)}`;
    const refRef = `${tableLabel(refTable)}.${columnLabel(refCol)}`;

    if (!refCol.isPrimaryKey && !refCol.isUnique) {
      findings.push({
        id: `relationship-target-not-unique:${rel.id}`,
        rule: "relationship-target-not-unique",
        severity: "warning",
        category: "relationships",
        message: `'${fkRef}' references '${refRef}', which is neither a primary key nor unique.`,
        hint: "Most databases reject a foreign key onto a non-unique column. If the two ends look swapped, check the relationship's cardinality — it decides which side holds the key.",
        tableId: refTable.id,
        columnId: refCol.id,
        relationshipId: rel.id,
        ...group,
      });
    }

    const setNullActions = [
      rel.onDelete === "Set null" ? "ON DELETE" : null,
      rel.onUpdate === "Set null" ? "ON UPDATE" : null,
    ].filter((v): v is string => v !== null);

    if (setNullActions.length > 0 && fkCol.isNotNull) {
      findings.push({
        id: `relationship-set-null-on-not-null:${rel.id}`,
        rule: "relationship-set-null-on-not-null",
        severity: "error",
        category: "relationships",
        message: `${setNullActions.join(" / ")} SET NULL on '${fkRef}', which is NOT NULL.`,
        hint: "The database will reject this constraint — drop NOT NULL, or pick another referential action.",
        tableId: fkTable.id,
        columnId: fkCol.id,
        relationshipId: rel.id,
        ...group,
      });
    }
  }

  findings.push(...findCircularRelationships(tables, relationships, tablesById));

  // ── Enums ─────────────────────────────────────────────────────────────────

  const enumGroup = schemaGroup("Enums");
  const enumNameCounts = new Map<string, number>();
  for (const en of enums) {
    if (isBlank(en.name)) continue;
    const key = fold(en.name);
    enumNameCounts.set(key, (enumNameCounts.get(key) ?? 0) + 1);
  }

  // Enum-name matching goes through `normalizeTypeName` for the same reason
  // lib/enum-usage.ts does it: a canvas column typed `order_status` comes back
  // as `ORDER_STATUS` after a single Code-tab round-trip, so an exact compare
  // would report essentially every enum as unused.
  const usedTypeNames = new Set<string>();
  for (const table of tables) {
    for (const col of table.columns) {
      if (!isBlank(col.type)) usedTypeNames.add(normalizeTypeName(col.type).base);
    }
  }

  for (const en of enums) {
    if (isBlank(en.name)) {
      findings.push({
        id: `enum-name-empty:${en.id}`,
        rule: "enum-name-empty",
        severity: "error",
        category: "enums",
        message: "An enum has no name.",
        enumId: en.id,
        ...enumGroup,
      });
    } else {
      if ((enumNameCounts.get(fold(en.name)) ?? 0) > 1) {
        findings.push({
          id: `enum-name-duplicate:${en.id}`,
          rule: "enum-name-duplicate",
          severity: "error",
          category: "enums",
          message: `Duplicate enum name '${en.name}'.`,
          enumId: en.id,
          ...enumGroup,
        });
      }

      if (!usedTypeNames.has(normalizeTypeName(en.name).base)) {
        findings.push({
          id: `enum-unused:${en.id}`,
          rule: "enum-unused",
          severity: "info",
          category: "enums",
          message: `Enum '${en.name}' isn't used by any column.`,
          hint: "Assign it as a column type, or remove it.",
          enumId: en.id,
          ...enumGroup,
        });
      }
    }

    if (en.values.length === 0) {
      findings.push({
        id: `enum-no-values:${en.id}`,
        rule: "enum-no-values",
        severity: "warning",
        category: "enums",
        message: `Enum '${isBlank(en.name) ? "(unnamed)" : en.name}' has no values.`,
        enumId: en.id,
        ...enumGroup,
      });
    }

    const valueCounts = new Map<string, number>();
    for (const value of en.values) {
      const key = fold(value.name);
      valueCounts.set(key, (valueCounts.get(key) ?? 0) + 1);
    }
    for (const [key, count] of valueCounts) {
      if (count > 1) {
        findings.push({
          id: `enum-duplicate-value:${en.id}:${key}`,
          rule: "enum-duplicate-value",
          severity: "warning",
          category: "enums",
          message: `Enum '${isBlank(en.name) ? "(unnamed)" : en.name}' repeats the value '${key}'.`,
          enumId: en.id,
          ...enumGroup,
        });
      }
    }
  }

  // ── Table groups ──────────────────────────────────────────────────────────

  const knownTableNames = new Set(tables.map((t) => fold(t.name)));
  for (const tg of tableGroups) {
    for (const member of tg.tableNames) {
      if (knownTableNames.has(fold(member))) continue;
      findings.push({
        id: `table-group-unknown-member:${tg.id}:${fold(member)}`,
        rule: "table-group-unknown-member",
        severity: "warning",
        category: "structure",
        message: `Table group '${tg.name}' lists '${member}', which doesn't exist.`,
        hint: "The table was renamed or deleted — update the group in the Code tab.",
        ...schemaGroup("Table groups"),
      });
    }
  }

  return sortIssues(findings);
}

/**
 * Cycles in the FK graph. Legal in every dialect we export to, but they make a
 * plain INSERT order impossible without deferrable constraints, so they're
 * worth surfacing. Self-references are excluded — a `parent_id` hierarchy is
 * the normal way to model a tree, not a mistake.
 */
function findCircularRelationships(
  tables: Table[],
  relationships: Relationship[],
  tablesById: Map<string, Table>
): Issue[] {
  const edges = new Map<string, Set<string>>();
  for (const rel of relationships) {
    if (!tablesById.has(rel.sourceTableId) || !tablesById.has(rel.targetTableId)) continue;
    if (rel.sourceTableId === rel.targetTableId) continue;
    const ends = fkEnds(rel);
    const from = ends.fk === "source" ? rel.sourceTableId : rel.targetTableId;
    const to = ends.ref === "source" ? rel.sourceTableId : rel.targetTableId;
    const set = edges.get(from);
    if (set) set.add(to);
    else edges.set(from, new Set([to]));
  }

  const findings: Issue[] = [];
  // Canonical cycle key (sorted member ids) so A->B->A isn't reported once from
  // A's traversal and again from B's.
  const reported = new Set<string>();
  const state = new Map<string, 0 | 1 | 2>(); // 0 unvisited, 1 on stack, 2 done
  const stack: string[] = [];

  const visit = (id: string) => {
    state.set(id, 1);
    stack.push(id);
    for (const next of edges.get(id) ?? []) {
      const s = state.get(next) ?? 0;
      if (s === 1) {
        const cycle = stack.slice(stack.indexOf(next));
        const key = [...cycle].sort().join("::");
        if (!reported.has(key)) {
          reported.add(key);
          const names = cycle.map((tid) => {
            const t = tablesById.get(tid);
            return t ? tableLabel(t) : "(unnamed table)";
          });
          findings.push({
            id: `relationship-circular:${key}`,
            rule: "relationship-circular",
            severity: "warning",
            category: "relationships",
            message: `Circular foreign keys: ${[...names, names[0]].join(" → ")}.`,
            hint: "Rows can't be inserted in any order unless one of these constraints is nullable or deferrable.",
            tableId: cycle[0],
            groupKey: cycle[0],
            groupLabel: names[0],
          });
        }
      } else if (s === 0) {
        visit(next);
      }
    }
    stack.pop();
    state.set(id, 2);
  };

  for (const table of tables) {
    if ((state.get(table.id) ?? 0) === 0) visit(table.id);
  }

  return findings;
}

/** Errors first, then warnings, then info; stable within a severity. */
export function sortIssues(issues: Issue[]): Issue[] {
  return [...issues].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

export function countIssues(issues: Issue[]): IssueCounts {
  const counts: IssueCounts = { error: 0, warning: 0, info: 0, total: issues.length };
  for (const issue of issues) counts[issue.severity] += 1;
  return counts;
}

/**
 * Memo key for the analysis.
 *
 * Callers must key on this and never on the array identities: `updateTablePos`
 * / `moveTables` replace `tables` on every pointermove of a canvas drag, and
 * re-linting the whole schema per frame is what made the old panel stutter on
 * large diagrams. Deliberately excludes x/y/color/comment — nothing above
 * reads them — and deliberately includes the PK/NN/UQ/AI flags, which
 * `tablesStructureSignature` in lib/enum-usage.ts leaves out.
 */
export function issuesSignature(model: DiagramModel): string {
  // Control characters as delimiters, same reasoning as
  // `tablesStructureSignature`: a user-supplied name can contain any printable
  // separator, and an ambiguous join would let two different schemas collide.
  const F = "\u0001";
  const R = "\u0002";
  let out = "";
  for (const table of model.tables) {
    out += table.id + F + table.name + F;
    for (const col of table.columns) {
      out +=
        col.id +
        F +
        col.name +
        F +
        col.type +
        F +
        (col.isPrimaryKey ? "1" : "0") +
        (col.isNotNull ? "1" : "0") +
        (col.isUnique ? "1" : "0") +
        (col.isAutoIncrement ? "1" : "0") +
        F;
    }
    out += R;
  }
  out += R;
  for (const rel of model.relationships) {
    out +=
      rel.id + F + rel.name + F + rel.sourceTableId + F + rel.sourceColumnId + F +
      rel.targetTableId + F + rel.targetColumnId + F + rel.cardinality + F +
      rel.onUpdate + F + rel.onDelete + R;
  }
  out += R;
  for (const en of model.enums ?? []) {
    out += en.id + F + en.name + F + en.values.map((v) => v.name).join(F) + R;
  }
  out += R;
  for (const tg of model.tableGroups ?? []) {
    out += tg.id + F + tg.name + F + tg.tableNames.join(F) + R;
  }
  return out;
}
