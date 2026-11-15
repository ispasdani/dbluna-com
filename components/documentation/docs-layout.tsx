"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";
import { Eye, Download, GripVertical, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { docsQualifiedName, findDocsTable } from "@/lib/docs-search";
import { parseDbml } from "@/lib/parser/dsl-parser";
import { useDocumentationStore } from "@/store/useDocumentationStore";
import { useCanvasStore } from "@/store/useCanvasStore";
import { generateDbmlFromCanvas } from "@/lib/generator/dbml-generator";
import { qualifySqlServerTable } from "@/lib/schema-namespace";
import { generateDocsMarkdown } from "@/lib/generator/docs-markdown";
import { dbmlCodeMirrorTheme } from "@/lib/codemirror/dbml-theme";
import { Button } from "@/components/ui/button";
import { DocsSidebar } from "./docs-sidebar";
import { DocumentationViewer } from "./documentation-viewer";
import { ReportingHandoffDialog } from "./reporting-handoff-dialog";
import { useUpgradeToastStore } from "@/store/useUpgradeToastStore";

// Query param used to deep-link a specific table, e.g. ?table=orders
const TABLE_PARAM = "table";

interface DocsLayoutProps {
    readOnly?: boolean;
}

export const DocsLayout = ({ readOnly = false }: DocsLayoutProps) => {
    const [codeOpen, setCodeOpen] = useState(true);
    const [sidebarWidth, setSidebarWidth] = useState(300);
    const resizeStart = useRef({ x: 0, width: 0 });
    const resizeSidebar = (width: number) => setSidebarWidth(Math.max(240, Math.min(720, width)));

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
        const parsed = parseDbml(dslCode);
        const byName = new Map(canvasTables.map(table => [table.name, table]));
        for (const table of parsed?.tables ?? []) {
            const qualified = table.schema?.name && (table.schema.name !== "public" || table.explicitDefaultSchema) && qualifySqlServerTable(table.schema.name, table.name);
            const canvasTable = (qualified ? byName.get(qualified) : undefined) ?? byName.get(table.name);
            if (!canvasTable) continue;
            table.description = canvasTable.description;
            table.sqlServerIndexes = canvasTable.sqlServerIndexes;
            const byColumn = new Map(canvasTable.columns.map(column => [column.name, column]));
            for (const field of table.fields) {
                const column = byColumn.get(field.name);
                if (!column) continue;
                field.description = column.description;
                field.defaultExpression = column.defaultExpression;
                field.computedExpression = column.computedExpression;
            }
        }
        const objects = canvasProject?.sqlServerObjects ?? canvasProject?.sqlServerViews;
        if (parsed && objects?.length) {
            parsed.project = { name: "Database Documentation", ...parsed.project, sqlServerObjects: objects };
        }
        setParsedDbml(parsed);
    }, [canvasTables, canvasProject, dslCode, setParsedDbml]);

    useEffect(() => {
        const restore = () => {
            const url = new URL(window.location.href);
            const table = findDocsTable(docTables, url.searchParams.get(TABLE_PARAM));
            const member = url.searchParams.get("member");
            if (table) {
                setSelectedTableId(table.id);
                if (member?.startsWith("docs-")) {
                    requestAnimationFrame(() => document.getElementById(member)?.focus());
                }
            }
        };
        restore();
        const restoreHistory = () => {
            if (!new URLSearchParams(window.location.search).has(TABLE_PARAM)) setSelectedTableId(null);
            else restore();
        };
        window.addEventListener("popstate", restoreHistory);
        return () => window.removeEventListener("popstate", restoreHistory);
    }, [docTables, setSelectedTableId]);

    useEffect(() => {
        if (!docTables.length || selectedTableId !== useDocumentationStore.getState().selectedTableId) return;
        const table = docTables.find(item => item.id === selectedTableId);
        if (selectedTableId !== null && !table) return;
        const url = new URL(window.location.href);
        const previous = url.searchParams.get(TABLE_PARAM);
        if (table) url.searchParams.set(TABLE_PARAM, docsQualifiedName(table));
        else url.searchParams.delete(TABLE_PARAM);
        if (!table || findDocsTable(docTables, previous)?.id !== table.id) url.searchParams.delete("member");
        if (url.href !== window.location.href) history.replaceState(history.state, "", url);
    }, [docTables, selectedTableId]);

    const handleExport = () => {
        if (readOnly) {
            useUpgradeToastStore.getState().trigger();
            return;
        }
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
        <div className="flex h-full min-h-0 w-full bg-background border-t border-border overflow-hidden">
            {/* Editor Pane (Left) — collapsible read-only preview of the generated DBML */}
            <div className={`${codeOpen ? "w-1/3" : "w-10"} border-r border-border flex flex-col bg-[#1e1e1e] shrink-0 transition-all duration-200`}>
                <div className="px-2 py-2 border-b border-border bg-sidebar shrink-0 text-xs text-muted-foreground font-medium flex items-center justify-between gap-2">
                    {codeOpen && (
                        <div className="flex items-center gap-3 min-w-0">
                            <span>DBML</span>
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground/70 truncate" title="This DBML is generated from the canvas and cannot be edited here">
                                <Eye className="w-3.5 h-3.5 shrink-0" />
                                Read-only
                            </span>
                        </div>
                    )}
                    <div className={`flex items-center gap-1 ${codeOpen ? "" : "w-full justify-center"}`}>
                        {codeOpen && !readOnly && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleExport}
                                disabled={!parsedDbml || (!docTables.length && !parsedDbml.project?.sqlServerObjects?.length)}
                                className="h-6 text-xs text-primary hover:text-primary/80 hover:bg-primary/10 shrink-0"
                            >
                                <Download className="w-3.5 h-3.5 mr-1" />
                                Export .md
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCodeOpen(o => !o)}
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-accent shrink-0"
                            title={codeOpen ? "Collapse DBML pane" : "Expand DBML pane"}
                        >
                            {codeOpen
                                ? <PanelLeftClose className="w-3.5 h-3.5" />
                                : <PanelLeftOpen className="w-3.5 h-3.5" />
                            }
                        </Button>
                    </div>
                </div>
                {codeOpen && (
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
                )}
            </div>

            {/* Sidebar Pane (Middle) */}
            <div className="relative flex min-h-0 shrink-0 flex-col border-r border-border bg-sidebar" style={{ width: sidebarWidth, maxWidth: codeOpen ? "40%" : "60%" }}>
               <DocsSidebar />
               <div
                   role="separator"
                   aria-label="Resize documentation sidebar"
                   aria-orientation="vertical"
                   aria-valuemin={240}
                   aria-valuemax={720}
                   aria-valuenow={sidebarWidth}
                   tabIndex={0}
                   className="group absolute -right-1 top-0 z-10 h-full w-2 cursor-col-resize touch-none focus-visible:outline focus-visible:outline-primary"
                   onPointerDown={event => {
                       if (event.button !== 0) return;
                       resizeStart.current = { x: event.clientX, width: event.currentTarget.parentElement!.offsetWidth };
                       event.currentTarget.setPointerCapture(event.pointerId);
                   }}
                   onPointerMove={event => {
                       if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                           resizeSidebar(resizeStart.current.width + event.clientX - resizeStart.current.x);
                       }
                   }}
                   onKeyDown={event => {
                       if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                       event.preventDefault();
                       const width = event.currentTarget.parentElement!.offsetWidth;
                       resizeSidebar(width + (event.key === "ArrowLeft" ? -20 : 20));
                   }}
               >
                   <span className="pointer-events-none absolute left-1/2 top-1/2 flex h-6 w-3.5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-sm border bg-background text-muted-foreground shadow-sm group-hover:text-foreground">
                       <GripVertical className="h-3 w-3" />
                   </span>
               </div>
            </div>

            {/* Content Pane (Right) */}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
                {!readOnly && parsedDbml && (
                    <div className="flex shrink-0 justify-end border-b border-border px-3 py-1">
                        <ReportingHandoffDialog parsed={parsedDbml} />
                    </div>
                )}
                <div className="min-h-0 flex-1 overflow-auto p-4 lg:p-8">
                    <DocumentationViewer />
                </div>
            </div>
        </div>
    );
};
