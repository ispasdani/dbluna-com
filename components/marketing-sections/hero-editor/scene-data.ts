/* ─────────────────────────────────────────────────────────────────────────────
   Data for the hero's editor mock: the tables on its canvas, the relationships
   between them, and the DBML the Code tab shows for them. The DBML is built
   from the same tables, so the code panel and the canvas always agree.
   Coordinates are in the canvas's own space (1440 × 706, below the two bars).
───────────────────────────────────────────────────────────────────────────── */

export type HeroCol = {
  name: string;
  type: string;
  kind?: "pk" | "fk" | "uq";
  notNull?: boolean;
};

export type HeroTable = {
  id: string;
  schema: string;
  name: string;
  color: string;
  x: number;
  y: number;
  cols: HeroCol[];
};

export type LinkEnd = { table: string; row: number; side: "L" | "R" };

export type HeroLinkDef = {
  id: string;
  /** The "one" end: a primary key. */
  from: LinkEnd;
  /** The "many" end: the foreign key column. */
  to: LinkEnd;
  /** x of the vertical run. */
  mx: number;
};

// Canvas geometry, matching the editor's Recommended style.
export const TABLE_W = 200;
export const HEAD = 34;
export const PAD_TOP = 4;
export const ROW = 22;

export const rowY = (y: number, i: number) => y + HEAD + PAD_TOP + i * ROW + ROW / 2;
export const tableH = (rows: number) => HEAD + PAD_TOP + rows * ROW + 6;

/** The column the Code tab types into Customers on the first loop. */
export const TYPED_COL: HeroCol = { name: "Phone", type: "NVARCHAR(30)" };

