"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";
import { useCanvasStore } from "@/store/useCanvasStore";
import { Parser } from "@dbml/core";

// Custom theme extension to use CSS variables
const themeExtension = EditorView.theme({
  "&": {
    backgroundColor: "var(--dock-bg)",
    color: "var(--foreground)",
    height: "100%",
  },
  ".cm-content": {
    caretColor: "var(--primary)",
  },
  ".cm-gutters": {
    backgroundColor: "var(--dock-header)",
    color: "var(--muted-foreground)",
    borderRight: "1px solid var(--border)",
  },
  ".cm-activeLine": {
    backgroundColor: "var(--accent)", // or a slight opacity version
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--accent)",
  },
  // Syntax highlighting overrides (basic mapping)
  // Note: For full control, we'd use a HighlightStyle, but this maps base colors
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "var(--primary)",
  },
  "&.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: "var(--primary)",
    opacity: 0.3,
  },
});

// Helper to debounce function calls
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
  const debouncedCode = useDebounce(code, 1000); // 1s debounce for parsing
  const isTypingRef = useRef(false);

  // 1. Canvas -> Code (One-way init or update)
  // We only update the code from canvas if the user is NOT typing in the editor
  useEffect(() => {
    if (isTypingRef.current) return;

    try {
      // Convert current store tables to DBML
      // We need to construct a "Database" object that @dbml/core expects or manually build the string
      // Manually building simple DBML is safer than mocking the entire @dbml/core Database structure for export
      // But let's try to use the library if possible.
      // Actually, building a string is much easier and robust for this simple sync.
      
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
      
      // Only update if significantly different to avoid cursor jumps if we were syncing real-time
      // But here we rely on isTypingRef for coarse locking
      setCode(newCode);
      
    } catch (err) {
      console.error("Failed to generate DBML", err);
    }
  }, [tables]);

  // 2. Code -> Canvas (Parse and Sync)
  useEffect(() => {
    if (!debouncedCode) return;

    try {
      // Parse DBML
      const database = Parser.parse(debouncedCode, "dbml");
      const schema = database.schemas[0]; // Default schema
      
      // Map DBML tables to our store Tables
      // We need to merge with existing tables to PRESERVE X, Y, Color
      
      const newTables = schema.tables.map((dbTable: any) => {
        const existingTable = tables.find(t => t.name === dbTable.name);
        
        // Map columns
        const newColumns = dbTable.fields.map((field: any) => {
           // Try to match existing column ID if possible to preserve anything extra? 
           // Currently we don't have extra col metadata, but good practice.
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
          x: existingTable?.x || Math.random() * 500, // naive placement for new tables
          y: existingTable?.y || Math.random() * 500,
          color: existingTable?.color || "#6366f1",
          columns: newColumns
        };
      });

      // Update store
      // Note: This replaces the list. Tables removed from code are removed from canvas.
      setTables(newTables);
      
      // Reset typing flag after successful sync
      isTypingRef.current = false;
      
    } catch (e) {
      // Parser error - invalid code, just ignore until valid
      // console.warn("DBML Parse error", e);
    }
  }, [debouncedCode, setTables]); // Don't include 'tables' here to avoid loop!

  const handleChange = useCallback((val: string) => {
    isTypingRef.current = true;
    setCode(val);
  }, []);

  return (
    <div className="h-full w-full bg-dock-bg text-foreground flex flex-col">
       <div className="flex-none p-2 bg-dock-header text-xs text-muted-foreground border-b border-border font-mono">
         main.dbml
       </div>
       <div className="flex-1 overflow-auto">
          <CodeMirror
            value={code}
            height="100%"
            theme={themeExtension} 
            extensions={[sql()]} 
            onChange={handleChange}
            className="text-[13px] h-full"
            basicSetup={{
              drawSelection: false, // handled by CSS
            }}
          />
       </div>
    </div>
  );
}
