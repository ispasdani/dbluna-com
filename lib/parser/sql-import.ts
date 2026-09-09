import {
  parseSchemaSource,
  parsedTablesToCanvasTables,
  parsedRefsToCanvasRelationships,
  type ParsedTable,
  type SchemaSourceFormat,
} from "@/lib/parser/dsl-parser";
import type { Table, Relationship } from "@/store/useCanvasStore";
import { TABLE_COLORS } from "@/store/useCanvasStore";

/* ─────────────────────────────────────────────────────────────────────────────
   Dialects
───────────────────────────────────────────────────────────────────────────── */

/** Every SQL grammar `@dbml/core` can read. "dbml" is the Code tab's own format. */
export type SqlDialect = Exclude<SchemaSourceFormat, "dbml">;

export const SQL_DIALECTS: { id: SqlDialect; label: string }[] = [
  { id: "postgres", label: "PostgreSQL" },
  { id: "mssql", label: "SQL Server" },
  { id: "mysql", label: "MySQL" },
  { id: "oracle", label: "Oracle" },
  { id: "snowflake", label: "Snowflake" },
];

const DIALECT_LABELS: Record<SqlDialect, string> = SQL_DIALECTS.reduce(
  (acc, d) => ({ ...acc, [d.id]: d.label }),
  {} as Record<SqlDialect, string>
);

export const sqlDialectLabel = (dialect: SqlDialect): string => DIALECT_LABELS[dialect];

/* ─────────────────────────────────────────────────────────────────────────────
   Lexical helpers

   The scanning below only ever collects identifiers, so it works on a copy of
   the script with comments and string literals blanked out — otherwise a
   `-- see REFERENCES below` comment would be read as a real foreign key.
───────────────────────────────────────────────────────────────────────────── */

const stripNoise = (sql: string): string =>
  sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .replace(/'(?:[^']|'')*'/g, "''");

// A single identifier: [bracketed], "quoted", `backticked`, or bare.
const IDENT = String.raw`(?:\[[^\]]+\]|"[^"]+"|\x60[^\x60]+\x60|[A-Za-z_][\w$#@]*)`;
// Up to a three-part name (`db.schema.table`), with optional spaces around dots.
const QUALIFIED = String.raw`${IDENT}(?:\s*\.\s*${IDENT}){0,2}`;

const CREATE_TABLE_RE = new RegExp(
  String.raw`\bCREATE\s+(?:OR\s+REPLACE\s+)?(?:GLOBAL\s+|LOCAL\s+|TEMP\s+|TEMPORARY\s+|UNLOGGED\s+)*TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(${QUALIFIED})`,
  "gi"
);

const REFERENCES_RE = new RegExp(
  String.raw`\bREFERENCES\s+(${QUALIFIED})\s*(?:\(([^)]*)\))?`,
  "gi"
);

