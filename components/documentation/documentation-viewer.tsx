"use client";

import { useDocumentationStore } from "@/store/useDocumentationStore";
import { TableDocView } from "./table-view";
import { RelationshipDocView } from "./relationship-view";
import ReactMarkdown from "react-markdown";

export const DocumentationViewer = () => {
    const { parsedDbml, selectedTableId } = useDocumentationStore();

    if (!parsedDbml) {
        return (
            <div className="h-full flex items-center justify-center text-muted-foreground flex-col gap-4">
                <div className="text-lg font-medium">Syntax Error in DBML</div>
                <div className="text-sm max-w-md text-center">Failed to parse DBML code. Please check your syntax in the editor.</div>
            </div>
        );
    }

    if (!selectedTableId) {
        const title = parsedDbml.project?.name || "Database Documentation";
        const note = parsedDbml.project?.note || "Select a table from the sidebar to view its schema details, columns, and relationships.";
        
        return (
            <div className="max-w-4xl mx-auto py-10 animate-in fade-in">
                <h1 className="text-4xl font-bold tracking-tight mb-6">{title}</h1>
                <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
                    <ReactMarkdown>{note}</ReactMarkdown>
                </div>
                
                <div className="mt-12 p-8 border border-dashed border-border rounded-xl flex items-center justify-center text-muted-foreground bg-accent/20">
                    Select a table from the sidebar to inspect
                </div>
            </div>
        );
    }

    let activeTable = null;
    parsedDbml.schemas.forEach((s: any) => {
        const found = s.tables.find((t: any) => t.id === selectedTableId);
        if (found) activeTable = found;
    });

    if (!activeTable) return null;

    return (
        <div className="max-w-4xl mx-auto py-10 pb-32">
            <TableDocView table={activeTable} />
            <RelationshipDocView table={activeTable} />
        </div>
    );
};