export const TABLES: HeroTable[] = [
  {
    id: "customers",
    schema: "sales",
    name: "Customers",
    color: "#f97316",
    x: 400,
    y: 36,
    cols: [
      { name: "Id", type: "BIGINT", kind: "pk" },
      { name: "CompanyId", type: "BIGINT", notNull: true },
      { name: "Email", type: "NVARCHAR(255)", kind: "uq", notNull: true },
      { name: "FullName", type: "NVARCHAR(150)", notNull: true },
      { name: "Country", type: "NVARCHAR(2)" },
      { name: "IsActive", type: "BIT", notNull: true },
      { name: "Created", type: "DATETIME2(7)", notNull: true },
    ],
  },
  {
    id: "users",
    schema: "auth",
    name: "Users",
    color: "#8b5cf6",
    x: 400,
    y: 300,
    cols: [
      { name: "Id", type: "BIGINT", kind: "pk" },
      { name: "CustomerId", type: "BIGINT", kind: "fk", notNull: true },
      { name: "Username", type: "NVARCHAR(50)", kind: "uq", notNull: true },
      { name: "PasswordHash", type: "VARBINARY(64)", notNull: true },
      { name: "LastLoginAt", type: "DATETIME2(7)" },
      { name: "IsLocked", type: "BIT", notNull: true },
    ],
  },
  {
    id: "sessions",
    schema: "auth",
    name: "Sessions",
    color: "#8b5cf6",
    x: 400,
    y: 530,
    cols: [
      { name: "Id", type: "BIGINT", kind: "pk" },
      { name: "UserId", type: "BIGINT", kind: "fk", notNull: true },
      { name: "Token", type: "NVARCHAR(64)", kind: "uq", notNull: true },
      { name: "ExpiresAt", type: "DATETIME2(7)", notNull: true },
      { name: "UserAgent", type: "NVARCHAR(MAX)" },
    ],
  },
  {
    id: "orders",
    schema: "sales",
    name: "Orders",
    color: "#f97316",
    x: 680,
    y: 120,
    cols: [
      { name: "Id", type: "BIGINT", kind: "pk" },
      { name: "CustomerId", type: "BIGINT", kind: "fk", notNull: true },
      { name: "Status", type: "NVARCHAR(20)", notNull: true },
      { name: "Currency", type: "NVARCHAR(3)", notNull: true },
      { name: "Subtotal", type: "DECIMAL(18,2)", notNull: true },
      { name: "TaxTotal", type: "DECIMAL(18,2)", notNull: true },
      { name: "PlacedAt", type: "DATETIME2(7)", notNull: true },
      { name: "ShippedAt", type: "DATETIME2(7)" },
    ],
  },
  {
    id: "invoices",
    schema: "billing",
    name: "Invoices",
    color: "#10b981",
    x: 680,
    y: 440,
    cols: [
      { name: "Id", type: "BIGINT", kind: "pk" },
      { name: "OrderId", type: "BIGINT", kind: "fk", notNull: true },
      { name: "Number", type: "NVARCHAR(30)", kind: "uq", notNull: true },
      { name: "AmountDue", type: "DECIMAL(18,2)", notNull: true },
      { name: "DueDate", type: "DATE", notNull: true },
      { name: "PaidAt", type: "DATETIME2(7)" },
    ],
  },
  {
    id: "orderItems",
    schema: "sales",
    name: "OrderItems",
    color: "#f97316",
    x: 960,
    y: 36,
    cols: [
      { name: "Id", type: "BIGINT", kind: "pk" },
      { name: "OrderId", type: "BIGINT", kind: "fk", notNull: true },
      { name: "ProductId", type: "BIGINT", kind: "fk", notNull: true },
      { name: "Quantity", type: "INT", notNull: true },
      { name: "UnitPrice", type: "DECIMAL(18,2)", notNull: true },
      { name: "Discount", type: "DECIMAL(5,2)" },
    ],
  },
  {
    id: "products",
    schema: "catalog",
    name: "Products",
    color: "#0ea5e9",
    x: 960,
    y: 262,
    cols: [
      { name: "Id", type: "BIGINT", kind: "pk" },
      { name: "CategoryId", type: "BIGINT", kind: "fk", notNull: true },
      { name: "Sku", type: "NVARCHAR(40)", kind: "uq", notNull: true },
      { name: "Name", type: "NVARCHAR(150)", notNull: true },
      { name: "Price", type: "DECIMAL(18,2)", notNull: true },
      { name: "Stock", type: "INT", notNull: true },
      { name: "IsPublished", type: "BIT", notNull: true },
    ],
  },
  {
    id: "categories",
    schema: "catalog",
    name: "Categories",
    color: "#0ea5e9",
    x: 1225,
    y: 110,
    cols: [
      { name: "Id", type: "BIGINT", kind: "pk" },
      { name: "ParentId", type: "BIGINT", kind: "fk" },
      { name: "Name", type: "NVARCHAR(100)", notNull: true },
      { name: "Slug", type: "NVARCHAR(100)", kind: "uq", notNull: true },
    ],
  },
  {
    id: "payments",
    schema: "billing",
    name: "Payments",
    color: "#10b981",
    x: 1225,
    y: 370,
    cols: [
      { name: "Id", type: "BIGINT", kind: "pk" },
      { name: "InvoiceId", type: "BIGINT", kind: "fk", notNull: true },
      { name: "Provider", type: "NVARCHAR(30)", notNull: true },
      { name: "Amount", type: "DECIMAL(18,2)", notNull: true },
      { name: "CapturedAt", type: "DATETIME2(7)" },
    ],
  },
];

export const TABLE_BY_ID = Object.fromEntries(TABLES.map((t) => [t.id, t])) as Record<string, HeroTable>;

export const LINKS: HeroLinkDef[] = [
  { id: "customer-orders", from: { table: "customers", row: 0, side: "R" }, to: { table: "orders", row: 1, side: "L" }, mx: 640 },
  { id: "customer-users", from: { table: "customers", row: 0, side: "R" }, to: { table: "users", row: 1, side: "R" }, mx: 622 },
  { id: "user-sessions", from: { table: "users", row: 0, side: "R" }, to: { table: "sessions", row: 1, side: "R" }, mx: 644 },
  { id: "order-items", from: { table: "orders", row: 0, side: "R" }, to: { table: "orderItems", row: 1, side: "L" }, mx: 912 },
  { id: "order-invoices", from: { table: "orders", row: 0, side: "R" }, to: { table: "invoices", row: 1, side: "R" }, mx: 904 },
  { id: "product-items", from: { table: "products", row: 0, side: "L" }, to: { table: "orderItems", row: 2, side: "L" }, mx: 934 },
  { id: "category-products", from: { table: "categories", row: 0, side: "L" }, to: { table: "products", row: 1, side: "R" }, mx: 1192 },
  { id: "invoice-payments", from: { table: "invoices", row: 0, side: "R" }, to: { table: "payments", row: 1, side: "L" }, mx: 1195 },
];

