"use client";

import { useDocumentationStore } from "@/store/useDocumentationStore";
import { TableDocView } from "./table-view";
import { RelationshipDocView } from "./relationship-view";
import { ProjectOverview } from "./project-overview";
import { AlertTriangle } from "lucide-react";

export const DocumentationViewer = () => {
    const { parsedDbml, tables, selectedTableId } = useDocumentationStore();

    // No parsed DBML at all (syntax error or empty editor)
    if (!parsedDbml) {
        return (
            <div className="h-full flex items-center justify-center flex-col gap-3 text-muted-foreground">
                <AlertTriangle className="w-8 h-8 opacity-50" />
                <div className="text-sm font-medium">DBML Syntax Error</div>
                <div className="text-xs max-w-sm text-center opacity-70">
                    The editor contains invalid DBML. Check your syntax — all output will appear here once the code is valid.
                </div>
            </div>
        );
    }

    // No table selected → show the Project Overview / README page
    if (!selectedTableId) {
        return <ProjectOverview />;
    }

    const activeTable = tables.find((t) => t.id === selectedTableId) ?? null;
    if (!activeTable) return null;

    return (
        <div className="max-w-4xl mx-auto py-10 pb-32">
            <TableDocView table={activeTable} />
            <RelationshipDocView table={activeTable} />
        </div>
    );
};
