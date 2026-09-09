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
import { cn } from "@/lib/utils";
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
  Server,
  FileSpreadsheet,
  FileArchive,
  Upload,
  CheckCircle2,
  AlertCircle,
  Info,
  Loader2,
  Eye,
  EyeOff,
  Check,
  Link2,
  Terminal,
  X,
  type LucideIcon,
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

/** The source rail, in the order it reads down the left edge of the dialog.
    `blurb` doubles as the dialog's description, so the header explains
    whichever source is selected instead of describing all five at once. */
const SOURCES: { id: ImportSchemaTab; label: string; icon: LucideIcon; blurb: string }[] = [
  {
    id: "postgresql",
    label: "PostgreSQL",
    icon: Database,
    blurb: "Connect to a live PostgreSQL database and pull its tables and foreign keys.",
  },
  {
    id: "sqlserver",
    label: "SQL Server",
    icon: Server,
    blurb: "Connect to a live SQL Server database and pull its tables and foreign keys.",
  },
  {
    id: "sql",
    label: "SQL Script",
    icon: Terminal,
    blurb: "Paste CREATE TABLE statements, or drop a .sql file, and parse it onto the canvas.",
  },
  {
    id: "csv",
    label: "CSV",
    icon: FileSpreadsheet,
    blurb: "Drop one or more CSV files — each file becomes a table, each header a column.",
  },
  {
    id: "bacpac",
    label: "BACPAC",
    icon: FileArchive,
    blurb: "Upload a SQL Server .bacpac export and read its schema from model.xml.",
  },
];

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
   Shared presentation
   Every source tab is the same shape — a scrolling body over a pinned action
   bar. The accent is deliberately monochrome: `foreground` on `background`
   reads as black-on-white in the light palettes and white-on-black in the dark
   ones, so the dialog stays neutral instead of picking up the palette's hue.
   Only the semantic colours — destructive, success, placeholder — keep a tint.
───────────────────────────────────────────────────────────────────────────── */

/** The monochrome primary action, shared by all four import buttons. */
const IMPORT_ACTION = "gap-2 bg-foreground text-background hover:bg-foreground/85";

/** Scrolling body + the action bar that stays pinned to the bottom edge. */
function TabShell({
  children,
  actions,
}: {
  children: React.ReactNode;
  actions: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <div className="flex flex-col gap-4">{children}</div>
      </div>
      <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-sidebar px-5 py-3 sm:flex-row sm:items-center sm:justify-end">
        {actions}
      </div>
    </div>
  );
}

/** Uppercase micro-label used above inputs and on section headers. */
function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

/** Connection / parse feedback. `idle` carries plain informational copy. */
function StatusBanner({
  status,
  message,
  children,
}: {
  status: Status;
  message: string;
  children?: React.ReactNode;
}) {
  const tone =
    status === "success" ? "success" : status === "error" ? "error" : "info";
  const Icon = tone === "success" ? CheckCircle2 : tone === "error" ? AlertCircle : Info;

  return (
    <div
      className={cn(
        "flex items-start gap-2 border px-3 py-2.5 text-xs",
        tone === "success" && "border-emerald-500/40 bg-emerald-500/10 text-foreground",
        tone === "error" && "border-destructive/40 bg-destructive/10 text-destructive",
        tone === "info" && "border-border bg-muted text-muted-foreground"
      )}
    >
      <Icon
        className={cn(
          "mt-px size-3.5 shrink-0",
          tone === "success" && "text-emerald-500"
        )}
      />
      <div className="min-w-0 leading-relaxed">
        <span>{message}</span>
        {children}
      </div>
    </div>
  );
}

/** Bordered list with a header strip — used for table previews and file lists. */
function ResultPanel({
  title,
  meta,
  children,
}: {
  title: string;
  meta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-muted px-3 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {title}
        </span>
        <span className="text-[10px] tabular-nums text-muted-foreground">{meta}</span>
      </div>
      <div className="max-h-44 divide-y divide-border overflow-y-auto">{children}</div>
    </div>
  );
}

