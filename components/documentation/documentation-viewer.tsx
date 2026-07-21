"use client";

import { useDocumentationStore } from "@/store/useDocumentationStore";
import { TableDocView } from "./table-view";
import { RelationshipDocView } from "./relationship-view";
import { ProjectOverview } from "./project-overview";
import { Table as TableIcon } from "lucide-react";

export const DocumentationViewer = () => {
    const { parsedDbml, tables, selectedTableId } = useDocumentationStore();

    // Docs reflect the canvas, which can't produce invalid DBML — so an empty
    // result means the canvas has no tables yet, not a syntax error.
    if (!parsedDbml || tables.length === 0) {
        return (
            <div className="h-full flex items-center justify-center flex-col gap-3 text-muted-foreground">
                <TableIcon className="w-8 h-8 opacity-50" />
                <div className="text-sm font-medium">No tables yet</div>
                <div className="text-xs max-w-sm text-center opacity-70">
                    Add tables on the canvas and your documentation will appear here automatically.
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
