import { NextRequest, NextResponse } from "next/server";

type Engine = "mysql" | "postgresql" | "sqlserver";

interface ImportSchemaBody {
  engine: Engine;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

interface ColumnInfo {
  name: string;
  type: string;
  isPk: boolean;
  isNotNull: boolean;
}

interface TableInfo {
  name: string;
  columns: ColumnInfo[];
}

// ─── MySQL ────────────────────────────────────────────────────────────────────
async function fetchMysqlSchema(body: ImportSchemaBody): Promise<TableInfo[]> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mysql = require("mysql2/promise");
  // Node.js resolves "localhost" to ::1 (IPv6) first on modern systems; MySQL
  // typically only listens on 127.0.0.1 (IPv4), causing ECONNREFUSED. Force IPv4.
  const host = body.host === "localhost" ? "127.0.0.1" : body.host;
  const conn = await mysql.createConnection({
    host,
    port: body.port,
    user: body.user,
    password: body.password,
    database: body.database,
    connectTimeout: 8000,
  });

  try {
    const [cols]: any[] = await conn.execute(
      `SELECT
         c.TABLE_NAME         AS table_name,
         c.COLUMN_NAME        AS column_name,
         c.DATA_TYPE          AS data_type,
         c.IS_NULLABLE        AS is_nullable,
         IF(kcu.COLUMN_NAME IS NOT NULL, 1, 0) AS is_pk
       FROM INFORMATION_SCHEMA.COLUMNS c
       LEFT JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
         ON kcu.TABLE_SCHEMA = c.TABLE_SCHEMA
        AND kcu.TABLE_NAME   = c.TABLE_NAME
        AND kcu.COLUMN_NAME  = c.COLUMN_NAME
        AND kcu.CONSTRAINT_NAME = 'PRIMARY'
       WHERE c.TABLE_SCHEMA = ?
       ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION`,
      [body.database]
    );
    return groupColumns(cols);
  } finally {
    await conn.end();
  }
}

// ─── PostgreSQL ───────────────────────────────────────────────────────────────
async function fetchPostgresSchema(body: ImportSchemaBody): Promise<TableInfo[]> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Client } = require("pg");
  const client = new Client({
    host: body.host,
    port: body.port,
    user: body.user,
    password: body.password,
    database: body.database,
    connectionTimeoutMillis: 8000,
  });
  await client.connect();

  try {
    const { rows } = await client.query(
      `SELECT
         c.table_name,
         c.column_name,
         c.udt_name          AS data_type,
         c.is_nullable,
         CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END AS is_pk
       FROM information_schema.columns c
       LEFT JOIN (
         SELECT kcu.table_name, kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema     = kcu.table_schema
         WHERE tc.constraint_type = 'PRIMARY KEY'
           AND tc.table_schema    = $1
       ) pk ON pk.table_name = c.table_name AND pk.column_name = c.column_name
       WHERE c.table_schema = $1
         AND c.table_name NOT LIKE 'pg_%'
       ORDER BY c.table_name, c.ordinal_position`,
      [body.database === "public" ? "public" : "public"]
    );
    return groupColumns(
      rows.map((r: any) => ({
        table_name: r.table_name,
        column_name: r.column_name,
        data_type: r.data_type,
        is_nullable: r.is_nullable === "YES" ? "YES" : "NO",
        is_pk: r.is_pk ? 1 : 0,
      }))
    );
  } finally {
    await client.end();
  }
}

// ─── SQL Server ───────────────────────────────────────────────────────────────
async function fetchSqlServerSchema(body: ImportSchemaBody): Promise<TableInfo[]> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sql = require("mssql");
  
  const config = {
    user: body.user,
    password: body.password,
    server: body.host,
    port: body.port,
    database: body.database,
    options: {
      encrypt: false, // For local dev
      trustServerCertificate: true,
      connectTimeout: 8000,
    }
  };

  const pool = await sql.connect(config);
  try {
    const { recordset } = await pool.request().query(`
      SELECT 
          s.name AS schema_name,
          t.name AS table_name,
          c.name AS column_name,
          ty.name AS data_type,
          c.is_nullable,
          CAST(ISNULL(ic.index_id, 0) AS BIT) AS is_pk
      FROM sys.tables t
      JOIN sys.schemas s ON t.schema_id = s.schema_id
      JOIN sys.columns c ON t.object_id = c.object_id
      JOIN sys.types ty ON c.user_type_id = ty.user_type_id
      LEFT JOIN sys.index_columns ic ON ic.object_id = c.object_id AND ic.column_id = c.column_id AND ic.index_id = 1
      WHERE t.is_ms_shipped = 0
    `);
    
    return groupColumns(
      recordset.map((r: any) => ({
        table_name: `[${r.schema_name}].[${r.table_name}]`,
        column_name: r.column_name,
        data_type: r.data_type,
        is_nullable: r.is_nullable ? "YES" : "NO",
        is_pk: r.is_pk ? 1 : 0,
      }))
    );
  } finally {
    await pool.close();
  }
}

// ─── Shared column grouper ────────────────────────────────────────────────────
function groupColumns(
  rows: { table_name: string; column_name: string; data_type: string; is_nullable: string; is_pk: number | boolean }[]
): TableInfo[] {
  const map = new Map<string, TableInfo>();
  for (const row of rows) {
    if (!map.has(row.table_name)) {
      map.set(row.table_name, { name: row.table_name, columns: [] });
    }
    map.get(row.table_name)!.columns.push({
      name: row.column_name,
      type: row.data_type.toUpperCase(),
      isPk: Boolean(row.is_pk),
      isNotNull: row.is_nullable === "NO",
    });
  }
  return Array.from(map.values());
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: ImportSchemaBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const { engine } = body;

  try {
    let tables: TableInfo[];
    if (engine === "mysql") {
      tables = await fetchMysqlSchema(body);
    } else if (engine === "postgresql") {
      tables = await fetchPostgresSchema(body);
    } else if (engine === "sqlserver") {
      tables = await fetchSqlServerSchema(body);
    } else {
      return NextResponse.json({ success: false, error: `Unsupported engine: ${engine}` }, { status: 400 });
    }
    return NextResponse.json({ success: true, tables });
  } catch (err: any) {
    const msg: string = err?.message ?? String(err);
    // Friendly message for missing native drivers
    if (msg.includes("Cannot find module")) {
      const pkg = engine === "mysql" ? "mysql2" : engine === "sqlserver" ? "mssql" : "pg";
      return NextResponse.json(
        {
          success: false,
          error: `Driver package "${pkg}" is not installed. Run: npm install ${pkg}`,
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