/** One table in a preview list: name, an optional badge, and a column summary. */
function ResultRow({
  icon: Icon = Database,
  iconClassName,
  name,
  badge,
  detail,
  action,
}: {
  icon?: LucideIcon;
  iconClassName?: string;
  name: string;
  badge?: string;
  detail: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 px-3 py-2">
      <Icon className={cn("mt-0.5 size-3.5 shrink-0 text-muted-foreground", iconClassName)} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-xs font-medium text-foreground">{name}</span>
          {badge && (
            <span className="shrink-0 border border-amber-500/50 bg-amber-500/15 px-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-foreground">
              {badge}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{detail}</p>
      </div>
      {action}
    </div>
  );
}

/** Dashed drop target shared by the CSV and BACPAC tabs. */
function DropZone({
  icon: Icon,
  title,
  subtitle,
  isDragging,
  onClick,
  onDragOver,
  onDragLeave,
  onDrop,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  isDragging: boolean;
  onClick: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed px-4 py-9 text-center outline-none transition-colors",
        "focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50",
        isDragging
          ? "border-foreground bg-foreground/5"
          : "border-border bg-muted/40 hover:border-foreground/40 hover:bg-muted"
      )}
    >
      <span className="flex size-10 items-center justify-center border border-border bg-background text-foreground">
        <Icon className="size-5" />
      </span>
      <p className="text-xs font-medium text-foreground">{title}</p>
      <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      {children}
    </div>
  );
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
    // Keep `success` rather than dropping to `idle`: the preview is cleared on
    // the next line, so both buttons disable themselves anyway, and the banner
    // reads as a confirmation instead of a neutral note.
    setStatus("success");
    setMessage(`Imported ${canvasTables.length} table(s) and ${canvasRelationships.length} relationship(s).`);
    setPreview(null);
    pendingDataRef.current = { tables: [], relationships: [] };
  };

  const isReady = form.host && form.port && form.user && form.database;

  return (
    <TabShell
      actions={
        <>
          <Button
            onClick={handleConnect}
            disabled={!isReady || status === "loading"}
            variant="outline"
            size="lg"
            className="gap-2"
          >
            {status === "loading" ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Connecting…
              </>
            ) : (
              <>
                <Database className="size-3.5" />
                Test &amp; fetch schema
              </>
            )}
          </Button>

          <Button
            onClick={handleImport}
            disabled={status !== "success" || !preview?.length}
            size="lg"
            className={IMPORT_ACTION}
          >
            <Upload className="size-3.5" />
            Import to canvas
          </Button>
        </>
      }
    >
      {/* Connection fields */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-3.5">
        <Field label="Host" className="col-span-2 sm:col-span-1">
          <Input
            value={form.host}
            onChange={(e) => handleField("host", e.target.value)}
            placeholder="localhost"
          />
        </Field>

        <Field label="Port" className="col-span-2 sm:col-span-1">
          <Input
            value={form.port}
            onChange={(e) => handleField("port", e.target.value)}
            placeholder={DEFAULT_PORTS[engine]}
            className="tabular-nums"
          />
        </Field>

        <Field label="Username" className="col-span-2 sm:col-span-1">
          <Input
            value={form.user}
            onChange={(e) => handleField("user", e.target.value)}
            placeholder="root"
          />
        </Field>

        <Field label="Password" className="col-span-2 sm:col-span-1">
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(e) => handleField("password", e.target.value)}
              placeholder="••••••••"
              className="pr-8"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            >
              {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
          </div>
        </Field>

        <Field label="Database name" className="col-span-2">
          <Input
            value={form.database}
            onChange={(e) => handleField("database", e.target.value)}
            placeholder="my_database"
          />
        </Field>
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Credentials are sent to your own server to read the schema and are never stored.
      </p>

      {message && <StatusBanner status={status} message={message} />}

      {preview && preview.length > 0 && (
        <ResultPanel title="Tables found" meta={`${preview.length} tables`}>
          {preview.map((t) => (
            <ResultRow
              key={t.tableName}
              name={t.tableName}
              detail={
                <>
                  {t.columns.slice(0, 5).join(", ")}
                  {t.columns.length > 5 ? ` +${t.columns.length - 5} more` : ""}
                </>
              }
            />
          ))}
        </ResultPanel>
      )}
    </TabShell>
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
    <TabShell
      actions={
        <Button
          onClick={handleImport}
          disabled={files.length === 0 || status === "loading" || status === "success"}
          size="lg"
          className={IMPORT_ACTION}
        >
          {status === "loading" ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Importing…
            </>
          ) : (
            <>
              <Upload className="size-3.5" />
              Import {files.length > 0 ? `${files.length} table(s)` : ""} to canvas
            </>
          )}
        </Button>
      }
    >
      <DropZone
        icon={FileSpreadsheet}
        title="Drop CSV files here"
        subtitle="or click to browse — each file becomes a table"
        isDragging={isDragging}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          multiple
          className="sr-only"
          onChange={(e) => e.target.files && processFiles(e.target.files)}
        />
      </DropZone>

      {files.length > 0 && (
        <ResultPanel title="CSV files" meta={`${files.length} file(s)`}>
          {files.map((f) => (
            <ResultRow
              key={f.name}
              icon={FileSpreadsheet}
              name={f.name}
              detail={
                <>
                  {f.headers.length} columns · {f.rowCount} rows ·{" "}
                  {f.headers.slice(0, 5).join(", ")}
                  {f.headers.length > 5 ? ` +${f.headers.length - 5}` : ""}
                </>
              }
              action={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => handleRemoveFile(f.name)}
                  aria-label={`Remove ${f.name}`}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <X />
                </Button>
              }
            />
          ))}
        </ResultPanel>
      )}

      {status === "success" && (
        <StatusBanner
          status="success"
          message={`Imported ${files.length} table(s) to the canvas.`}
        />
      )}
    </TabShell>
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

    // Same as the DB tab: the preview is cleared below, so keeping `success`
    // only affects the banner's tone, not what the buttons allow.
    setStatus("success");
    setMessage(`Imported ${canvasTables.length} table(s) and ${canvasRelationships.length} relationship(s).`);
    setPreview(null);
    pendingDataRef.current = { tables: [], relationships: [] };
    setFile(null);
  };

  return (
    <TabShell
      actions={
        <>
          <Button
            onClick={handleConnect}
            disabled={!file || status === "loading"}
            variant="outline"
            size="lg"
            className="gap-2"
          >
            {status === "loading" ? (
              <>
                <Loader2 className="size-3.5 animate-spin" /> Parsing…
              </>
            ) : (
              <>
                <FileArchive className="size-3.5" /> Parse schema
              </>
            )}
          </Button>
          <Button
            onClick={handleImport}
            disabled={status !== "success" || !preview?.length}
            size="lg"
            className={IMPORT_ACTION}
          >
            <Upload className="size-3.5" />
            Import to canvas
          </Button>
        </>
      }
    >
      <DropZone
        icon={FileArchive}
        title={file ? file.name : "Drop a .bacpac file here"}
        subtitle={
          file
            ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
            : "or click to select your SQL Server schema export"
        }
        isDragging={isDragging}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
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
      </DropZone>

      {message && <StatusBanner status={status} message={message} />}

      {preview && preview.length > 0 && (
        <ResultPanel title="Tables found" meta={`${preview.length} tables`}>
          {preview.map((t) => (
            <ResultRow
              key={t.tableName}
              name={t.tableName}
              detail={
                <>
                  {t.columns.slice(0, 5).join(", ")}
                  {t.columns.length > 5 ? ` +${t.columns.length - 5} more` : ""}
                </>
              }
            />
          ))}
        </ResultPanel>
      )}
    </TabShell>
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
      className="group flex items-start gap-2.5 text-left"
    >
      <span
        className={cn(
          "mt-px flex size-4 shrink-0 items-center justify-center border transition-colors",
          checked
            ? "border-foreground bg-foreground text-background"
            : "border-input bg-background group-hover:border-ring"
        )}
      >
        {checked && <Check className="size-3" strokeWidth={3} />}
      </span>
      <span className="min-w-0">
        <span className="text-xs text-foreground">{label}</span>
        {hint && (
          <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
            {hint}
          </span>
        )}
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

    setStatus("success");
    setMessage(
      `Imported ${selection.tables.length} table(s) and ${selection.relationships.length} relationship(s).`
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
    <TabShell
      actions={
        <>
          <Button
            onClick={handleParse}
            disabled={!sql.trim() || status === "loading"}
            variant="outline"
            size="lg"
            className="gap-2"
          >
            {status === "loading" ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Parsing…
              </>
            ) : (
              <>
                <Terminal className="size-3.5" />
                Parse script
              </>
            )}
          </Button>
          <Button
            onClick={handleImport}
            disabled={preview.length === 0}
            size="lg"
            className={IMPORT_ACTION}
          >
            <Upload className="size-3.5" />
            Import to canvas
          </Button>
        </>
      }
    >
      {/* Dialect picker */}
      <Field label="Dialect">
        <Select value={dialect} onValueChange={handleDialectChange}>
          <SelectTrigger className="w-full">
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
      </Field>

      {/* Script box — paste, or drop a .sql file onto it */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Script
          </Label>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="text-[11px] font-medium text-foreground underline underline-offset-2 decoration-foreground/30 transition-colors hover:decoration-foreground"
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
            className={cn(
              "h-56 resize-y bg-background font-mono text-[11px] leading-relaxed field-sizing-fixed",
              isDragging && "border-foreground ring-1 ring-foreground"
            )}
          />
          {isDragging && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-foreground/5">
              <span className="border border-foreground bg-foreground px-2 py-1 text-[11px] font-medium text-background">
                Drop .sql file to load
              </span>
            </div>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground">
          {sql.trim()
            ? `${sql.split(/\r?\n/).length} lines · ${(new Blob([sql]).size / 1024).toFixed(1)} KB`
            : "Paste your CREATE TABLE statements, or drop a .sql file here."}
        </p>
      </div>

      {/* Placeholder toggle — only meaningful once we know the script has dangling FKs */}
      {placeholderCount > 0 && (
        <div className="border border-border bg-muted/40 px-3 py-2.5">
          <CheckToggle
            checked={includePlaceholders}
            onChange={setIncludePlaceholders}
            label={`Add ${placeholderCount} placeholder table(s) for external references`}
            hint="This script has foreign keys pointing at tables it doesn't define. Keep them to see those relationships on the canvas, or leave them out to import only what's in the script."
          />
        </div>
      )}

      {banner && (
        <StatusBanner status={status} message={banner}>
          {issues.length > 0 && (
            <ul className="mt-1.5 space-y-0.5 font-mono text-[11px] opacity-80">
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
        </StatusBanner>
      )}

      {preview.length > 0 && (
        <ResultPanel title="Tables found" meta={`${preview.length} tables`}>
          {preview.map((t) => {
            const isPlaceholder = placeholderIds.has(t.id);
            return (
              <ResultRow
                key={t.id}
                icon={isPlaceholder ? Link2 : Database}
                iconClassName={isPlaceholder ? "text-amber-500" : undefined}
                name={t.name}
                badge={isPlaceholder ? "placeholder" : undefined}
                detail={
                  <>
                    {t.columns
                      .slice(0, 5)
                      .map((c) => c.name)
                      .join(", ")}
                    {t.columns.length > 5 ? ` +${t.columns.length - 5} more` : ""}
                  </>
                }
              />
            );
          })}
        </ResultPanel>
      )}
    </TabShell>
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

  const active = SOURCES.find((s) => s.id === tab) ?? SOURCES[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 gap-0 border-b border-border bg-sidebar px-5 py-3.5">
          <div className="flex items-center gap-3 pr-8">
            <span className="flex size-8 shrink-0 items-center justify-center bg-foreground text-background">
              <Upload className="size-4" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-sm font-semibold leading-tight text-foreground">
                Import schema
              </DialogTitle>
              {/* The blurb follows the rail selection, so the header always
                  describes the source the user is actually looking at. */}
              <DialogDescription className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                {active.blurb}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Vertical rail instead of five cramped top tabs: the sources have
            unequal weight (two live connections, three file formats) and read
            better as a list, and it leaves the full width for each form. */}
        <Tabs
          orientation="vertical"
          value={tab}
          onValueChange={(v) => setTab(v as ImportSchemaTab)}
          className="flex min-h-0 flex-1 items-stretch gap-0"
        >
          <div className="flex w-13 shrink-0 flex-col border-r border-border bg-sidebar p-1.5 sm:w-52">
            <TabsList className="h-auto w-full flex-col items-stretch justify-start gap-0.5 bg-transparent p-0">
              {SOURCES.map(({ id, label, icon: Icon }) => (
                <TabsTrigger
                  key={id}
                  value={id}
                  title={label}
                  className={cn(
                    "h-auto min-h-9 flex-none justify-center gap-2.5 px-0 py-2 text-xs sm:justify-start sm:px-2.5",
                    "data-active:bg-background data-active:font-medium data-active:text-foreground",
                    "data-active:shadow-[inset_2px_0_0_var(--foreground)]"
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="hidden truncate sm:inline">{label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            {(["postgresql", "sqlserver"] as DbEngine[]).map((engine) => (
              <TabsContent key={engine} value={engine} className="min-h-0 flex-1">
                <DbConnectionTab engine={engine} />
              </TabsContent>
            ))}

            <TabsContent value="sql" className="min-h-0 flex-1">
              <SqlScriptImportTab />
            </TabsContent>

            <TabsContent value="csv" className="min-h-0 flex-1">
              <CsvImportTab />
            </TabsContent>

            <TabsContent value="bacpac" className="min-h-0 flex-1">
              <BacpacImportTab />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