/** Strips the quoting characters from one identifier: `[Company]` → `Company`. */
const unquote = (ident: string): string =>
  ident.trim().replace(/^[[\x60"]/, "").replace(/[\]\x60"]$/, "");

/**
 * Reduces a possibly three-part name to the `schema.table` pair the parser
 * works in, lower-cased so `[dbo].[Users]` and `dbo.users` compare equal.
 */
const nameKey = (qualified: string): string => {
  const parts = qualified.split(".").map(unquote);
  return parts.slice(-2).join(".").toLowerCase();
};

/* ─────────────────────────────────────────────────────────────────────────────
   Placeholders for tables the script references but never defines
───────────────────────────────────────────────────────────────────────────── */

interface MissingReference {
  /** The target exactly as written in the script, so the parser resolves it. */
  raw: string;
  /** Column identifiers (verbatim) named across every FK pointing at it. */
  columns: string[];
}

/**
 * Real-world DDL is usually one schema out of a larger database, so its foreign
 * keys point at tables that aren't in the paste. `@dbml/core` treats an
 * unresolvable reference as a hard syntax error and gives up on the *whole*
 * script, so we find those targets up front and append a stub `CREATE TABLE`
 * for each. The stub is emitted with the target's original identifier text so
 * the parser matches it under any dialect's quoting rules.
 */
export const findMissingReferences = (sql: string): MissingReference[] => {
  const scannable = stripNoise(sql);

  const defined = new Set<string>();
  for (const match of scannable.matchAll(CREATE_TABLE_RE)) {
    defined.add(nameKey(match[1]));
  }

  const missing = new Map<string, MissingReference>();
  for (const match of scannable.matchAll(REFERENCES_RE)) {
    const raw = match[1].trim();
    const key = nameKey(raw);
    if (defined.has(key)) continue;

    const entry = missing.get(key) ?? { raw, columns: [] };
    const columns = (match[2] ?? "")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    for (const col of columns) {
      if (!entry.columns.some((c) => unquote(c).toLowerCase() === unquote(col).toLowerCase())) {
        entry.columns.push(col);
      }
    }
    missing.set(key, entry);
  }

  return [...missing.values()];
};

const buildPlaceholderDdl = (missing: MissingReference[]): string =>
  missing
    .map((ref) => {
      // A bare `REFERENCES orders` (no column list) points at the target's
      // primary key, so the stub needs one for the parser to bind to.
      const columns = ref.columns.length ? ref.columns : ["id"];
      const defs = columns.map((c) => `${c} BIGINT NOT NULL`).join(", ");
      const pk = columns.join(", ");
      return `CREATE TABLE ${ref.raw} (${defs}, PRIMARY KEY (${pk}));`;
    })
    .join("\n");

/* ─────────────────────────────────────────────────────────────────────────────
   Dialect detection
───────────────────────────────────────────────────────────────────────────── */

const DIALECT_SIGNALS: { dialect: SqlDialect; pattern: RegExp; weight: number }[] = [
  { dialect: "mssql", pattern: /^\s*GO\s*$/gim, weight: 3 },
  { dialect: "mssql", pattern: /\bIDENTITY\s*\(/gi, weight: 3 },
  { dialect: "mssql", pattern: /\bN?VARCHAR\s*\(\s*MAX\s*\)/gi, weight: 3 },
  { dialect: "mssql", pattern: /\bDATETIME2\b|\bUNIQUEIDENTIFIER\b|\bNVARCHAR\b/gi, weight: 2 },
  { dialect: "mssql", pattern: /\bPRIMARY\s+KEY\s+(?:NON)?CLUSTERED\b/gi, weight: 2 },
  { dialect: "mssql", pattern: /\[[^\]\n]+\]/g, weight: 1 },
  { dialect: "mysql", pattern: /\bAUTO_INCREMENT\b/gi, weight: 3 },
  { dialect: "mysql", pattern: /\bENGINE\s*=/gi, weight: 3 },
  { dialect: "mysql", pattern: /\x60[^\x60\n]+\x60/g, weight: 2 },
  { dialect: "mysql", pattern: /\bTINYINT\b|\bUNSIGNED\b/gi, weight: 1 },
  { dialect: "postgres", pattern: /\b(?:BIG|SMALL)?SERIAL\b/gi, weight: 3 },
  { dialect: "postgres", pattern: /::[a-z_]+|\bBYTEA\b|\bJSONB\b|\bTIMESTAMPTZ\b/gi, weight: 2 },
  { dialect: "postgres", pattern: /\bALTER\s+TABLE\s+ONLY\b|\bOWNER\s+TO\b/gi, weight: 2 },
  { dialect: "oracle", pattern: /\bVARCHAR2\b|\bNVARCHAR2\b|\bNUMBER\s*\(/gi, weight: 3 },
  { dialect: "snowflake", pattern: /\bVARIANT\b|\bCREATE\s+OR\s+REPLACE\s+TABLE\b/gi, weight: 3 },
];

/**
 * Scores dialect-specific syntax to guess which SQL flavour was pasted. Each
 * signal counts once however often it repeats — one `AUTO_INCREMENT` is already
 * conclusive, and repetition shouldn't outvote a rarer but stronger cue.
 * Falls back to PostgreSQL, the most forgiving grammar for plain-ANSI DDL that
 * matches nothing at all.
 */
export const detectSqlDialect = (sql: string): SqlDialect => {
  const scannable = stripNoise(sql);
  const scores = new Map<SqlDialect, number>();

  for (const signal of DIALECT_SIGNALS) {
    if (!signal.pattern.test(scannable)) continue;
    // `test` with a /g/ pattern advances lastIndex; reset so the shared module-level
    // regexes stay usable on the next call.
    signal.pattern.lastIndex = 0;
    scores.set(signal.dialect, (scores.get(signal.dialect) ?? 0) + signal.weight);
  }

  let best: SqlDialect = "postgres";
  let bestScore = 0;
  for (const [dialect, score] of scores) {
    if (score > bestScore) {
      best = dialect;
      bestScore = score;
    }
  }
  return best;
};

/* ─────────────────────────────────────────────────────────────────────────────
   Column flags the SQL grammars don't put on the column
───────────────────────────────────────────────────────────────────────────── */

// SQL Server folds `IDENTITY(1,1)` into the type name instead of flagging the
// column, so `BIGINT IDENTITY(1,1)` arrives as one opaque type string.
const IDENTITY_SUFFIX = /\s+IDENTITY\s*(?:\(\s*-?\d+\s*,\s*-?\d+\s*\))?\s*$/i;

/**
 * Folds table-level constraints back onto the columns they constrain.
 *
 * `@dbml/core` reports `CONSTRAINT [PK_x] PRIMARY KEY ([Id])` as a table index
 * rather than a flag on `Id` — and virtually every script written by a real
 * database tool declares its keys that way, so without this an import lands
 * with no primary keys at all.
 */
const applyTableLevelFlags = (tables: Table[], parsedTables: ParsedTable[]): Table[] =>
  tables.map((table, i) => {
    const pkColumns = new Set<string>();
    const uniqueColumns = new Set<string>();

    for (const index of parsedTables[i]?.indexes ?? []) {
      const names = (index.columns ?? [])
        .map((c) => c.value ?? c.name)
        .filter((n): n is string => typeof n === "string");
      if (index.pk) {
        for (const name of names) pkColumns.add(name);
      } else if (index.unique && names.length === 1) {
        // A composite unique index constrains the combination, not each column
        // on its own, so it has no single-column equivalent on the canvas.
        uniqueColumns.add(names[0]);
      }
    }

    return {
      ...table,
      columns: table.columns.map((column) => {
        const isIdentity = IDENTITY_SUFFIX.test(column.type);
        return {
          ...column,
          type: isIdentity ? column.type.replace(IDENTITY_SUFFIX, "") : column.type,
          isPrimaryKey: column.isPrimaryKey || pkColumns.has(column.name),
          isUnique: column.isUnique || uniqueColumns.has(column.name),
          isAutoIncrement: column.isAutoIncrement || isIdentity,
        };
      }),
    };
  });

/* ─────────────────────────────────────────────────────────────────────────────
   Errors
───────────────────────────────────────────────────────────────────────────── */

export interface SqlImportIssue {
  line?: number;
  column?: number;
  message: string;
}

export class SqlImportError extends Error {
  readonly issues: SqlImportIssue[];
  /** Dialect the failing attempt used, so the UI can suggest picking another. */
  readonly dialect: SqlDialect;

  constructor(message: string, dialect: SqlDialect, issues: SqlImportIssue[]) {
    super(message);
    this.name = "SqlImportError";
    this.dialect = dialect;
    this.issues = issues;
  }
}

/** One entry of a `@dbml/core` CompilerError's `diags` bag. */
interface CompilerDiagnostic {
  message?: string;
  error?: string;
  location?: { start?: { line?: number; column?: number } };
}

const MAX_EXPECTED_TOKENS = 6;

/**
 * ANTLR spells out every token that would have been legal at the failure
 * point, which for the T-SQL grammar is a few thousand keywords — far too
 * long to show, and it buries the part of the message that matters. Keep the
 * first few so the issue still says what the grammar wanted.
 */
const condenseExpectedTokens = (message: string): string =>
  message.replace(/expecting \{([^}]*)\}/, (whole, list: string) => {
    const tokens = list.split(", ");
    if (tokens.length <= MAX_EXPECTED_TOKENS) return whole;
    const shown = tokens.slice(0, MAX_EXPECTED_TOKENS).join(", ");
    return `expecting {${shown}, +${tokens.length - MAX_EXPECTED_TOKENS} more}`;
  });

/** Normalizes a `@dbml/core` CompilerError into flat, displayable issues. */
const toIssues = (error: unknown): SqlImportIssue[] => {
  const diags = (error as { diags?: unknown })?.diags;
  if (!Array.isArray(diags)) return [];
  return (diags as CompilerDiagnostic[]).slice(0, 20).map((d) => ({
    line: d?.location?.start?.line,
    column: d?.location?.start?.column,
    message: condenseExpectedTokens(d?.message || d?.error || "Syntax error"),
  }));
};

/* ─────────────────────────────────────────────────────────────────────────────
   Import
───────────────────────────────────────────────────────────────────────────── */

export interface SqlImportOptions {
  /** "auto" scores the script and retries other dialects if the guess fails. */
  dialect?: SqlDialect | "auto";
}

export interface SqlImportResult {
  tables: Table[];
  relationships: Relationship[];
  /** The dialect the script actually parsed under. */
  dialect: SqlDialect;
  /** True when `dialect` came from detection rather than the caller. */
  autoDetected: boolean;
  /** Canvas ids of the stub tables, so callers can flag or drop them. */
  placeholderTableIds: string[];
}

/**
 * Removes the stub tables synthesized for out-of-script foreign key targets,
 * along with the relationships that pointed at them.
 *
 * The stubs can't be skipped at parse time — that would mean surgically editing
 * every dangling FK clause out of the script — so callers who don't want them
 * filter the finished result through here instead.
 */
export const dropPlaceholderTables = (result: SqlImportResult): SqlImportResult => {
  const dropped = new Set(result.placeholderTableIds);
  if (dropped.size === 0) return result;
  return {
    ...result,
    tables: result.tables.filter((t) => !dropped.has(t.id)),
    relationships: result.relationships.filter(
      (r) => !dropped.has(r.sourceTableId) && !dropped.has(r.targetTableId)
    ),
  };
};

/**
 * Parses pasted SQL DDL into canvas tables and relationships. Placeholder
 * tables for out-of-script foreign key targets are always included; pass the
 * result through `dropPlaceholderTables` to leave them out.
 *
 * @throws {SqlImportError} when no dialect can parse the script.
 */
export const importSqlSchema = (
  sql: string,
  { dialect = "auto" }: SqlImportOptions = {}
): SqlImportResult => {
  if (!sql.trim()) {
    throw new SqlImportError("Paste a SQL script to import.", "postgres", []);
  }

  const missing = findMissingReferences(sql);
  const placeholderDdl = buildPlaceholderDdl(missing);
  const source = placeholderDdl ? `${sql}\n\n${placeholderDdl}` : sql;

  const detected = detectSqlDialect(sql);
  const autoDetected = dialect === "auto";
  // An explicit choice is honoured as-is; only auto-detection falls back, and it
  // reports the detected dialect's error when every candidate fails.
  const candidates: SqlDialect[] = autoDetected
    ? [detected, ...SQL_DIALECTS.map((d) => d.id).filter((d) => d !== detected)]
    : [dialect];

  let firstError: SqlImportError | null = null;

  for (const candidate of candidates) {
    let parsed;
    try {
      parsed = parseSchemaSource(source, candidate);
    } catch (error) {
      firstError ??= new SqlImportError(
        `Could not parse this script as ${sqlDialectLabel(candidate)}.`,
        candidate,
        toIssues(error)
      );
      continue;
    }

    // A grammar can accept a script it doesn't really understand and hand back
    // nothing — treat that as a failure so auto-detect keeps trying.
    if (parsed.tables.length === 0) {
      firstError ??= new SqlImportError(
        "No CREATE TABLE statements were found in this script.",
        candidate,
        []
      );
      continue;
    }

    const mapped = parsedTablesToCanvasTables(parsed.tables, {
      existingTables: [],
      originX: 0,
      originY: 0,
    }).map((table, index) => ({
      // `parsedTablesToCanvasTables` paints every new table the Code tab's single
      // default colour; an import of dozens of tables reads better cycling the palette.
      ...table,
      color: TABLE_COLORS[index % TABLE_COLORS.length],
    }));
    const tables = applyTableLevelFlags(mapped, parsed.tables);

    const relationships = parsedRefsToCanvasRelationships(parsed.refs, tables, []);

    const placeholderKeys = new Set(missing.map((ref) => nameKey(ref.raw)));
    const placeholderTableIds = tables
      .filter((t) => placeholderKeys.has(nameKey(t.name)))
      .map((t) => t.id);

    return { tables, relationships, dialect: candidate, autoDetected, placeholderTableIds };
  }

  throw firstError ?? new SqlImportError("Could not parse this SQL script.", detected, []);
};
