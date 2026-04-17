import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";
import sax from "sax";

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

/**
 * Extracts table and column name from a full BACPAC element name
 * [dbo].[Users].[Id] -> table: [dbo].[Users], column: [Id]
 */
function extractTableAndColumn(fullName: string) {
  if (!fullName) return null;
  const lastDot = fullName.lastIndexOf("].[");
  if (lastDot === -1) return { table: fullName, column: fullName };
  const tablePart = fullName.substring(0, lastDot + 1);
  const columnPart = fullName.substring(lastDot + 2);
  return { table: tablePart, column: columnPart };
}

export async function POST(req: NextRequest) {
  if (!req.body) {
    return NextResponse.json({ success: false, error: "No XML body provided" }, { status: 400 });
  }

  try {
    const tables = new Map<string, TableInfo>();
    const relationships: Relationship[] = [];
    const pkSet = new Set<string>(); 

    let saxError: Error | null = null;

    await new Promise<void>((resolve, reject) => {
      const saxStream = sax.createStream(true, { trim: true });
      
      let isPk = false;
      let isFk = false;
      let isTypeRel = false;
      let colContext: string | null = null;
      let fkSourceTable: string | null = null;
      let fkTargetTable: string | null = null;
      let fkSourceCol: string | null = null;
      let fkTargetCol: string | null = null;
      let currentFkStep = 0;

      saxStream.on("error", (e) => {
          saxError = e;
          reject(e);
      });

      saxStream.on("opentag", (node: any) => {
        if (node.name === "Element" && node.attributes?.Type === "SqlSimpleColumn") {
          const name = node.attributes.Name;
          colContext = name;
          if (name) {
            const parts = extractTableAndColumn(name);
            if (parts) {
              let tbl = tables.get(parts.table);
              if (!tbl) {
                tbl = { name: parts.table, columns: [] };
                tables.set(parts.table, tbl);
              }
              if (!tbl.columns.find((c) => c.name === parts.column)) {
                tbl.columns.push({ name: parts.column, type: "VARCHAR", isPk: false, isNotNull: false });
              }
            }
          }
        }

        if (node.name === "Property" && node.attributes?.Name === "IsNullable" && node.attributes?.Value === "False") {
            if (colContext) {
              const parts = extractTableAndColumn(colContext);
              if (parts) {
                  const tbl = tables.get(parts.table);
                  const col = tbl?.columns.find(c => c.name === parts.column);
                  if (col) col.isNotNull = true;
              }
            }
        }

        if (node.name === "Element" && node.attributes?.Type === "SqlPrimaryKeyConstraint") {
            isPk = true;
        }

        if (node.name === "Element" && node.attributes?.Type === "SqlForeignKeyConstraint") {
            isFk = true;
            currentFkStep = 0;
            const fkName = node.attributes.Name;
            if (fkName) {
              const parts = extractTableAndColumn(fkName);
            }
        }

        if (isFk && node.name === "Relationship" && node.attributes?.Name === "Columns") {
            currentFkStep = 1;
        }
        if (isFk && node.name === "Relationship" && node.attributes?.Name === "ForeignTable") {
            currentFkStep = 2;
        }
        if (node.name === "Relationship" && node.attributes?.Name === "Type") {
            isTypeRel = true;
        }

        if (node.name === "References") {
            if (isPk) {
              pkSet.add(node.attributes.Name);
            }
            if (isFk && currentFkStep === 1) {
              const pkRef = node.attributes.Name;
              const parts = extractTableAndColumn(pkRef);
              if (parts) { 
                fkSourceTable = parts.table;
                fkSourceCol = parts.column;
              }
            }
            if (isFk && currentFkStep === 2) {
              const parts = extractTableAndColumn(node.attributes.Name);
              if (parts) {
                  fkTargetTable = parts.table;
                  fkTargetCol = parts.column;
              }
            }
            if (colContext && isTypeRel) {
              const typeName = node.attributes?.Name;
              if (typeName) {
                  const parts = extractTableAndColumn(colContext);
                  if (parts) {
                    const tbl = tables.get(parts.table);
                    const col = tbl?.columns.find(c => c.name === parts.column);
                    if (col) col.type = typeName.replace(/[\[\]]/g, '').toUpperCase();
                  }
              }
            }
        }
      });

      saxStream.on("closetag", (nodeName) => {
        if (nodeName === "Element") {
            colContext = null;
            if (isPk) isPk = false;
            if (isFk) {
                isFk = false;
                if (fkSourceTable && fkTargetTable && fkSourceCol && fkTargetCol) {
                  relationships.push({ sourceTable: fkSourceTable, sourceCol: fkSourceCol, targetTable: fkTargetTable, targetCol: fkTargetCol });
                }
                fkSourceTable = null;
                fkTargetTable = null;
                fkSourceCol = null;
                fkTargetCol = null;
            }
          }
          if (nodeName === "Relationship") {
            isTypeRel = false;
            currentFkStep = 0;
          }
      });

      saxStream.on("end", () => {
        for (const pkCol of pkSet) {
            const parts = extractTableAndColumn(pkCol);
            if (parts) {
              const tbl = tables.get(parts.table);
              const col = tbl?.columns.find(c => c.name === parts.column);
              if (col) col.isPk = true;
            }
        }
        resolve();
      });

      const nodeStream = Readable.fromWeb(req.body as any);
      nodeStream.pipe(saxStream);
    });

    if (saxError) throw saxError;

    const _tablesArray = Array.from(tables.values());
    return NextResponse.json({ success: true, tables: _tablesArray, relationships });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 500 });
  }
}
