"use client";

import { useDocumentationStore } from "@/store/useDocumentationStore";
import { Search, Database, Table as TableIcon } from "lucide-react";
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
            <div className="p-4 border-b border-border shrink-0">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search tables..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 bg-background h-9 text-sm"
                    />
                </div>
            </div>
            <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 mt-2 flex items-center">
                        <Database className="w-3.5 h-3.5 mr-1.5" />
                        Tables ({filteredTables.length})
                    </div>
                    {filteredTables.map((table) => (
                        <button
                            key={table.id}
                            onClick={() => setSelectedTableId(table.id)}
                            className={cn(
                                "w-full text-left px-2 py-1.5 text-sm rounded-md flex items-center transition-colors",
                                selectedTableId === table.id
                                    ? "bg-blue-500/10 text-blue-500 font-medium"
                                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                            )}
                        >
                            <TableIcon className={cn("w-4 h-4 mr-2", selectedTableId === table.id ? "opacity-100 text-blue-500" : "opacity-50")} />
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
