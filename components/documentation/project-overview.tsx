"use client";

import ReactMarkdown from "react-markdown";
import { useDocumentationStore } from "@/store/useDocumentationStore";
import { Table as TableIcon, Link2, Hash, Database, Server, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ParsedTable } from "@/lib/parser/dsl-parser";

// ─── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color }: {
    icon: React.ElementType;
    label: string;
    value: number | string;
    color: string;
}) {
    return (
        <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-sidebar">
            <div className={cn("w-9 h-9 rounded-md flex items-center justify-center shrink-0", color)}>
                <Icon className="w-4.5 h-4.5" />
            </div>
            <div>
                <div className="text-2xl font-bold text-foreground leading-none">{value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
            </div>
        </div>
    );
}

// ─── Table Index Row ─────────────────────────────────────────────────────────
function TableIndexRow({ table, onSelect }: { table: ParsedTable; onSelect: (id: number) => void }) {
    const fieldCount = table.fields?.length ?? 0;
    const pkCount = table.fields?.filter((f) => f.pk).length ?? 0;
    const uniqueCount = table.fields?.filter((f) => f.unique && !f.pk).length ?? 0;
    const note = table.note?.value ?? (table.note as any as string) ?? null;

    return (
        <tr
            className="border-b border-border hover:bg-accent/40 cursor-pointer transition-colors group"
            onClick={() => onSelect(table.id)}
        >
            <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                    <TableIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="font-mono text-[13px] font-semibold text-foreground group-hover:text-blue-500 transition-colors">
                        {table.name}
                    </span>
                </div>
            </td>
            <td className="px-4 py-3 text-center">
                <span className="text-sm text-muted-foreground">{fieldCount}</span>
            </td>
            <td className="px-4 py-3 text-center">
                {pkCount > 0 ? (
                    <span className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 px-2 py-0.5 rounded text-[11px] font-semibold">
                        {pkCount}
                    </span>
                ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                )}
            </td>
            <td className="px-4 py-3 text-center">
                {uniqueCount > 0 ? (
                    <span className="bg-orange-500/10 text-orange-500 px-2 py-0.5 rounded text-[11px] font-semibold">
                        {uniqueCount}
                    </span>
                ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                )}
            </td>
            <td className="px-4 py-3 max-w-xs">
                {note ? (
                    <span className="text-xs text-muted-foreground truncate block max-w-xs">{note}</span>
                ) : (
                    <span className="text-xs text-muted-foreground/40 italic">No description</span>
                )}
            </td>
        </tr>
    );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export const ProjectOverview = () => {
    const { project, tables, enums, parsedDbml, setSelectedTableId } = useDocumentationStore();

    // Count total columns and relationships from raw AST
    const totalColumns = tables.reduce((acc, t) => acc + (t.fields?.length ?? 0), 0);
    const totalRefs = (() => {
        let count = 0;
        const raw = parsedDbml?.raw;
        if (!raw) return 0;
        if (raw.schemas) {
            raw.schemas.forEach((s: any) => {
                if (s.refs) count += s.refs.length;
            });
        }
        return count;
    })();

    const title = project?.name || "Database Documentation";
    const note = project?.note;
    const dbType = project?.databaseType;

    return (
        <div className="max-w-4xl mx-auto py-10 pb-32 animate-in fade-in duration-300">

            {/* Header */}
            <div className="flex items-start justify-between mb-2">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight text-foreground">{title}</h1>
                    {dbType && (
                        <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Server className="w-3.5 h-3.5" />
                            <span>{dbType}</span>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-accent/50 border border-border px-3 py-1.5 rounded-full">
                    <Database className="w-3.5 h-3.5" />
                    DBML Schema
                </div>
            </div>

            {/* Prose Note / README */}
            {note && (
                <div className="mt-6 p-6 rounded-xl border border-border bg-sidebar prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
                    <ReactMarkdown>{note}</ReactMarkdown>
                </div>
            )}

            {/* Stats Row */}
            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard
                    icon={TableIcon}
                    label="Tables"
                    value={tables.length}
                    color="bg-blue-500/10 text-blue-500"
                />
                <StatCard
                    icon={Hash}
                    label="Columns"
                    value={totalColumns}
                    color="bg-emerald-500/10 text-emerald-500"
                />
                <StatCard
                    icon={Link2}
                    label="Relationships"
                    value={totalRefs}
                    color="bg-purple-500/10 text-purple-500"
                />
                <StatCard
                    icon={GitBranch}
                    label="Enums"
                    value={enums.length}
                    color="bg-orange-500/10 text-orange-500"
                />
            </div>

            {/* Table Index */}
            {tables.length > 0 && (
                <div className="mt-10">
                    <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                        <TableIcon className="w-4 h-4" />
                        Table Index
                    </h2>
                    <div className="rounded-lg border border-border overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-sidebar border-b border-border">
                                <tr>
                                    <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Table</th>
                                    <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground text-center">Columns</th>
                                    <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground text-center">PKs</th>
                                    <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground text-center">Unique</th>
                                    <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Description</th>
                                </tr>
                            </thead>
                            <tbody className="bg-background">
                                {tables.map((table) => (
                                    <TableIndexRow
                                        key={table.id}
                                        table={table}
                                        onSelect={setSelectedTableId}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Empty state when no DBML tables defined yet */}
            {tables.length === 0 && (
                <div className="mt-12 p-12 border border-dashed border-border rounded-xl flex flex-col items-center justify-center text-muted-foreground bg-accent/10 gap-3">
                    <TableIcon className="w-10 h-10 opacity-30" />
                    <p className="text-sm">No tables defined yet.</p>
                    <p className="text-xs text-center max-w-xs">
                        Define tables in the DBML editor on the left, or click <strong>Sync from Canvas</strong> to import your current diagram.
                    </p>
                </div>
            )}
        </div>
    );
};
