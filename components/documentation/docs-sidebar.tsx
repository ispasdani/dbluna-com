"use client";

import { useState, useMemo } from "react";
import { useDocumentationStore } from "@/store/useDocumentationStore";
import type { ParsedEnum, ParsedTable } from "@/lib/parser/dsl-parser";
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
    Tag,
    Hash,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

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
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
        >
            <TableIcon className={cn("w-3.5 h-3.5 mr-2 shrink-0", isActive ? "text-primary" : "opacity-50")} />
            {table.name}
        </button>
    );
}

// ─── Single Enum Row ─────────────────────────────────────────────────────────
function EnumButton({ enumItem, isActive, onSelect }: {
    enumItem: ParsedEnum;
    isActive: boolean;
    onSelect: (id: number) => void;
}) {
    return (
        <button
            onClick={() => onSelect(enumItem.id)}
            className={cn(
                "w-full text-left py-1.5 px-2 text-[13px] rounded-md flex items-center transition-colors",
                isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
        >
            <Tag className={cn("w-3.5 h-3.5 mr-2 shrink-0", isActive ? "text-primary" : "opacity-50")} />
            {enumItem.name}
            <span className="ml-auto text-[10px] text-muted-foreground/60 tabular-nums">{enumItem.values.length}</span>
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
    const { tables, enums, tableGroups, selectedTableId, setSelectedTableId, selectedEnumId, setSelectedEnumId, searchQuery, setSearchQuery } = useDocumentationStore();

    const query = searchQuery.toLowerCase();
    const isSearching = query.length > 0;

    // ── Search Mode: flat filtered list ──────────────────────────────────────
    const filteredTables = useMemo(() =>
        isSearching ? tables.filter((t) => t.name.toLowerCase().includes(query)) : [],
        [tables, query, isSearching]
    );

    const filteredEnums = useMemo(() =>
        isSearching ? enums.filter((e) => e.name.toLowerCase().includes(query)) : [],
        [enums, query, isSearching]
    );

    // Column-level matches: fields whose name matches but whose parent table doesn't
    const filteredColumns = useMemo(() => {
        if (!isSearching) return [];
        const tableNameMatches = new Set(filteredTables.map(t => t.id));
        const hits: Array<{ tableId: number; tableName: string; fieldName: string }> = [];
        for (const table of tables) {
            if (tableNameMatches.has(table.id)) continue; // already shown under table match
            for (const field of table.fields ?? []) {
                if (field.name.toLowerCase().includes(query)) {
                    hits.push({ tableId: table.id, tableName: table.name, fieldName: field.name });
                }
            }
        }
        return hits;
    }, [tables, filteredTables, query, isSearching]);

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
                onClick={() => { setSelectedTableId(null); setSelectedEnumId(null); }}
                className={cn(
                    "flex items-center gap-2 px-4 py-3 border-b border-border text-sm font-medium transition-colors w-full text-left shrink-0",
                    !selectedTableId && !selectedEnumId
                        ? "bg-primary/10 text-primary"
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
                        placeholder="Search tables, columns..."
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
                            {filteredTables.length > 0 && (
                                <>
                                    <SectionHeader icon={<TableIcon className="w-3 h-3" />} label={`Tables (${filteredTables.length})`} />
                                    {filteredTables.map((table) => (
                                        <TableButton
                                            key={table.id}
                                            table={table}
                                            isActive={selectedTableId === table.id}
                                            onSelect={setSelectedTableId}
                                        />
                                    ))}
                                </>
                            )}
                            {filteredEnums.length > 0 && (
                                <>
                                    <SectionHeader icon={<Tag className="w-3 h-3" />} label={`Enums (${filteredEnums.length})`} />
                                    {filteredEnums.map((e) => (
                                        <EnumButton
                                            key={e.id}
                                            enumItem={e}
                                            isActive={selectedEnumId === e.id}
                                            onSelect={setSelectedEnumId}
                                        />
                                    ))}
                                </>
                            )}
                            {filteredColumns.length > 0 && (
                                <>
                                    <SectionHeader icon={<Hash className="w-3 h-3" />} label={`Columns (${filteredColumns.length})`} />
                                    {filteredColumns.map((hit, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setSelectedTableId(hit.tableId)}
                                            className={cn(
                                                "w-full text-left py-1.5 px-2 text-[13px] rounded-md flex items-center gap-1.5 transition-colors",
                                                selectedTableId === hit.tableId
                                                    ? "bg-primary/10 text-primary font-medium"
                                                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                                            )}
                                        >
                                            <TableIcon className="w-3 h-3 shrink-0 opacity-50" />
                                            <span className="opacity-70 text-[12px]">{hit.tableName}</span>
                                            <span className="opacity-40 text-[11px]">·</span>
                                            <span className="font-mono text-[12px]">{hit.fieldName}</span>
                                        </button>
                                    ))}
                                </>
                            )}
                            {filteredTables.length === 0 && filteredEnums.length === 0 && filteredColumns.length === 0 && (
                                <div className="px-2 py-4 text-xs text-center text-muted-foreground italic">
                                    No results found.
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

                            {/* Enums section */}
                            {enums.length > 0 && (
                                <>
                                    <SectionHeader icon={<Tag className="w-3 h-3" />} label={`Enums (${enums.length})`} />
                                    {enums.map((e) => (
                                        <EnumButton
                                            key={e.id}
                                            enumItem={e}
                                            isActive={selectedEnumId === e.id}
                                            onSelect={setSelectedEnumId}
                                        />
                                    ))}
                                </>
                            )}

                            {tables.length === 0 && enums.length === 0 && (
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
