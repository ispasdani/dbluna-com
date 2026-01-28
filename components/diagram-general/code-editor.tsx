"use client";

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";
import { json } from "@codemirror/lang-json";
import { useCanvasStore } from "@/store/useCanvasStore";
import { Parser } from "@dbml/core";
import { Copy, Download, FileCode, Check, AlertCircle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { linter, lintGutter, Diagnostic } from "@codemirror/lint";
import { tablesToJSON, jsonToTables, tablesToMermaid } from "@/lib/converters";

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
  },
  ".cm-tooltip-lint": {
    backgroundColor: "var(--popover) !important",
    color: "var(--popover-foreground) !important",
    border: "1px solid var(--border) !important",
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

export type EditorLanguage = "dbml" | "json" | "mermaid";

export function CodeEditor() {
  const { tables, setTables } = useCanvasStore();
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState<EditorLanguage>("dbml");
  const [copied, setCopied] = useState(false);

  const debouncedCode = useDebounce(code, 800);
  const isTypingRef = useRef(false);

  // Custom Linter (Only for DBML currently)
  const dbmlLinterSource = useCallback((view: EditorView): Diagnostic[] => {
    if (language !== "dbml") return [];

    const doc = view.state.doc;
    const currentCode = doc.toString();

    // If empty, no errors
    if (!currentCode.trim()) return [];

    try {
      Parser.parse(currentCode, "dbml");
      return [];
    } catch (err: any) {
      // Handle DBML Parser errors which are returned as an object with a 'diags' array
      if (err.diags && Array.isArray(err.diags)) {
        return err.diags.map((d: any) => {
          const from = d.location.start.offset;
          const to = d.location.end.offset;
          return {
            from,
            to: Math.max(to, from + 1), // Ensure at least 1 char width
            severity: "error",
            message: d.message,
            source: "DBML Parser"
          };
        });
      }

      // Fallback for simple errors that might have location directly (legacy or different error types)
      if (err.location) {
        try {
          const from = err.location.start.offset;
          const to = err.location.end.offset;
          return [{
            from,
            to,
            severity: "error",
            message: err.message || "Syntax Error",
            source: "DBML Parser"
          }];
        } catch (e) { return [] }
      }

      return [];
    }
  }, [language]);

  // 1. Canvas -> Code (One-way init or update)
  useEffect(() => {
    if (isTypingRef.current) return;

    try {
      if (language === "json") {
        setCode(tablesToJSON(tables));
      } else if (language === "mermaid") {
        setCode(tablesToMermaid(tables));
      } else {
        // DBML (Default)
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
      }
    } catch (err) {
      console.error("Failed to generate code", err);
    }
  }, [tables, language]);

  // 2. Code -> Canvas (Parse and Sync)
  useEffect(() => {
    if (!debouncedCode) {
      return;
    }

    try {
      if (language === "json") {
        const newTables = jsonToTables(debouncedCode);
        // Basic validation succeeded if no throw
        setTables(newTables);
        return;
      }

      if (language === "mermaid") {
        // Mermaid is currently one-way (read-only for canvas sync)
        return;
      }

      // DBML Parsing
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
      isTypingRef.current = false;

    } catch (e: any) {
      // Errors are handled by the linter or ignored for now
    }
  }, [debouncedCode, setTables, language]); // Exclude 'tables' to avoid loops, but language change triggers re-parse? No, language change triggers Code gen first.

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
    let mimeType = "text/plain";
    if (language === "json") mimeType = "application/json";

    const blob = new Blob([code], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `schema.${language}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Extensions array memoized
  const extensions = useMemo(() => {
    const exts = [
      lintGutter(),
      linter(dbmlLinterSource)
    ];

    if (language === "json") {
      exts.push(json());
    } else {
      // Default / DBML uses SQL highlighting
      exts.push(sql());
    }
    return exts;
  }, [dbmlLinterSource, language]);

  return (
    <div className="h-full w-full bg-dock-bg text-foreground flex flex-col relative group">
      {/* Toolbar */}
      <div className="flex-none h-10 px-3 flex items-center justify-between border-b border-border bg-dock-header select-none">
        <div className="flex items-center gap-2 text-muted-foreground relative">
          <FileCode className="w-4 h-4" />
          <div className="relative flex items-center">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as EditorLanguage)}
              className="bg-transparent text-xs font-mono outline-none cursor-pointer appearance-none pr-5 hover:text-foreground transition-colors"
            >
              <option value="dbml" className="bg-dock-bg text-foreground">schema.dbml</option>
              <option value="json" className="bg-dock-bg text-foreground">schema.json</option>
              <option value="mermaid" className="bg-dock-bg text-foreground">schema.mermaid</option>
            </select>
            <ChevronDown className="w-3 h-3 absolute right-0 pointer-events-none opacity-70" />
          </div>
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
            title={`Download ${language.toUpperCase()}`}
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
          extensions={extensions}
          onChange={handleChange}
          className="h-full text-[13px]"
          basicSetup={{
            drawSelection: false,
            lineNumbers: true,
            foldGutter: true,
            lintKeymap: true, // Enable linting keymap
          }}
        />
      </div>
    </div>
  );
}
