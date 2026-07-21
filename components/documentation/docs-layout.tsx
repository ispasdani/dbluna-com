"use client";

import { useEffect, useMemo, useRef } from "react";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";
import { Eye, Download } from "lucide-react";
import { parseDbml } from "@/lib/parser/dsl-parser";
import { useDocumentationStore } from "@/store/useDocumentationStore";
import { useCanvasStore } from "@/store/useCanvasStore";
import { generateDbmlFromCanvas } from "@/lib/generator/dbml-generator";
import { generateDocsMarkdown } from "@/lib/generator/docs-markdown";
import { dbmlCodeMirrorTheme } from "@/lib/codemirror/dbml-theme";
import { Button } from "@/components/ui/button";
import { DocsSidebar } from "./docs-sidebar";
import { DocumentationViewer } from "./documentation-viewer";

// Query param used to deep-link a specific table, e.g. ?table=orders
const TABLE_PARAM = "table";

export const DocsLayout = () => {
    const setParsedDbml = useDocumentationStore(s => s.setParsedDbml);
    const parsedDbml = useDocumentationStore(s => s.parsedDbml);
    const docTables = useDocumentationStore(s => s.tables);
    const selectedTableId = useDocumentationStore(s => s.selectedTableId);
    const setSelectedTableId = useDocumentationStore(s => s.setSelectedTableId);

    const canvasTables = useCanvasStore(s => s.tables);
    const canvasRelationships = useCanvasStore(s => s.relationships);
    const canvasEnums = useCanvasStore(s => s.enums);
    const canvasTableGroups = useCanvasStore(s => s.tableGroups);
    const canvasProject = useCanvasStore(s => s.project);

    // Docs is a read-only reflection of the canvas — the DBML is derived, never authored here.
    // The canvas is the single source of truth and persists itself, so there is nothing to save.
    const dslCode = useMemo(
        () => generateDbmlFromCanvas(canvasTables, canvasRelationships, {
            project: canvasProject,
            enums: canvasEnums,
            tableGroups: canvasTableGroups,
        }),
        [canvasTables, canvasRelationships, canvasEnums, canvasTableGroups, canvasProject]
    );

    useEffect(() => {
        setParsedDbml(parseDbml(dslCode));
    }, [dslCode, setParsedDbml]);

    // ── Deep-linking (?table=<name>) ─────────────────────────────────────────
    // Reflect the current selection into the URL. Uses history.replaceState so
    // it never pushes browser history (safe inside the Desktop/Electron shell)
    // and stays out of the Next.js router entirely.
    useEffect(() => {
        if (typeof window === "undefined") return;
        const name = docTables.find(t => t.id === selectedTableId)?.name ?? null;
        const url = new URL(window.location.href);
        if (name) url.searchParams.set(TABLE_PARAM, name);
        else url.searchParams.delete(TABLE_PARAM);
        if (url.href !== window.location.href) {
            window.history.replaceState(window.history.state, "", url);
        }
    }, [selectedTableId, docTables]);

    // Restore / reconcile the selection from the URL whenever the tables reparse.
    // Tables are re-derived (and get fresh AST ids) on every canvas change, so we
    // re-match by the stable table name to keep the selection — and any shared
    // link — pointing at the right table. Runs on table changes only, so it never
    // fights a user click.
    const lastReconciled = useRef<string | null>(null);
    useEffect(() => {
        if (typeof window === "undefined") return;
        const name = new URLSearchParams(window.location.search).get(TABLE_PARAM);
        if (!name) { lastReconciled.current = null; return; }
        const match = docTables.find(t => t.name === name);
        if (match && match.id !== useDocumentationStore.getState().selectedTableId) {
            setSelectedTableId(match.id);
        }
        lastReconciled.current = name;
    }, [docTables, setSelectedTableId]);

    const handleExport = () => {
        if (!parsedDbml) return;
        const markdown = generateDocsMarkdown(parsedDbml);
        const base = parsedDbml.project?.name?.trim().replace(/\s+/g, "-").toLowerCase() || "documentation";
        const blob = new Blob([markdown], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${base}.md`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex h-full w-full bg-background border-t border-border overflow-hidden">
            {/* Editor Pane (Left) — read-only preview of the generated DBML */}
            <div className="w-1/3 border-r border-border flex flex-col bg-[#1e1e1e]">
                <div className="px-4 py-2 border-b border-border bg-sidebar shrink-0 text-xs text-muted-foreground font-medium flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                        <span>DBML</span>
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground/70 truncate" title="This DBML is generated from the canvas and cannot be edited here">
                            <Eye className="w-3.5 h-3.5 shrink-0" />
                            Read-only
                        </span>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleExport}
                        disabled={!parsedDbml || docTables.length === 0}
                        className="h-6 text-xs text-blue-500 hover:text-blue-400 hover:bg-blue-500/10 shrink-0"
                    >
                        <Download className="w-3.5 h-3.5 mr-1" />
                        Export .md
                    </Button>
                </div>
                <div className="flex-1 overflow-auto relative">
                    <CodeMirror
                        value={dslCode}
                        height="100%"
                        theme={dbmlCodeMirrorTheme}
                        editable={false}
                        extensions={[sql(), EditorView.lineWrapping]}
                        className="h-full text-[13px]"
                        basicSetup={{
                            lineNumbers: true,
                            foldGutter: true,
                            highlightActiveLine: false,
                            highlightActiveLineGutter: false,
                        }}
                    />
                </div>
            </div>

            {/* Sidebar Pane (Middle) */}
            <div className="w-64 border-r border-border bg-sidebar flex-shrink-0">
               <DocsSidebar />
            </div>

            {/* Content Pane (Right) */}
            <div className="flex-1 overflow-auto bg-background p-8">
               <DocumentationViewer />
            </div>
        </div>
    );
};
