import { NextRequest, NextResponse } from "next/server";

type Engine = "postgresql" | "sqlserver";

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

interface Relationship {
  sourceTable: string;
  sourceCol: string;
  targetTable: string;
  targetCol: string;
}

// ─── PostgreSQL ───────────────────────────────────────────────────────────────
async function fetchPostgresSchema(body: ImportSchemaBody): Promise<{ tables: TableInfo[], relationships: Relationship[] }> {
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
    const tables = groupColumns(
      rows.map((r: any) => ({
        table_name: r.table_name,
        column_name: r.column_name,
        data_type: r.data_type,
        is_nullable: r.is_nullable === "YES" ? "YES" : "NO",
        is_pk: r.is_pk ? 1 : 0,
      }))
    );

    const relRes = await client.query(
      `SELECT
          tc.table_name AS source_table,
          kcu.column_name AS source_col,
          ccu.table_name AS target_table,
          ccu.column_name AS target_col
       FROM information_schema.table_constraints AS tc
       JOIN information_schema.key_column_usage AS kcu
         ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
       JOIN information_schema.constraint_column_usage AS ccu
         ON ccu.constraint_name = tc.constraint_name
         AND ccu.table_schema = tc.table_schema
       WHERE tc.constraint_type = 'FOREIGN KEY'
         AND tc.table_schema = $1`,
       [body.database === "public" ? "public" : "public"]
    );

    const relationships: Relationship[] = relRes.rows.map((r: any) => ({
      sourceTable: r.source_table,
      sourceCol: r.source_col,
      targetTable: r.target_table,
      targetCol: r.target_col,
    }));

    return { tables, relationships };
  } finally {
    await client.end();
  }
}

// ─── SQL Server ───────────────────────────────────────────────────────────────
async function fetchSqlServerSchema(body: ImportSchemaBody): Promise<{ tables: TableInfo[], relationships: Relationship[] }> {
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
    
    const tables = groupColumns(
      recordset.map((r: any) => ({
        table_name: `[${r.schema_name}].[${r.table_name}]`,
        column_name: r.column_name,
        data_type: r.data_type,
        is_nullable: r.is_nullable ? "YES" : "NO",
        is_pk: r.is_pk ? 1 : 0,
      }))
    );

    const relRes = await pool.request().query(`
      SELECT 
          s1.name AS source_schema,
          t1.name AS source_table,
          c1.name AS source_col,
          s2.name AS target_schema,
          t2.name AS target_table,
          c2.name AS target_col
      FROM sys.foreign_keys fk
      JOIN sys.tables t1 ON fk.parent_object_id = t1.object_id
      JOIN sys.schemas s1 ON t1.schema_id = s1.schema_id
      JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
      JOIN sys.columns c1 ON fkc.parent_object_id = c1.object_id AND fkc.parent_column_id = c1.column_id
      JOIN sys.tables t2 ON fk.referenced_object_id = t2.object_id
      JOIN sys.schemas s2 ON t2.schema_id = s2.schema_id
      JOIN sys.columns c2 ON fkc.referenced_object_id = c2.object_id AND fkc.referenced_column_id = c2.column_id
    `);

    const relationships: Relationship[] = relRes.recordset.map((r: any) => ({
      sourceTable: `[${r.source_schema}].[${r.source_table}]`,
      sourceCol: r.source_col,
      targetTable: `[${r.target_schema}].[${r.target_table}]`,
      targetCol: r.target_col,
    }));

    return { tables, relationships };
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
    let result: { tables: TableInfo[], relationships: Relationship[] };
    if (engine === "postgresql") {
      result = await fetchPostgresSchema(body);
    } else if (engine === "sqlserver") {
      result = await fetchSqlServerSchema(body);
    } else {
      return NextResponse.json({ success: false, error: `Unsupported engine: ${engine}` }, { status: 400 });
    }
    return NextResponse.json({ success: true, tables: result.tables, relationships: result.relationships });
  } catch (err: any) {
    const msg: string = err?.message ?? String(err);
    // Friendly message for missing native drivers
    if (msg.includes("Cannot find module")) {
      const pkg = engine === "sqlserver" ? "mssql" : "pg";
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
