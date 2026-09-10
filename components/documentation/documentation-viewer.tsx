"use client";

import { useDocumentationStore } from "@/store/useDocumentationStore";
import { TableDocView } from "./table-view";
import { RelationshipDocView } from "./relationship-view";
import { ProjectOverview } from "./project-overview";
import { EnumDocView } from "./enum-view";
import { Table as TableIcon, LayoutDashboard, ChevronRight, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Breadcrumb ───────────────────────────────────────────────────────────────
function Breadcrumb({ label, icon: Icon, isEnum = false }: { label: string; icon: React.ElementType; isEnum?: boolean }) {
    const { setSelectedTableId, setSelectedEnumId } = useDocumentationStore();
    const clearSelection = () => { setSelectedTableId(null); setSelectedEnumId(null); };

    return (
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6 select-none">
            <button
                onClick={clearSelection}
                className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Overview</span>
            </button>
            <ChevronRight className="w-3 h-3 opacity-40" />
            <div className={cn("flex items-center gap-1 font-medium", isEnum ? "text-emerald-600 dark:text-emerald-400" : "text-primary")}>
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
            </div>
        </nav>
    );
}

export const DocumentationViewer = () => {
    const { parsedDbml, tables, enums, selectedTableId, selectedEnumId } = useDocumentationStore();

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

    // Enum selected
    if (selectedEnumId) {
        const activeEnum = enums.find(e => e.id === selectedEnumId);
        return (
            <div className="max-w-4xl mx-auto py-10 pb-32">
                <Breadcrumb label={activeEnum?.name ?? "Enum"} icon={Tag} isEnum />
                <EnumDocView />
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
            <Breadcrumb label={activeTable.name} icon={TableIcon} />
            <TableDocView table={activeTable} />
            <RelationshipDocView table={activeTable} />
        </div>
    );
};
