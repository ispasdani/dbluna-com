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
import { useCanvasStore, Table as CanvasTable, TABLE_COLORS } from "@/store/useCanvasStore";
import dagre from "@dagrejs/dagre";
import {
  Database,
  FileText,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────────────────────── */
interface ImportSchemaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type DbEngine = "mysql" | "postgresql" | "oracle" | "sqlserver";

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
  mysql: "3306",
  postgresql: "5432",
  oracle: "1521",
  sqlserver: "1433",
};

const ENGINE_LABELS: Record<DbEngine, string> = {
  mysql: "MySQL",
  postgresql: "PostgreSQL",
  oracle: "Oracle SQL",
  sqlserver: "SQL Server",
};

/* ─────────────────────────────────────────────────────────────────────────────
   Utility: layout tables with dagre and push to canvas
───────────────────────────────────────────────────────────────────────────── */
function layoutAndImport(tables: CanvasTable[], relationships?: { sourceId: string; targetId: string }[]) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", ranksep: 220, nodesep: 80 });
  g.setDefaultEdgeLabel(() => ({}));

  const NODE_WIDTH = 240;

  for (const t of tables) {
    const nodeHeight = 40 + t.columns.length * 26;
    g.setNode(t.id, { width: NODE_WIDTH, height: nodeHeight });
  }

  for (const rel of relationships ?? []) {
    g.setEdge(rel.sourceId, rel.targetId);
  }

  dagre.layout(g);

  const positioned = tables.map((t) => {
    const node = g.node(t.id);
    return { ...t, x: node.x - NODE_WIDTH / 2, y: node.y - node.height / 2 };
  });

  useCanvasStore.setState((s) => ({ tables: [...s.tables, ...positioned] }));
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
  const pendingTablesRef = useRef<{name: string; columns: {name: string; type: string; isPk?: boolean; isNotNull?: boolean}[]}[]>([]);

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
      // In Electron, delegate to the main process. In browser, call the proxy API.
      const isElectron = typeof window !== "undefined" && (window as any).electron;

      let result: any;
      if (isElectron && (window as any).electron.importSchema) {
        result = await (window as any).electron.importSchema({
          engine,
          host: form.host,
          port: parseInt(form.port, 10),
          user: form.user,
          password: form.password,
          database: form.database,
        });
      } else {
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
        result = await res.json();
      }

      if (!result?.success) {
        throw new Error(result?.error ?? "Unknown error");
      }

      // result.tables: Array<{ name: string, columns: Array<{ name, type, isPk, isNotNull }> }>
      const rawTables: {
        name: string;
        columns: { name: string; type: string; isPk?: boolean; isNotNull?: boolean }[];
      }[] = result.tables ?? [];

      setPreview(rawTables.map((t) => ({ tableName: t.name, columns: t.columns.map((c) => c.name) })));
      setStatus("success");
      setMessage(`Found ${rawTables.length} table(s). Click "Import to Canvas" to add them.`);

      // Store for import via ref (stable across renders)
      pendingTablesRef.current = rawTables;
    } catch (err: any) {
      setStatus("error");
      setMessage(err?.message ?? "Connection failed. Check your credentials and try again.");
    }
  };

  const handleImport = () => {
    const rawTables = pendingTablesRef.current;

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

    layoutAndImport(canvasTables);
    setStatus("idle");
    setMessage(`✓ Imported ${canvasTables.length} table(s) to canvas.`);
    setPreview(null);
    pendingTablesRef.current = [];
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
   Engine icon badge
───────────────────────────────────────────────────────────────────────────── */
function EngineBadge({ engine }: { engine: DbEngine }) {
  const colors: Record<DbEngine, string> = {
    mysql: "text-orange-400",
    postgresql: "text-sky-400",
    oracle: "text-red-500",
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
export function ImportSchemaDialog({ open, onOpenChange }: ImportSchemaDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] bg-sidebar border-border text-foreground p-0 overflow-hidden flex flex-col max-h-[90vh]">
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
                Connect to a database or upload a CSV to generate tables on canvas.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5">
          <Tabs defaultValue="mysql">
            <TabsList className="mb-5 h-9 w-full grid grid-cols-4 bg-background border border-border rounded-lg p-0.5">
              {(["mysql", "postgresql", "sqlserver"] as DbEngine[]).map((engine) => (
                <TabsTrigger
                  key={engine}
                  value={engine}
                  className="text-[11px] font-semibold uppercase tracking-wide data-[state=active]:bg-sidebar data-[state=active]:shadow-sm rounded h-8"
                >
                  {ENGINE_LABELS[engine]}
                </TabsTrigger>
              ))}
              <TabsTrigger
                value="csv"
                className="text-[11px] font-semibold uppercase tracking-wide data-[state=active]:bg-sidebar data-[state=active]:shadow-sm rounded h-8"
              >
                CSV
              </TabsTrigger>
            </TabsList>

            {(["mysql", "postgresql", "sqlserver"] as DbEngine[]).map((engine) => (
              <TabsContent key={engine} value={engine} className="mt-0 focus-visible:outline-none">
                <div className="mb-4 flex items-center gap-2">
                  <div className="h-px flex-1 bg-border" />
                  <EngineBadge engine={engine} />
                  <div className="h-px flex-1 bg-border" />
                </div>
                <DbConnectionTab engine={engine} />
              </TabsContent>
            ))}

            <TabsContent value="csv" className="mt-0 focus-visible:outline-none">
              <div className="mb-4 flex items-center gap-2">
                <div className="h-px flex-1 bg-border" />
                <span className="font-semibold text-[11px] uppercase tracking-wider text-emerald-400">CSV</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <CsvImportTab />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