/** Where a link end sits, before any drag offset. */
export function endPoint(end: LinkEnd) {
  const t = TABLE_BY_ID[end.table];
  return { x: end.side === "L" ? t.x : t.x + TABLE_W, y: rowY(t.y, end.row) };
}

/** Rounded orthogonal path from (x1,y1) to (x2,y2) with its vertical run at `mx`. */
export function route(x1: number, y1: number, x2: number, y2: number, mx: number) {
  const r = Math.min(8, Math.abs(y2 - y1) / 2);
  const dy = y2 > y1 ? 1 : -1;
  const d1 = mx > x1 ? 1 : -1;
  const d2 = x2 > mx ? 1 : -1;
  return `M${x1} ${y1}H${mx - d1 * r}Q${mx} ${y1} ${mx} ${y1 + dy * r}V${y2 - dy * r}Q${mx} ${y2} ${mx + d2 * r} ${y2}H${x2}`;
}

// ─── DBML ────────────────────────────────────────────────────────────────────

export type TokenKind = "comment" | "keyword" | "string" | "type" | "setting" | "punct" | "plain";
export type Token = { text: string; kind: TokenKind };
export type CodeLine = {
  tokens: Token[];
  /** Table colour for the dot the editor draws after `Table`. */
  dot?: string;
  /** Which column this line declares, so a lit link can point at it. */
  ref?: { table: string; row: number };
  typed?: boolean;
};

const str = (text: string): Token => ({ text, kind: "string" });
const p = (text: string): Token => ({ text, kind: "punct" });

function settingsOf(c: HeroCol): string[] {
  if (c.kind === "pk") return ["primary key", "increment"];
  const s: string[] = [];
  if (c.kind === "uq") s.push("unique");
  if (c.notNull) s.push("not null");
  return s;
}

export function colTokens(c: HeroCol): Token[] {
  const tokens: Token[] = [p("  "), str(`"${c.name}"`), p(" "), { text: c.type, kind: "type" }];
  const settings = settingsOf(c);
  if (settings.length) {
    tokens.push(p(" ["));
    settings.forEach((s, i) => {
      if (i) tokens.push(p(", "));
      tokens.push({ text: s, kind: "setting" });
    });
    tokens.push(p("]"));
  }
  return tokens;
}

/** Cuts a line's tokens to its first `n` characters (for the typing effect). */
export function sliceTokens(tokens: Token[], n: number): Token[] {
  const out: Token[] = [];
  let left = n;
  for (const t of tokens) {
    if (left <= 0) break;
    out.push(t.text.length <= left ? t : { ...t, text: t.text.slice(0, left) });
    left -= t.text.length;
  }
  return out;
}

export const lineLength = (tokens: Token[]) => tokens.reduce((n, t) => n + t.text.length, 0);

/** The DBML for every table; `typed` is how much of the Phone column exists yet (null: none). */
export function buildDbml(typed: number | null): CodeLine[] {
  const lines: CodeLine[] = [
    { tokens: [{ text: "// Generated automatically from your workspace schema", kind: "comment" }] },
    { tokens: [] },
    { tokens: [{ text: "Project", kind: "keyword" }, p(" "), str('"Commerce Platform"'), p(" {")] },
    { tokens: [p("  database_type: "), str("'SQLServer'")] },
    { tokens: [p("}")] },
    { tokens: [] },
  ];
  for (const t of TABLES) {
    lines.push({
      tokens: [{ text: "Table", kind: "keyword" }, p(" "), str(`"${t.schema}"`), p("."), str(`"${t.name}"`), p(" {")],
      dot: t.color,
    });
    t.cols.forEach((c, row) => lines.push({ tokens: colTokens(c), ref: { table: t.id, row } }));
    if (t.id === "customers" && typed !== null) {
      lines.push({ tokens: sliceTokens(colTokens(TYPED_COL), typed), typed: true });
    }
    lines.push({ tokens: [p("}")] }, { tokens: [] });
  }
  for (const l of LINKS) {
    const a = TABLE_BY_ID[l.to.table];
    const b = TABLE_BY_ID[l.from.table];
    lines.push({
      tokens: [
        { text: "Ref", kind: "keyword" },
        p(": "),
        str(`"${a.schema}"."${a.name}"."${a.cols[l.to.row].name}"`),
        p(" > "),
        str(`"${b.schema}"."${b.name}"."${b.cols[l.from.row].name}"`),
      ],
    });
  }
  return lines;
}
