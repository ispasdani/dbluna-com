"use client";

import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from "react";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";
import { json } from "@codemirror/lang-json";
import { useCanvasStore } from "@/store/useCanvasStore";
import { useEditorStore } from "@/store/useEditorStore";
import { Parser } from "@dbml/core";
import {
  AlertCircle,
  Check,
  Copy,
  Download,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { linter, lintGutter, Diagnostic } from "@codemirror/lint";
import { tablesToJSON, jsonToTables, tablesToMermaid } from "@/lib/converters";
import { generateDbmlFromCanvas } from "@/lib/generator/dbml-generator";
import {
  parseDbml,
  parsedTablesToCanvasTables,
  parsedToCanvasSchemaMeta,
  parsedRefsToCanvasRelationships,
} from "@/lib/parser/dsl-parser";
import { dbmlCodeMirrorTheme } from "@/lib/codemirror/dbml-theme";
import { tableColorDots } from "@/lib/codemirror/table-color-dots";
import { usePanelStyleStore } from "@/store/usePanelStyleStore";
import { useUpgradeToastStore } from "@/store/useUpgradeToastStore";
import { useCapabilities } from "./capabilities-context";
import styles from "./code-editor.module.scss";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export type EditorLanguage = "dbml" | "json" | "mermaid";

const FORMATS: { id: EditorLanguage; label: string }[] = [
  { id: "dbml", label: "DBML" },
  { id: "json", label: "JSON" },
  { id: "mermaid", label: "Mermaid" },
];

/** A parse problem in the editor. `from` is absent when the parser gives no position. */
interface Problem {
  message: string;
  from?: number;
  to?: number;
  line?: number;
  col?: number;
}

interface DbmlPos {
  offset: number;
  line: number;
  column: number;
}
interface DbmlDiag {
  message?: string;
  location?: { start?: DbmlPos; end?: DbmlPos };
}

/**
 * DBML parse errors with their positions. Shared by the inline linter and the
 * problems list, so the squiggles and the list always agree.
 */
function dbmlProblems(code: string): Problem[] {
  if (!code.trim()) return [];
  try {
    Parser.parse(code, "dbml");
    return [];
  } catch (caught) {
    // The DBML parser reports an object with a `diags` array; older error
    // shapes carry a single `location` instead.
    const err = caught as DbmlDiag & { diags?: DbmlDiag[] };
    const diags: DbmlDiag[] = Array.isArray(err?.diags)
      ? err.diags
      : err?.location
        ? [err]
        : [];
    if (diags.length === 0)
      return [{ message: err?.message || "Syntax error" }];
    return diags.map((d) => {
      const start = d.location?.start;
      const end = d.location?.end;
      return {
        message: d.message || "Syntax error",
        from: start?.offset,
        to: end?.offset,
        line: start?.line,
        col: start?.column,
      };
    });
  }
}

interface CodeEditorProps {
  readOnly?: boolean;
}

export function CodeEditor({ readOnly = false }: CodeEditorProps) {
  const {
    tables,
    relationships,
    enums,
    tableGroups,
    project,
    setTables,
    setRelationships,
    setEnums,
    setTableGroups,
    setProject,
  } = useCanvasStore();
  const { tableCap } = useCapabilities();
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState<EditorLanguage>("dbml");
  const [copied, setCopied] = useState(false);
  // Set when a parsed edit would push the table count past the plan cap — the
  // edit is not committed to the store, but the typed text is kept so nothing
  // is lost. See free-tier-code-only-editing-plan.md §3.
  const [capError, setCapError] = useState<string | null>(null);

  const debouncedCode = useDebounce(code, 400);
  const isTypingRef = useRef(false);
  const viewRef = useRef<EditorView | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  // Mirrors isTypingRef for rendering: true from a keystroke until the edit
  // reaches the canvas, so the status bar can say "Syncing…" only for the
  // user's own edits (canvas-driven regeneration also changes `code`).
  const [isTyping, setIsTyping] = useState(false);
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const codeFont = usePanelStyleStore((s) => s.codeFont);

  // Inline squiggles (DBML only), from the same source as the problems list.
  const dbmlLinterSource = useCallback(
    (view: EditorView): Diagnostic[] => {
      if (language !== "dbml") return [];
      return dbmlProblems(view.state.doc.toString())
        .filter((p) => p.from !== undefined)
        .map((p) => ({
          from: p.from!,
          to: Math.max(p.to ?? p.from!, p.from! + 1), // Ensure at least 1 char width
          severity: "error",
          message: p.message,
          source: "DBML Parser",
        }));
    },
    [language],
  );

  // 1. Canvas -> Code (One-way init or update)
  useEffect(() => {
    if (isTypingRef.current) return;
    // Generated code is always valid, so nothing is left to report.
    setProblems([]);

    try {
      if (language === "json") {
        setCode(tablesToJSON(tables));
      } else if (language === "mermaid") {
        setCode(tablesToMermaid(tables));
      } else {
        // DBML (Default) — shared generator: preserves schema prefixes,
        // relationships (Ref:), table notes, and the docs metadata
        // (project note, enums, table groups).
        setCode(
          generateDbmlFromCanvas(tables, relationships, {
            project,
            enums,
            tableGroups,
          }),
        );
      }
    } catch (err) {
      console.error("Failed to generate code", err);
    }
  }, [tables, relationships, enums, tableGroups, project, language]);

  // 2. Code -> Canvas (Parse and Sync)
  useEffect(() => {
    if (!debouncedCode) {
      return;
    }

    // Block an edit that would push the table count over the plan cap, unless
    // it's already over (grandfathered / downgraded) and this edit doesn't add
    // more — so a capped user can still fix columns and delete tables to get
    // back under, just not add new ones.
    const overCap = (proposedCount: number) => {
      const current = useCanvasStore.getState().tables.length;
      return (
        tableCap != null && proposedCount > tableCap && proposedCount > current
      );
    };

    try {
      if (language === "json") {
        let newTables;
        try {
          newTables = jsonToTables(debouncedCode);
        } catch (err) {
          setProblems([
            { message: err instanceof Error ? err.message : "Invalid JSON" },
          ]);
          return;
        }
        setProblems([]);
        if (overCap(newTables.length)) {
          setCapError(
            `The Free plan is capped at ${tableCap} tables per diagram. This schema defines ${newTables.length} — remove some or upgrade to Pro.`,
          );
          return;
        }
        setCapError(null);
        isTypingRef.current = false;
        setIsTyping(false);
        setTables(newTables);
        return;
      }

      if (language === "mermaid") {
        // Mermaid is currently one-way (read-only for canvas sync)
        return;
      }

      // DBML Parsing (shared parser). Returns null on invalid syntax — the
      // linter surfaces the errors, so we keep the editor authoritative.
      const parsed = parseDbml(debouncedCode);
      if (!parsed) {
        setProblems(dbmlProblems(debouncedCode));
        return;
      }
      setProblems([]);

      if (overCap(parsed.tables.length)) {
        setCapError(
          `The Free plan is capped at ${tableCap} tables per diagram. This DBML defines ${parsed.tables.length} — remove some tables or upgrade to Pro.`,
        );
        return;
      }
      setCapError(null);

      // Read tables fresh from the store (not stale closure) to get current positions
      const currentTables = useCanvasStore.getState().tables;

      // For new tables: position them near the current viewport center
      const { camera, viewport } = useEditorStore.getState();
      const viewCenterX = viewport.w / 2;
      const viewCenterY = viewport.h / 2;
      const worldCenterX = (viewCenterX - camera.x) / camera.zoom;
      const worldCenterY = (viewCenterY - camera.y) / camera.zoom;

      // Build the set of enum names from the parse result so `parsedTablesToCanvasTables`
      // can preserve their casing instead of uppercasing them like primitive types.
      const knownEnumNames = new Set(
        parsed.enums.map((e) => e.name.toLowerCase()),
      );

      const newTables = parsedTablesToCanvasTables(parsed.tables, {
        existingTables: currentTables,
        originX: worldCenterX,
        originY: worldCenterY,
        knownEnumNames,
      });

      // Relationships authored as `Ref:` lines, resolved against the tables we
      // just parsed (so ids line up) and matched to existing relationships by
      // endpoint so ids/manual names survive the round-trip.
      const currentRelationships = useCanvasStore.getState().relationships;
      const newRelationships = parsedRefsToCanvasRelationships(
        parsed.refs,
        newTables,
        currentRelationships,
      );

      // Documentation metadata authored in the editor (enums, table groups,
      // project note) is stored on the canvas so it persists and re-generates.
      // Pass the current values (fresh from the store, same as above) so ids
      // survive the re-parse instead of being reminted on every keystroke.
      const meta = parsedToCanvasSchemaMeta(parsed, {
        existingEnums: useCanvasStore.getState().enums,
        existingTableGroups: useCanvasStore.getState().tableGroups,
      });

      // Clear the typing flag BEFORE the store writes so the Canvas->Code effect
      // doesn't immediately overwrite the editor on the next render.
      isTypingRef.current = false;
      setIsTyping(false);
      setTables(newTables);
      setRelationships(newRelationships);
      setEnums(meta.enums);
      setTableGroups(meta.tableGroups);
      setProject(meta.project);
    } catch (e: any) {
      // Errors are handled by the linter; leave isTypingRef as-is while code is invalid
    }
  }, [
    debouncedCode,
    setTables,
    setRelationships,
    setEnums,
    setTableGroups,
    setProject,
    language,
    tableCap,
  ]);

  const handleChange = useCallback(
    (val: string) => {
      if (readOnly) return;
      isTypingRef.current = true;
      setIsTyping(true);
      setCode(val);
    },
    [readOnly],
  );

  const handleCopy = () => {
    if (readOnly) {
      useUpgradeToastStore.getState().trigger();
      return;
    }
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (readOnly) {
      useUpgradeToastStore.getState().trigger();
      return;
    }
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

  // Table colours by the name each format writes, so the dots can find them.
  // Keyed on a string so a canvas drag (which replaces `tables`) doesn't
  // reconfigure the editor.
  const colorKey = useMemo(
    () => JSON.stringify(tables.map((t) => [t.name, t.color])),
    [tables],
  );
  const colorOf = useMemo(() => {
    const byName = new Map<string, string>();
    for (const [name, color] of JSON.parse(colorKey) as [string, string][]) {
      byName.set(name.toLowerCase(), color);
      byName.set(name.replace(/\s+/g, "_").toLowerCase(), color); // Mermaid's safe name
    }
    return (name: string) => byName.get(name.toLowerCase());
  }, [colorKey]);

  // Extensions array memoized
  const extensions = useMemo(() => {
    const exts = [
      lintGutter(),
      linter(dbmlLinterSource),
      tableColorDots(language, colorOf),
      EditorView.updateListener.of((update) => {
        if (!update.selectionSet && !update.docChanged) return;
        const head = update.state.selection.main.head;
        const line = update.state.doc.lineAt(head);
        setCursor({ line: line.number, col: head - line.from + 1 });
      }),
    ];

    if (language === "json") {
      exts.push(json());
    } else {
      // Default / DBML uses SQL highlighting
      exts.push(sql());
    }
    return exts;
  }, [dbmlLinterSource, language, colorOf]);

  const jumpTo = (problem: Problem) => {
    const view = viewRef.current;
    if (!view || problem.from === undefined) return;
    const pos = Math.min(problem.from, view.state.doc.length);
    view.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
    view.focus();
  };

  // What the status bar says about the canvas, most important first.
  const pending = isTyping && code !== debouncedCode;
  const sync = readOnly
    ? { tone: styles.quiet, label: "Read only" }
    : language === "mermaid"
      ? {
          tone: styles.quiet,
          label: "Export only · not synced",
          title: "Mermaid is export-only; edits here don't reach the canvas.",
        }
      : problems.length > 0
        ? {
            tone: styles.err,
            label: `${problems.length} ${problems.length === 1 ? "problem" : "problems"} · canvas paused`,
          }
        : capError
          ? { tone: styles.paused, label: "Paused · table limit" }
          : pending
            ? { tone: styles.busy, label: "Syncing…" }
            : { tone: styles.ok, label: "Synced with canvas" };

  return (
    <div className={styles.root} data-font={codeFont}>
      {/* Toolbar */}
      <div className={styles.bar}>
        <div className={styles.formats} role="group" aria-label="Format">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={language === f.id}
              onClick={() => setLanguage(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className={styles.spacer} />
        {!readOnly && (
          <button
            type="button"
            className={styles.iconBtn}
            onClick={handleCopy}
            title="Copy to clipboard"
            aria-label="Copy to clipboard"
          >
            {copied ? (
              <Check className={cn("w-3.5 h-3.5", styles.copied)} />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        )}
        {!readOnly && (
          <button
            type="button"
            className={styles.iconBtn}
            onClick={handleDownload}
            title={`Download schema.${language}`}
            aria-label={`Download schema.${language}`}
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {capError && (
        <div role="alert" className={styles.banner}>
          <TriangleAlert className="w-3.5 h-3.5" />
          <span>{capError}</span>
        </div>
      )}

      {/* Editor */}
      <div className={styles.editor}>
        <CodeMirror
          value={code}
          height="100%"
          theme={dbmlCodeMirrorTheme}
          extensions={extensions}
          onChange={handleChange}
          onCreateEditor={(view) => {
            viewRef.current = view;
          }}
          editable={!readOnly}
          className="h-full text-[13px]"
          basicSetup={{
            drawSelection: false,
            lineNumbers: true,
            foldGutter: true,
            lintKeymap: true, // Enable linting keymap
          }}
        />
      </div>

      {problems.length > 0 && (
        <div className={styles.problems} role="list" aria-label="Problems">
          {problems.map((p, i) => (
            <button
              key={i}
              type="button"
              role="listitem"
              className={styles.problem}
              disabled={p.from === undefined}
              onClick={() => jumpTo(p)}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span className={styles.loc}>
                {p.line ? `Ln ${p.line}` : "—"}
              </span>
              <span className={styles.message}>{p.message}</span>
            </button>
          ))}
        </div>
      )}

      {/* Status bar */}
      <div className={styles.status}>
        <span
          className={cn(styles.pill, sync.tone)}
          title={sync.title}
          role="status"
        >
          <i />
          {sync.label}
        </span>
        <span className={styles.facts}>
          <span>
            <b>{tables.length}</b> tables · <b>{relationships.length}</b> refs
          </span>
          <span>
            Ln {cursor.line}, Col {cursor.col}
          </span>
          <span>{FORMATS.find((f) => f.id === language)?.label}</span>
        </span>
      </div>
    </div>
  );
}
