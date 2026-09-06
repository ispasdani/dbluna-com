"use client";

import { useState, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCanvasStore, Table as CanvasTable, TABLE_COLORS } from "@/store/useCanvasStore";
import {
  importSqlSchema,
  dropPlaceholderTables,
  SqlImportError,
  SQL_DIALECTS,
  sqlDialectLabel,
  type SqlDialect,
  type SqlImportIssue,
  type SqlImportResult,
} from "@/lib/parser/sql-import";
import dagre from "@dagrejs/dagre";
import JSZip from "jszip";
import {
  Database,
  FileText,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Check,
  Link2,
  Terminal,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────────────────────── */
/** Every tab the dialog can open on. Callers (the Import menu in TopNavbar)
    pick one so a menu item lands the user straight on the right source. */
export type ImportSchemaTab = "postgresql" | "sqlserver" | "sql" | "csv" | "bacpac";

interface ImportSchemaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tab to show when the dialog opens. Defaults to PostgreSQL. */
  defaultTab?: ImportSchemaTab;
}

type DbEngine = "postgresql" | "sqlserver";

interface DbConnectionForm {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
}

type Status = "idle" | "loading" | "success" | "error";

/* ─────────────────────────────────────────────────────────────────────────────
   Default ports per engine
───────────────────────────────────────────────────────────────────────────── */
const DEFAULT_PORTS: Record<DbEngine, string> = {
  postgresql: "5432",
  sqlserver: "1433",
};

const ENGINE_LABELS: Record<DbEngine, string> = {
  postgresql: "PostgreSQL",
  sqlserver: "SQL Server",
};

