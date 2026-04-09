"use client";

import { useState, useMemo } from "react";
import { useDocumentationStore } from "@/store/useDocumentationStore";
import {
    Search,
    Table as TableIcon,
    LayoutDashboard,
    Folder,
    FolderOpen,
    ChevronRight,
    ChevronDown,
    Layers,
    Box,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ParsedTable } from "@/lib/parser/dsl-parser";

const DEFAULT_SCHEMAS = new Set(["public", "dbo", ""]);

// ─── Single Table Row ────────────────────────────────────────────────────────
function TableButton({ table, isActive, onSelect, indent = false }: {
    table: ParsedTable;
    isActive: boolean;
    onSelect: (id: number) => void;
    indent?: boolean;
}) {
    return (
        <button
            onClick={() => onSelect(table.id)}
            className={cn(
                "w-full text-left py-1.5 text-[13px] rounded-md flex items-center transition-colors",
                indent ? "pl-6 pr-2" : "px-2",
                isActive
                    ? "bg-blue-500/10 text-blue-500 font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
        >
            <TableIcon className={cn("w-3.5 h-3.5 mr-2 shrink-0", isActive ? "text-blue-500" : "opacity-50")} />
            {table.name}
        </button>
    );
}

// ─── Collapsible Folder ───────────────────────────────────────────────────────
function SidebarFolder({ name, icon: Icon, tables, selectedTableId, onSelect, accentColor = "text-blue-400" }: {
    name: string;
    icon?: React.ElementType;
    tables: ParsedTable[];
    selectedTableId: number | null;
    onSelect: (id: number) => void;
    accentColor?: string;
}) {
    const hasActiveChild = tables.some((t) => t.id === selectedTableId);
    const [isOpen, setIsOpen] = useState(true);
    const FolderIcon = Icon ?? (isOpen ? FolderOpen : Folder);

    return (
        <div>
            <button
                onClick={() => setIsOpen((o) => !o)}
                className={cn(
                    "w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[12px] font-semibold transition-colors group",
                    hasActiveChild
                        ? cn(accentColor)
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
            >
                {isOpen
                    ? <ChevronDown className="w-3 h-3 shrink-0 opacity-60" />
                    : <ChevronRight className="w-3 h-3 shrink-0 opacity-60" />
                }
                {isOpen
                    ? <FolderOpen className={cn("w-3.5 h-3.5 shrink-0", accentColor)} />
                    : <Folder className="w-3.5 h-3.5 shrink-0 opacity-60" />
                }
                <span className="truncate uppercase tracking-wider text-[10px]">{name}</span>
                <span className="ml-auto text-[10px] text-muted-foreground/60 tabular-nums">{tables.length}</span>
            </button>

            {isOpen && (
                <div className="ml-1 border-l border-border/40 pl-1 space-y-0.5 mt-0.5 mb-1">
                    {tables.map((table) => (
                        <TableButton
                            key={table.id}
                            table={table}
                            isActive={selectedTableId === table.id}
                            onSelect={onSelect}
                            indent
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────
export const DocsSidebar = () => {
    const { tables, tableGroups, selectedTableId, setSelectedTableId, searchQuery, setSearchQuery } = useDocumentationStore();

    const query = searchQuery.toLowerCase();
    const isSearching = query.length > 0;

    // ── Search Mode: flat filtered list ──────────────────────────────────────
    const filteredTables = useMemo(() =>
        isSearching ? tables.filter((t) => t.name.toLowerCase().includes(query)) : [],
        [tables, query, isSearching]
    );

    // ── Grouping Logic ────────────────────────────────────────────────────────
    const { explicitGroups, schemaGroups, orphans, groupingMode } = useMemo(() => {
        // Mode 1: Explicit TableGroups defined in DBML
        if (tableGroups.length > 0) {
            const grouped = new Set<string>();
            const explicitGroups = tableGroups.map((group) => {
                const groupTables = group.tables
                    .map((ref) => tables.find((t) => t.name === ref.tableName))
                    .filter((t): t is ParsedTable => t !== undefined);
                groupTables.forEach((t) => grouped.add(t.name));
                return { id: group.id, name: group.name, tables: groupTables };
            });
            const orphans = tables.filter((t) => !grouped.has(t.name));
            return { explicitGroups, schemaGroups: [], orphans, groupingMode: "explicit" as const };
        }

        // Mode 2: Auto-group by schema name (e.g. [Ncr].Users → schema "Ncr")
        const schemaMap = new Map<string, ParsedTable[]>();
        const ungrouped: ParsedTable[] = [];

        tables.forEach((table) => {
            const schema = table.schema?.name ?? "";
            if (schema && !DEFAULT_SCHEMAS.has(schema.toLowerCase())) {
                if (!schemaMap.has(schema)) schemaMap.set(schema, []);
                schemaMap.get(schema)!.push(table);
            } else {
                // Also check if the table name itself contains a dot: "Ncr.Users"  
                const dotIdx = table.name.indexOf(".");
                if (dotIdx > 0) {
                    const prefix = table.name.slice(0, dotIdx).replace(/[\[\]]/g, "");
                    if (!schemaMap.has(prefix)) schemaMap.set(prefix, []);
                    schemaMap.get(prefix)!.push(table);
                } else {
                    ungrouped.push(table);
                }
            }
        });

        if (schemaMap.size > 1) {
            // Only use schema grouping if there are genuinely multiple schemas
            const schemaGroups = Array.from(schemaMap.entries()).map(([name, schemaTables]) => ({
                id: name,
                name,
                tables: schemaTables,
            }));
            return { explicitGroups: [], schemaGroups, orphans: ungrouped, groupingMode: "schema" as const };
        }

        // Mode 3: No grouping — flat list
        return { explicitGroups: [], schemaGroups: [], orphans: tables, groupingMode: "flat" as const };
    }, [tables, tableGroups]);

    const folderAccentColors: string[] = [
        "text-blue-400",
        "text-violet-400",
        "text-emerald-400",
        "text-amber-400",
        "text-rose-400",
        "text-cyan-400",
    ];

    return (
        <div className="flex flex-col h-full bg-sidebar">
            {/* Home button */}
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

                    {/* ── Search Results ─────────────────────────────────── */}
                    {isSearching && (
                        <>
                            <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 mt-1">
                                Results ({filteredTables.length})
                            </div>
                            {filteredTables.map((table) => (
                                <TableButton
                                    key={table.id}
                                    table={table}
                                    isActive={selectedTableId === table.id}
                                    onSelect={setSelectedTableId}
                                />
                            ))}
                            {filteredTables.length === 0 && (
                                <div className="px-2 py-4 text-xs text-center text-muted-foreground italic">
                                    No tables found.
                                </div>
                            )}
                        </>
                    )}

                    {/* ── Grouped Browse View ────────────────────────────── */}
                    {!isSearching && (
                        <>
                            {/* Explicit TableGroup folders */}
                            {groupingMode === "explicit" && (
                                <>
                                    <SectionHeader icon={<Layers className="w-3 h-3" />} label="Groups" />
                                    {explicitGroups.map((group, i) => (
                                        <SidebarFolder
                                            key={group.id}
                                            name={group.name}
                                            tables={group.tables}
                                            selectedTableId={selectedTableId}
                                            onSelect={setSelectedTableId}
                                            accentColor={folderAccentColors[i % folderAccentColors.length]}
                                        />
                                    ))}
                                </>
                            )}

                            {/* Auto schema folders */}
                            {groupingMode === "schema" && (
                                <>
                                    <SectionHeader icon={<Box className="w-3 h-3" />} label="Schemas" />
                                    {schemaGroups.map((group, i) => (
                                        <SidebarFolder
                                            key={group.id}
                                            name={group.name}
                                            tables={group.tables}
                                            selectedTableId={selectedTableId}
                                            onSelect={setSelectedTableId}
                                            accentColor={folderAccentColors[i % folderAccentColors.length]}
                                        />
                                    ))}
                                </>
                            )}

                            {/* Orphan / ungrouped tables */}
                            {orphans.length > 0 && (
                                <>
                                    <SectionHeader
                                        icon={<TableIcon className="w-3 h-3" />}
                                        label={groupingMode !== "flat" ? `Other Tables` : `Tables (${orphans.length})`}
                                    />
                                    {orphans.map((table) => (
                                        <TableButton
                                            key={table.id}
                                            table={table}
                                            isActive={selectedTableId === table.id}
                                            onSelect={setSelectedTableId}
                                        />
                                    ))}
                                </>
                            )}

                            {tables.length === 0 && (
                                <div className="px-2 py-6 text-xs text-center text-muted-foreground italic">
                                    No tables defined yet.
                                </div>
                            )}
                        </>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
};

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
    return (
        <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5 mt-2 mb-0.5">
            {icon}
            {label}
        </div>
    );
}
