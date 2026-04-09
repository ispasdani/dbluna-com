"use client";

import { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import { DownloadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseDbml } from "@/lib/parser/dsl-parser";
import { useDocumentationStore } from "@/store/useDocumentationStore";
import { useCanvasStore } from "@/store/useCanvasStore";
import { generateDbmlFromCanvas } from "@/lib/generator/dbml-generator";
import { DocsSidebar } from "./docs-sidebar";
import { DocumentationViewer } from "./documentation-viewer";

export const DocsLayout = () => {
    const [dslCode, setDslCode] = useState(`// Type your DBML here
Project "Startup App" {
  database_type: 'PostgreSQL'
  Note: 'Welcome to your project documentation. Built using standard DBML.'
}

Table users {
  id integer [primary key]
  username varchar
  created_at timestamp
  Note: 'Stores standard user metrics and authentication details'
}

Table orders {
  id integer [primary key]
  user_id integer
  status varchar [default: 'pending']
  merchant_id integer [not null]
  Note: 'E-commerce transactional orders'
}

Table merchants {
  id integer [primary key]
  merchant_name varchar [unique]
}

Ref: orders.user_id > users.id
Ref: orders.merchant_id > merchants.id
`);
    
    const setParsedDbml = useDocumentationStore(s => s.setParsedDbml);
    const canvasTables = useCanvasStore(s => s.tables);
    const canvasRelationships = useCanvasStore(s => s.relationships);

    useEffect(() => {
        const parsed = parseDbml(dslCode);
        if (parsed) {
            setParsedDbml(parsed);
        }
    }, [dslCode, setParsedDbml]);

    const handleSyncCanvas = () => {
        const generated = generateDbmlFromCanvas(canvasTables, canvasRelationships);
        setDslCode(generated);
    };

    return (
        <div className="flex h-full w-full bg-background border-t border-border overflow-hidden">
            {/* Editor Pane (Left) */}
            <div className="w-1/3 border-r border-border flex flex-col bg-[#1e1e1e]">
                <div className="px-4 py-2 border-b border-border bg-sidebar shrink-0 text-xs text-muted-foreground font-medium flex items-center justify-between">
                    <span>DBML Editor</span>
                    <Button variant="ghost" size="sm" onClick={handleSyncCanvas} className="h-6 text-xs text-blue-500 hover:text-blue-400 hover:bg-blue-500/10">
                        <DownloadCloud className="w-3.5 h-3.5 mr-1" />
                        Sync from Canvas
                    </Button>
                </div>
                <div className="flex-1 relative">
                    <Editor
                        height="100%"
                        defaultLanguage="graphql" 
                        value={dslCode}
                        theme="vs-dark"
                        onChange={(val) => setDslCode(val || "")}
                        options={{
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
