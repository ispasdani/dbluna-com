"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";
import { useCanvasStore } from "@/store/useCanvasStore";
import { Parser } from "@dbml/core";
import { Copy, Download, FileCode, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";

// Custom theme extension to use CSS variables
const themeExtension = EditorView.theme({
  "&": {
    backgroundColor: "var(--dock-bg)",
    color: "var(--foreground)",
    height: "100%",
    fontSize: "13px",
    fontFamily: "var(--font-mono)",
  },
  ".cm-content": {
    caretColor: "var(--primary)",
    fontFamily: "var(--font-mono)",
  },
  ".cm-gutters": {
    backgroundColor: "var(--dock-header)", // Slightly different to separate
    color: "var(--muted-foreground)",
    borderRight: "1px solid var(--border)",
  },
  ".cm-activeLine": {
    backgroundColor: "color-mix(in srgb, var(--accent) 50%, transparent)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--accent)",
    color: "var(--foreground)",
  },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "var(--primary)",
  },
  "&.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: "color-mix(in srgb, var(--primary) 20%, transparent)",
  },
  ".cm-line": {
    fontFamily: "var(--font-mono)",
  }
});

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export function CodeEditor() {
  const { tables, setTables } = useCanvasStore();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const debouncedCode = useDebounce(code, 800);
  const isTypingRef = useRef(false);

  // 1. Canvas -> Code (One-way init or update)
  useEffect(() => {
    if (isTypingRef.current) return;

    try {
      const parts = tables.map((table) => {
        const cols = table.columns.map((col) => {
          const props = [];
          if (col.isPrimaryKey) props.push("pk");
          if (col.isUnique) props.push("unique");
          if (col.isNotNull) props.push("not null");
          if (col.isAutoIncrement) props.push("increment");

          const propsStr = props.length ? ` [${props.join(", ")}]` : "";
          return `  ${col.name} ${col.type}${propsStr}`;
        });

        return `Table ${table.name} {\n${cols.join("\n")}\n}`;
      });

      const newCode = parts.join("\n\n");
      setCode(newCode);
      setError(null); // Clear errors on fresh sync
    } catch (err) {
      console.error("Failed to generate DBML", err);
    }
  }, [tables]);

  // 2. Code -> Canvas (Parse and Sync)
  useEffect(() => {
    if (!debouncedCode) {
      setError(null);
      return;
    }

    try {
      const database = Parser.parse(debouncedCode, "dbml");
      const schema = database.schemas[0];

      const newTables = schema.tables.map((dbTable: any) => {
        const existingTable = tables.find(t => t.name === dbTable.name);

        const newColumns = dbTable.fields.map((field: any) => {
          const existingCol = existingTable?.columns.find(c => c.name === field.name);
          return {
            id: existingCol?.id || crypto.randomUUID(),
            name: field.name,
            type: field.type.type_name.toUpperCase(),
            isPrimaryKey: field.pk || false,
            isNotNull: field.not_null || false,
            isUnique: field.unique || false,
            isAutoIncrement: field.increment || false,
          };
        });

        return {
          id: existingTable?.id || crypto.randomUUID(),
          name: dbTable.name,
          x: existingTable?.x || Math.random() * 500,
          y: existingTable?.y || Math.random() * 500,
          color: existingTable?.color || "#6366f1", // fallback color
          columns: newColumns
        };
      });

      setTables(newTables);
      setError(null);
      isTypingRef.current = false;

    } catch (e: any) {
      // Capture the error message
      // DBML parser errors usually have location data, but for now we just show the message
      const msg = e.message || "Syntax error in DBML";
      setError(msg);
    }
  }, [debouncedCode, setTables]); // Exclude 'tables'

  const handleChange = useCallback((val: string) => {
    isTypingRef.current = true;
    setCode(val);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "schema.dbml";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full w-full bg-dock-bg text-foreground flex flex-col relative group">
      {/* Toolbar */}
      <div className="flex-none h-10 px-3 flex items-center justify-between border-b border-border bg-dock-header select-none">
        <div className="flex items-center gap-2 text-muted-foreground">
          <FileCode className="w-4 h-4" />
          <span className="text-xs font-mono">schema.dbml</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1.5 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-colors"
            title="Copy to Clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={handleDownload}
            className="p-1.5 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-colors"
            title="Download DBML"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-auto relative">
        <CodeMirror
          value={code}
          height="100%"
          theme={themeExtension}
          extensions={[sql()]}
          onChange={handleChange}
          className="h-full text-[13px]"
          basicSetup={{
            drawSelection: false,
            lineNumbers: true,
            foldGutter: true,
          }}
        />
      </div>

      {/* Error Bar - Floating at bottom */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-4 left-4 right-4 bg-destructive/10 border border-destructive/20 text-destructive px-3 py-2 rounded-md shadow-lg backdrop-blur-sm z-10 flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 flex-none" />
            <div className="text-xs font-medium font-mono break-all">{error}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
