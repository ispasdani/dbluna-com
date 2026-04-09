"use client";

import { useDocumentationStore } from "@/store/useDocumentationStore";
import { Search, Database, Table as TableIcon, LayoutDashboard } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export const DocsSidebar = () => {
    const { tables, selectedTableId, setSelectedTableId, searchQuery, setSearchQuery } = useDocumentationStore();

    const filteredTables = tables.filter((t) =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-sidebar">
            {/* Overview / Home button */}
            <button
                onClick={() => setSelectedTableId(null)}
                className={cn(
                    "flex items-center gap-2 px-4 py-3 border-b border-border text-sm font-medium transition-colors w-full text-left shrink-0",
                    !selectedTableId
                        ? "bg-blue-500/10 text-blue-500"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
            >
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                Project Overview
            </button>

            {/* Search */}
            <div className="p-3 border-b border-border shrink-0">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                        placeholder="Search tables..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 bg-background h-8 text-xs"
                    />
                </div>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-2 space-y-0.5">
                    <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 mt-1 flex items-center">
                        <Database className="w-3 h-3 mr-1.5" />
                        Tables ({filteredTables.length})
                    </div>
                    {filteredTables.map((table) => (
                        <button
                            key={table.id}
                            onClick={() => setSelectedTableId(table.id)}
                            className={cn(
                                "w-full text-left px-2 py-1.5 text-[13px] rounded-md flex items-center transition-colors",
                                selectedTableId === table.id
                                    ? "bg-blue-500/10 text-blue-500 font-medium"
                                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                            )}
                        >
                            <TableIcon className={cn("w-3.5 h-3.5 mr-2 shrink-0", selectedTableId === table.id ? "opacity-100 text-blue-500" : "opacity-50")} />
                            {table.name}
                        </button>
                    ))}

                    {filteredTables.length === 0 && (
                        <div className="px-2 py-4 text-xs text-center text-muted-foreground italic">
                            No tables found.
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
};