/* ─────────────────────────────────────────────────────────────────────────────
   Utility: layout tables with dagre and push to canvas
───────────────────────────────────────────────────────────────────────────── */
function layoutAndImport(tables: CanvasTable[], relationships?: any[]) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", ranksep: 220, nodesep: 80 });
  g.setDefaultEdgeLabel(() => ({}));

  const NODE_WIDTH = 240;

  for (const t of tables) {
    const nodeHeight = 40 + t.columns.length * 26;
    g.setNode(t.id, { width: NODE_WIDTH, height: nodeHeight });
  }

  for (const rel of relationships ?? []) {
    // If it's a legacy map `{sourceId, targetId}` use that, otherwise use `sourceTableId` / `targetTableId`
    g.setEdge(rel.sourceId || rel.sourceTableId, rel.targetId || rel.targetTableId);
  }

  dagre.layout(g);

  const positioned = tables.map((t) => {
    const node = g.node(t.id);
    return { ...t, x: node.x - NODE_WIDTH / 2, y: node.y - node.height / 2 };
  });

  useCanvasStore.setState((s) => {
    const newRelationships = (relationships ?? []).map(r => {
       if (r.sourceTableId) return r; // already a valid store relationship
       return {
         id: crypto.randomUUID(),
         name: "",
         sourceTableId: r.sourceId,
         sourceColumnId: "",
         targetTableId: r.targetId,
         targetColumnId: "",
         cardinality: "One to many",
         onUpdate: "No action",
         onDelete: "No action"
       };
    });

    return { 
      tables: [...s.tables, ...positioned],
      relationships: [...s.relationships, ...newRelationships]
    };
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
   CSV Parser
───────────────────────────────────────────────────────────────────────────── */
function parseCsv(text: string): { headers: string[]; rowCount: number } {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return { headers: [], rowCount: 0 };
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return { headers, rowCount: Math.max(0, lines.length - 1) };
}

/* ─────────────────────────────────────────────────────────────────────────────
   Sub-component: DB Connection Form
───────────────────────────────────────────────────────────────────────────── */
function DbConnectionTab({ engine }: { engine: DbEngine }) {
  const [form, setForm] = useState<DbConnectionForm>({
    host: "localhost",
    port: DEFAULT_PORTS[engine],
    user: "",
    password: "",
    database: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");
  const [preview, setPreview] = useState<{ tableName: string; columns: string[] }[] | null>(null);
  const pendingDataRef = useRef<{
    tables: { name: string; columns: { name: string; type: string; isPk?: boolean; isNotNull?: boolean }[] }[];
    relationships: any[];
  }>({ tables: [], relationships: [] });

  const handleField = (key: keyof DbConnectionForm, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setStatus("idle");
    setMessage("");
    setPreview(null);
  };

  const handleConnect = async () => {
    setStatus("loading");
    setMessage("");
    setPreview(null);

    try {
      const res = await fetch("/api/import-schema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          engine,
          host: form.host,
          port: parseInt(form.port, 10),
          user: form.user,
          password: form.password,
          database: form.database,
        }),
      });
      const result = await res.json();

      if (!result?.success) {
        throw new Error(result?.error ?? "Unknown error");
      }

      // result.tables: Array<{ name: string, columns: Array<{ name, type, isPk, isNotNull }> }>
      const rawTables: {
        name: string;
        columns: { name: string; type: string; isPk?: boolean; isNotNull?: boolean }[];
      }[] = result.tables ?? [];
      const relationships = result.relationships ?? [];

      setPreview(rawTables.map((t) => ({ tableName: t.name, columns: t.columns.map((c) => c.name) })));
      setStatus("success");
      setMessage(`Found ${rawTables.length} table(s) and ${relationships.length} relationship(s).`);

      // Store for import via ref (stable across renders)
      pendingDataRef.current = { tables: rawTables, relationships };
    } catch (err: any) {
      setStatus("error");
      setMessage(err?.message ?? "Connection failed. Check your credentials and try again.");
    }
  };

  const handleImport = () => {
    const { tables: rawTables, relationships } = pendingDataRef.current;

    if (rawTables.length === 0) return;

    const canvasTables: CanvasTable[] = rawTables.map((t, i) => ({
      id: crypto.randomUUID(),
      name: t.name,
      x: 0,
      y: 0,
      color: TABLE_COLORS[i % TABLE_COLORS.length],
      columns: t.columns.map((c) => ({
        id: crypto.randomUUID(),
        name: c.name,
        type: c.type,
        isPrimaryKey: c.isPk ?? false,
        isNotNull: c.isNotNull ?? false,
        isUnique: false,
        isAutoIncrement: false,
      })),
    }));

    const tableMap = new Map(canvasTables.map(t => [t.name, t]));
    const canvasRelationships = relationships
      .map((r: any) => {
        const sTbl = tableMap.get(r.sourceTable);
        const tTbl = tableMap.get(r.targetTable);
        if (!sTbl || !tTbl) return null;
        
        const sCol = sTbl.columns.find(c => c.name === r.sourceCol)?.id || "";
        const tCol = tTbl.columns.find(c => c.name === r.targetCol)?.id || "";

        return {
          id: crypto.randomUUID(),
          name: "",
          sourceTableId: sTbl.id,
          sourceColumnId: sCol,
          targetTableId: tTbl.id,
          targetColumnId: tCol,
          cardinality: "One to many",
          onUpdate: "No action",
          onDelete: "No action"
        };
      })
      .filter(Boolean);

    layoutAndImport(canvasTables, canvasRelationships);
    setStatus("idle");
    setMessage(`✓ Imported ${canvasTables.length} table(s) and ${canvasRelationships.length} relationship(s).`);
    setPreview(null);
    pendingDataRef.current = { tables: [], relationships: [] };
  };

  const isReady = form.host && form.port && form.user && form.database;

  return (
    <div className="flex flex-col gap-5">
      {/* Connection Fields */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 flex gap-3">
          <div className="flex-1 flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Host</Label>
            <Input
              value={form.host}
              onChange={(e) => handleField("host", e.target.value)}
              placeholder="localhost"
              className="h-9 bg-background border-border text-sm"
            />
          </div>
          <div className="w-28 flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Port</Label>
            <Input
              value={form.port}
              onChange={(e) => handleField("port", e.target.value)}
              placeholder={DEFAULT_PORTS[engine]}
              className="h-9 bg-background border-border text-sm"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Username</Label>
          <Input
            value={form.user}
            onChange={(e) => handleField("user", e.target.value)}
            placeholder="root"
            className="h-9 bg-background border-border text-sm"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Password</Label>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(e) => handleField("password", e.target.value)}
              placeholder="••••••••"
              className="h-9 bg-background border-border text-sm pr-9"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="col-span-2 flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">
            Database Name
          </Label>
          <Input
            value={form.database}
            onChange={(e) => handleField("database", e.target.value)}
            placeholder="my_database"
            className="h-9 bg-background border-border text-sm"
          />
        </div>
      </div>

      {/* Status Banner */}
      {message && (
        <div
          className={`flex items-start gap-2.5 rounded-md px-3 py-2.5 text-sm border ${
            status === "success"
              ? "bg-green-500/10 border-green-500/30 text-green-400"
              : status === "error"
              ? "bg-red-500/10 border-red-500/30 text-red-400"
              : "bg-blue-500/10 border-blue-500/30 text-blue-400"
          }`}
        >
          {status === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          ) : status === "error" ? (
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          ) : null}
          <span>{message}</span>
        </div>
      )}

      {/* Preview */}
      {preview && preview.length > 0 && (
        <div className="rounded-md border border-border bg-background/60 overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-sidebar flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Tables Preview
            </span>
            <span className="text-xs text-muted-foreground">{preview.length} tables</span>
          </div>
          <div className="max-h-40 overflow-y-auto divide-y divide-border">
            {preview.map((t) => (
              <div key={t.tableName} className="px-3 py-2 flex items-start gap-2">
                <Database className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-medium text-foreground">{t.tableName}</span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {t.columns.slice(0, 5).join(", ")}
                    {t.columns.length > 5 ? ` +${t.columns.length - 5} more` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-1">
        <Button
          onClick={handleConnect}
          disabled={!isReady || status === "loading"}
          variant="secondary"
          className="flex-1 h-9 gap-2"
        >
          {status === "loading" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Connecting…
            </>
          ) : (
            <>
              <Database className="h-4 w-4" />
              Test &amp; Fetch Schema
            </>
          )}
        </Button>

        <Button
          onClick={handleImport}
          disabled={status !== "success" || !preview?.length}
          className="flex-1 h-9 gap-2 bg-blue-600 hover:bg-blue-500 text-white"
        >
          <Upload className="h-4 w-4" />
          Import to Canvas
        </Button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Sub-component: CSV Import Tab
───────────────────────────────────────────────────────────────────────────── */
function CsvImportTab() {
  const [files, setFiles] = useState<{ name: string; headers: string[]; rowCount: number }[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const fileRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback((fileList: FileList) => {
    const pending: Promise<{ name: string; headers: string[]; rowCount: number }>[] = [];
    for (const f of Array.from(fileList)) {
      if (!f.name.toLowerCase().endsWith(".csv")) continue;
      pending.push(
        f.text().then((text) => {
          const { headers, rowCount } = parseCsv(text);
          return { name: f.name.replace(/\.csv$/i, ""), headers, rowCount };
        })
      );
    }
    Promise.all(pending).then((results) => {
      setFiles((prev) => {
        const existing = new Set(prev.map((p) => p.name));
        return [...prev, ...results.filter((r) => !existing.has(r.name))];
      });
    });
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  };

  const handleRemoveFile = (name: string) => {
    setFiles((f) => f.filter((x) => x.name !== name));
    setStatus("idle");
  };

  const handleImport = () => {
    if (files.length === 0) return;
    setStatus("loading");

    const canvasTables: CanvasTable[] = files.map((f, i) => ({
      id: crypto.randomUUID(),
      name: f.name,
      x: 0,
      y: 0,
      color: TABLE_COLORS[i % TABLE_COLORS.length],
      columns: f.headers.map((h, j) => ({
        id: crypto.randomUUID(),
        name: h,
        type: "VARCHAR",
        isPrimaryKey: j === 0,
        isNotNull: j === 0,
        isUnique: j === 0,
        isAutoIncrement: false,
      })),
    }));

    layoutAndImport(canvasTables);
    setStatus("success");
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed py-10 cursor-pointer transition-all ${
          isDragging
            ? "border-blue-500 bg-blue-500/10"
            : "border-border bg-background/40 hover:border-muted-foreground/50 hover:bg-background/60"
        }`}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/15 border border-blue-500/30">
          <FileText className="h-6 w-6 text-blue-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">Drop CSV files here</p>
          <p className="text-xs text-muted-foreground mt-1">or click to browse — each file becomes a table</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          multiple
          className="sr-only"
          onChange={(e) => e.target.files && processFiles(e.target.files)}
        />
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="rounded-md border border-border bg-background/60 overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-sidebar flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              CSV Files
            </span>
            <span className="text-xs text-muted-foreground">{files.length} file(s)</span>
          </div>
          <div className="max-h-44 overflow-y-auto divide-y divide-border">
            {files.map((f) => (
              <div key={f.name} className="px-3 py-2.5 flex items-center gap-3">
                <FileText className="h-4 w-4 text-blue-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{f.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {f.headers.length} columns · {f.rowCount} rows
                  </p>
                  <p className="text-[11px] text-muted-foreground/70 truncate">
                    {f.headers.slice(0, 6).join(", ")}
                    {f.headers.length > 6 ? ` +${f.headers.length - 6}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => handleRemoveFile(f.name)}
                  className="text-muted-foreground hover:text-red-400 transition-colors text-lg leading-none shrink-0"
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Success Message */}
      {status === "success" && (
        <div className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm bg-green-500/10 border border-green-500/30 text-green-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>Imported {files.length} table(s) to canvas successfully.</span>
        </div>
      )}

      <Button
        onClick={handleImport}
        disabled={files.length === 0 || status === "loading" || status === "success"}
        className="h-9 w-full gap-2 bg-blue-600 hover:bg-blue-500 text-white"
      >
        {status === "loading" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Importing…
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            Import {files.length > 0 ? `${files.length} Table(s)` : ""} to Canvas
          </>
        )}
      </Button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Sub-component: BACPAC Import Tab
───────────────────────────────────────────────────────────────────────────── */
function BacpacImportTab() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  
  const pendingDataRef = useRef<{ tables: any[]; relationships: any[] }>({ tables: [], relationships: [] });
  const [preview, setPreview] = useState<{ tableName: string; columns: string[] }[] | null>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.toLowerCase().endsWith(".bacpac")) {
      setFile(f);
      setStatus("idle");
      setPreview(null);
      setMessage("");
    }
  };

  const handleConnect = async () => {
    if (!file) return;
    setStatus("loading");
    setMessage("");
    setPreview(null);

    try {
      setMessage("Extracting model.xml locally...");
      const zip = new JSZip();
      const loadedZip = await zip.loadAsync(file);
      const xmlFile = loadedZip.file("model.xml");
      
      if (!xmlFile) {
        throw new Error("Could not find model.xml inside this BACPAC file");
      }
      
      // We extract it strictly as a Blob to easily POST to backend
      const xmlBlob = await xmlFile.async("blob");

      setMessage("Parsing database schema...");
      const res = await fetch("/api/import-bacpac", {
        method: "POST",
        headers: { "Content-Type": "text/xml" },
        body: xmlBlob,
      });

      const result = await res.json();
      if (!result?.success) {
        throw new Error(result?.error ?? "Unknown error");
      }

      const rawTables = result.tables ?? [];
      const relationships = result.relationships ?? [];

      setPreview(rawTables.map((t: any) => ({ tableName: t.name, columns: t.columns.map((c: any) => c.name) })));
      setStatus("success");
      setMessage(`Found ${rawTables.length} table(s) and ${relationships.length} relationship(s).`);

      pendingDataRef.current = { tables: rawTables, relationships };
    } catch (err: any) {
      setStatus("error");
      setMessage(err?.message ?? "Failed to parse BACPAC. Check the file and try again.");
    }
  };

  const handleImport = () => {
    const { tables: rawTables, relationships } = pendingDataRef.current;
    if (rawTables.length === 0) return;

    const canvasTables: CanvasTable[] = rawTables.map((t: any, i: number) => ({
      id: crypto.randomUUID(),
      name: t.name,
      x: 0,
      y: 0,
      color: TABLE_COLORS[i % TABLE_COLORS.length],
      columns: t.columns.map((c: any) => ({
        id: crypto.randomUUID(),
        name: c.name,
        type: c.type || "VARCHAR",
        isPrimaryKey: c.isPk ?? false,
        isNotNull: c.isNotNull ?? false,
        isUnique: false,
        isAutoIncrement: false,
      })),
    }));

    const tableMap = new Map(canvasTables.map(t => [t.name, t]));
    const canvasRelationships = relationships
      .map((r: any) => {
        const sTbl = tableMap.get(r.sourceTable);
        const tTbl = tableMap.get(r.targetTable);
        if (!sTbl || !tTbl) return null;
        
        const sCol = sTbl.columns.find(c => c.name === r.sourceCol)?.id || "";
        const tCol = tTbl.columns.find(c => c.name === r.targetCol)?.id || "";

        return {
          id: crypto.randomUUID(),
          name: "",
          sourceTableId: sTbl.id,
          sourceColumnId: sCol,
          targetTableId: tTbl.id,
          targetColumnId: tCol,
          cardinality: "One to many",
          onUpdate: "No action",
          onDelete: "No action"
        };
      })
      .filter(Boolean);

    layoutAndImport(canvasTables, canvasRelationships);
    
    setStatus("idle");
    setMessage(`✓ Imported ${canvasTables.length} table(s) and ${canvasRelationships.length} relationship(s).`);
    setPreview(null);
    pendingDataRef.current = { tables: [], relationships: [] };
    setFile(null);
  };

  return (
    <div className="flex flex-col gap-5">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed py-10 cursor-pointer transition-all ${
          isDragging
            ? "border-indigo-500 bg-indigo-500/10"
            : "border-border bg-background/40 hover:border-muted-foreground/50 hover:bg-background/60"
        }`}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/15 border border-indigo-500/30">
          <Database className="h-6 w-6 text-indigo-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">{file ? file.name : "Drop a .bacpac file here"}</p>
          <p className="text-xs text-muted-foreground mt-1">{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "or click to select your SQL Server schema export"}</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".bacpac"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              setFile(f);
              setStatus("idle");
              setPreview(null);
              setMessage("");
            }
          }}
        />
      </div>

      {message && (
        <div
          className={`flex items-start gap-2.5 rounded-md px-3 py-2.5 text-sm border ${
            status === "success"
              ? "bg-green-500/10 border-green-500/30 text-green-400"
              : status === "error"
              ? "bg-red-500/10 border-red-500/30 text-red-400"
              : "bg-blue-500/10 border-blue-500/30 text-blue-400"
          }`}
        >
          {status === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          ) : status === "error" ? (
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          ) : null}
          <span>{message}</span>
        </div>
      )}

      {preview && preview.length > 0 && (
        <div className="rounded-md border border-border bg-background/60 overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-sidebar flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Tables Preview
            </span>
            <span className="text-xs text-muted-foreground">{preview.length} tables</span>
          </div>
          <div className="max-h-40 overflow-y-auto divide-y divide-border">
            {preview.map((t) => (
              <div key={t.tableName} className="px-3 py-2 flex items-start gap-2">
                <Database className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-medium text-foreground">{t.tableName}</span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {t.columns.slice(0, 5).join(", ")}
                    {t.columns.length > 5 ? ` +${t.columns.length - 5} more` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <Button
          onClick={handleConnect}
          disabled={!file || status === "loading"}
          variant="secondary"
          className="flex-1 h-9 gap-2"
        >
          {status === "loading" ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Parsing…</>
          ) : (
            <><Database className="h-4 w-4" /> Parse Schema</>
          )}
        </Button>
        <Button
          onClick={handleImport}
          disabled={status !== "success" || !preview?.length}
          className="flex-1 h-9 gap-2 bg-indigo-600 hover:bg-indigo-500 text-white"
        >
          <Upload className="h-4 w-4" />
          Import to Canvas
        </Button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Sub-component: SQL script (paste / drop a .sql file)
───────────────────────────────────────────────────────────────────────────── */

/** Small inline checkbox — the design system has no checkbox primitive yet. */
function CheckToggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-start gap-2.5 text-left group"
    >
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
          checked
            ? "bg-blue-600 border-blue-600 text-white"
            : "border-border bg-background group-hover:border-muted-foreground/60"
        }`}
      >
        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span>
        <span className="text-xs text-foreground">{label}</span>
        {hint && <span className="block text-[11px] text-muted-foreground mt-0.5">{hint}</span>}
      </span>
    </button>
  );
}

function SqlScriptImportTab() {
  const [sql, setSql] = useState("");
  const [dialect, setDialect] = useState<SqlDialect | "auto">("auto");
  const [includePlaceholders, setIncludePlaceholders] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [issues, setIssues] = useState<SqlImportIssue[]>([]);
  const [parsed, setParsed] = useState<SqlImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Any edit invalidates the parse below it, so the Import button can never act
  // on a result that no longer matches what's in the box.
  const resetParse = () => {
    setParsed(null);
    setStatus("idle");
    setMessage("");
    setIssues([]);
  };

  const handleSqlChange = (value: string) => {
    setSql(value);
    resetParse();
  };

  const handleDialectChange = (value: string) => {
    setDialect(value as SqlDialect | "auto");
    resetParse();
  };

  const loadFile = async (file: File) => {
    handleSqlChange(await file.text());
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void loadFile(file);
  };

  const handleParse = () => {
    setStatus("loading");
    setMessage("");
    setIssues([]);
    setParsed(null);

    // Parsing a few hundred tables is CPU-bound and synchronous; yield a frame
    // first so the button actually renders its spinner.
    setTimeout(() => {
      try {
        // The success summary is derived from `parsed` below rather than stored,
        // so the counts follow the placeholder toggle instead of freezing here.
        setParsed(importSqlSchema(sql, { dialect }));
        setStatus("success");
      } catch (err) {
        setStatus("error");
        if (err instanceof SqlImportError) {
          setMessage(err.message);
          setIssues(err.issues);
        } else {
          setMessage(err instanceof Error ? err.message : "Could not parse this SQL script.");
        }
      }
    }, 0);
  };

  const handleImport = () => {
    if (!selection) return;
    layoutAndImport(selection.tables, selection.relationships);

    setStatus("idle");
    setMessage(
      `✓ Imported ${selection.tables.length} table(s) and ${selection.relationships.length} relationship(s).`
    );
    setParsed(null);
    setSql("");
  };

  const placeholderCount = parsed?.placeholderTableIds.length ?? 0;
  const placeholderIds = new Set(parsed?.placeholderTableIds ?? []);
  // What the buttons below act on: the parse, minus the placeholders if they're
  // switched off. Recomputed on every render so the toggle stays live.
  const selection = parsed && !includePlaceholders ? dropPlaceholderTables(parsed) : parsed;
  const preview = selection?.tables ?? [];
  const banner = selection
    ? `Found ${selection.tables.length} table(s) and ${selection.relationships.length} relationship(s)` +
      (selection.autoDetected ? ` — read as ${sqlDialectLabel(selection.dialect)}.` : ".")
    : message;

  return (
    <div className="flex flex-col gap-4">
      {/* Dialect picker */}
      <div className="flex items-center gap-3">
        <Label className="text-xs text-muted-foreground shrink-0">Dialect</Label>
        <Select value={dialect} onValueChange={handleDialectChange}>
          <SelectTrigger className="h-9 flex-1 bg-background border-border text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto-detect</SelectItem>
            {SQL_DIALECTS.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Script box — paste, or drop a .sql file onto it */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className="relative"
      >
        <Textarea
          value={sql}
          onChange={(e) => handleSqlChange(e.target.value)}
          spellCheck={false}
          placeholder={"CREATE TABLE users (\n  id BIGINT PRIMARY KEY,\n  email VARCHAR(255) NOT NULL\n);"}
          // `field-sizing-fixed` overrides the Textarea default, which would
          // otherwise grow the box to the full height of a long dump.
          className={`h-64 resize-y font-mono text-[11px] leading-relaxed rounded-md field-sizing-fixed bg-background ${
            isDragging ? "border-blue-500 ring-1 ring-blue-500" : "border-border"
          }`}
        />
        {isDragging && (
          <div className="absolute inset-0 flex items-center justify-center rounded-md bg-blue-500/10 pointer-events-none">
            <span className="text-xs font-medium text-blue-400">Drop .sql file to load</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          {sql.trim()
            ? `${sql.split(/\r?\n/).length} lines · ${(new Blob([sql]).size / 1024).toFixed(1)} KB`
            : "Paste your CREATE TABLE statements, or drop a .sql file here."}
        </span>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="text-blue-400 hover:text-blue-300 transition-colors"
        >
          Load .sql file
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".sql,.ddl,.txt"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void loadFile(file);
            // Allow re-picking the same file after an edit.
            e.target.value = "";
          }}
        />
      </div>

      {/* Placeholder toggle — only meaningful once we know the script has dangling FKs */}
      {placeholderCount > 0 && (
        <div className="rounded-md border border-border bg-background/60 px-3 py-2.5">
          <CheckToggle
            checked={includePlaceholders}
            onChange={setIncludePlaceholders}
            label={`Add ${placeholderCount} placeholder table(s) for external references`}
            hint="This script has foreign keys pointing at tables it doesn't define. Keep them to see those relationships on the canvas, or leave them out to import only what's in the script."
          />
        </div>
      )}

      {/* Status banner */}
      {banner && (
        <div
          className={`flex items-start gap-2.5 rounded-md px-3 py-2.5 text-sm border ${
            status === "success"
              ? "bg-green-500/10 border-green-500/30 text-green-400"
              : status === "error"
              ? "bg-red-500/10 border-red-500/30 text-red-400"
              : "bg-blue-500/10 border-blue-500/30 text-blue-400"
          }`}
        >
          {status === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          ) : status === "error" ? (
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          ) : null}
          <div className="min-w-0">
            <span>{banner}</span>
            {issues.length > 0 && (
              <ul className="mt-1.5 space-y-0.5 font-mono text-[11px] text-red-300/80">
                {issues.slice(0, 5).map((issue, i) => (
                  <li key={i} className="truncate">
                    {issue.line ? `Line ${issue.line}: ` : ""}
                    {issue.message}
                  </li>
                ))}
              </ul>
            )}
            {status === "error" && dialect === "auto" && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Try picking the dialect explicitly above.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Preview */}
      {preview.length > 0 && (
        <div className="rounded-md border border-border bg-background/60 overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-sidebar flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Tables Preview
            </span>
            <span className="text-xs text-muted-foreground">{preview.length} tables</span>
          </div>
          <div className="max-h-44 overflow-y-auto divide-y divide-border">
            {preview.map((t) => (
              <div key={t.id} className="px-3 py-2 flex items-start gap-2">
                {placeholderIds.has(t.id) ? (
                  <Link2 className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <Database className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <span className="text-xs font-medium text-foreground">{t.name}</span>
                  {placeholderIds.has(t.id) && (
                    <span className="ml-2 text-[10px] uppercase tracking-wider text-amber-400">
                      placeholder
                    </span>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                    {t.columns
                      .slice(0, 5)
                      .map((c) => c.name)
                      .join(", ")}
                    {t.columns.length > 5 ? ` +${t.columns.length - 5} more` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 pt-1">
        <Button
          onClick={handleParse}
          disabled={!sql.trim() || status === "loading"}
          variant="secondary"
          className="flex-1 h-9 gap-2"
        >
          {status === "loading" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Parsing…
            </>
          ) : (
            <>
              <Terminal className="h-4 w-4" />
              Parse Script
            </>
          )}
        </Button>
        <Button
          onClick={handleImport}
          disabled={preview.length === 0}
          className="flex-1 h-9 gap-2 bg-blue-600 hover:bg-blue-500 text-white"
        >
          <Upload className="h-4 w-4" />
          Import to Canvas
        </Button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Engine icon badge
───────────────────────────────────────────────────────────────────────────── */
function EngineBadge({ engine }: { engine: DbEngine }) {
  const colors: Record<DbEngine, string> = {
    postgresql: "text-sky-400",
    sqlserver: "text-indigo-400",
  };
  return (
    <span className={`font-semibold text-[11px] uppercase tracking-wider ${colors[engine]}`}>
      {ENGINE_LABELS[engine]}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Main Dialog
───────────────────────────────────────────────────────────────────────────── */
export function ImportSchemaDialog({
  open,
  onOpenChange,
  defaultTab = "postgresql",
}: ImportSchemaDialogProps) {
  // Controlled rather than `defaultValue` so reopening from a different menu
  // item lands on that item's tab instead of whichever one was last viewed.
  const [tab, setTab] = useState<ImportSchemaTab>(defaultTab);
  const [wasOpen, setWasOpen] = useState(open);

  // Adjust-state-during-render rather than an effect: resets the tab on each
  // closed→open transition, so picking "Import from CSV" always lands on CSV
  // even if the user last switched tabs by hand inside the dialog.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setTab(defaultTab);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] bg-sidebar border-border text-foreground p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/15 border border-blue-500/30">
              <Database className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground leading-tight">
                Import Schema
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Connect to a database, paste a SQL script, or upload a file to generate
                tables on canvas.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5">
          <Tabs value={tab} onValueChange={(v) => setTab(v as ImportSchemaTab)}>
            <TabsList className="mb-5 h-9 w-full grid grid-cols-5 bg-background border border-border rounded-lg p-0.5">
              {(["postgresql", "sqlserver"] as DbEngine[]).map((engine) => (
                <TabsTrigger
                  key={engine}
                  value={engine}
                  className="text-[11px] font-semibold uppercase tracking-wide data-[state=active]:bg-sidebar data-[state=active]:shadow-sm rounded h-8"
                >
                  {ENGINE_LABELS[engine]}
                </TabsTrigger>
              ))}
              <TabsTrigger
                value="sql"
                className="text-[11px] font-semibold uppercase tracking-wide data-[state=active]:bg-sidebar data-[state=active]:shadow-sm rounded h-8"
              >
                SQL
              </TabsTrigger>
              <TabsTrigger
                value="csv"
                className="text-[11px] font-semibold uppercase tracking-wide data-[state=active]:bg-sidebar data-[state=active]:shadow-sm rounded h-8"
              >
                CSV
              </TabsTrigger>
              <TabsTrigger
                value="bacpac"
                className="text-[11px] font-semibold uppercase tracking-wide data-[state=active]:bg-sidebar data-[state=active]:shadow-sm rounded h-8"
              >
                BACPAC
              </TabsTrigger>
            </TabsList>

            {(["postgresql", "sqlserver"] as DbEngine[]).map((engine) => (
              <TabsContent key={engine} value={engine} className="mt-0 focus-visible:outline-none">
                <div className="mb-4 flex items-center gap-2">
                  <div className="h-px flex-1 bg-border" />
                  <EngineBadge engine={engine} />
                  <div className="h-px flex-1 bg-border" />
                </div>
                <DbConnectionTab engine={engine} />
              </TabsContent>
            ))}

            <TabsContent value="sql" className="mt-0 focus-visible:outline-none">
              <div className="mb-4 flex items-center gap-2">
                <div className="h-px flex-1 bg-border" />
                <span className="font-semibold text-[11px] uppercase tracking-wider text-blue-400">
                  SQL Script
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <SqlScriptImportTab />
            </TabsContent>

            <TabsContent value="csv" className="mt-0 focus-visible:outline-none">
              <div className="mb-4 flex items-center gap-2">
                <div className="h-px flex-1 bg-border" />
                <span className="font-semibold text-[11px] uppercase tracking-wider text-emerald-400">CSV</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <CsvImportTab />
            </TabsContent>

            <TabsContent value="bacpac" className="mt-0 focus-visible:outline-none">
              <div className="mb-4 flex items-center gap-2">
                <div className="h-px flex-1 bg-border" />
                <span className="font-semibold text-[11px] uppercase tracking-wider text-indigo-500">BACPAC</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <BacpacImportTab />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
