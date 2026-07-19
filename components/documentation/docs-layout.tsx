"use client";

import { useEffect, useMemo } from "react";
import Editor from "@monaco-editor/react";
import { Eye } from "lucide-react";
import { parseDbml } from "@/lib/parser/dsl-parser";
import { useDocumentationStore } from "@/store/useDocumentationStore";
import { useCanvasStore } from "@/store/useCanvasStore";
import { generateDbmlFromCanvas } from "@/lib/generator/dbml-generator";
import { DocsSidebar } from "./docs-sidebar";
import { DocumentationViewer } from "./documentation-viewer";

export const DocsLayout = () => {
    const setParsedDbml = useDocumentationStore(s => s.setParsedDbml);
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

    return (
        <div className="flex h-full w-full bg-background border-t border-border overflow-hidden">
            {/* Editor Pane (Left) — read-only preview of the generated DBML */}
            <div className="w-1/3 border-r border-border flex flex-col bg-[#1e1e1e]">
                <div className="px-4 py-2 border-b border-border bg-sidebar shrink-0 text-xs text-muted-foreground font-medium flex items-center justify-between">
                    <span>DBML</span>
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
                        <Eye className="w-3.5 h-3.5" />
                        Read-only · reflects canvas
                    </span>
                </div>
                <div className="flex-1 relative">
                    <Editor
                        height="100%"
                        defaultLanguage="graphql"
                        value={dslCode}
                        theme="vs-dark"
                        options={{
                            readOnly: true,
                            domReadOnly: true,
                            minimap: { enabled: false },
                            fontSize: 13,
                            wordWrap: 'on',
                            fontFamily: "'Consolas', 'Courier New', monospace",
                            padding: { top: 16 }
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
