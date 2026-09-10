"use client";

import ReactMarkdown from "react-markdown";
import { Tag } from "lucide-react";
import { useDocumentationStore } from "@/store/useDocumentationStore";

export const EnumDocView = () => {
    const { enums, selectedEnumId } = useDocumentationStore();
    const enumItem = enums.find((e) => e.id === selectedEnumId) ?? null;
    if (!enumItem) return null;

    const note = enumItem.note?.value ?? (enumItem.note as any as string) ?? null;

    return (
        <div className="max-w-4xl mx-auto py-10 pb-32 space-y-6 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <Tag className="w-5 h-5 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Enum</span>
                </div>
                <h1 className="text-3xl font-bold tracking-tight font-mono">{enumItem.name}</h1>
                {note ? (
                    <div className="mt-4 prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
                        <ReactMarkdown>{note}</ReactMarkdown>
                    </div>
                ) : (
                    <p className="mt-2 text-sm text-muted-foreground italic">No description provided.</p>
                )}
            </div>

            {/* Values table */}
            <div className="rounded-md border border-border overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-sidebar border-b border-border">
                        <tr>
                            <th className="px-4 py-3 font-medium text-muted-foreground w-8 text-center">#</th>
                            <th className="px-4 py-3 font-medium text-muted-foreground">Value</th>
                            <th className="px-4 py-3 font-medium text-muted-foreground">Note</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {enumItem.values.map((v: any, idx: number) => {
                            const valueNote = v.note?.value ?? (v.note as any as string) ?? null;
                            return (
                                <tr key={idx} className="hover:bg-accent/50 transition-colors bg-background">
                                    <td className="px-4 py-3 text-center text-xs text-muted-foreground/50 tabular-nums">{idx + 1}</td>
                                    <td className="px-4 py-3 font-mono text-[13px] font-medium text-foreground">
                                        <div className="flex items-center gap-2">
                                            <div className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                                            {v.name}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-muted-foreground">
                                        {valueNote ? (
                                            <div className="prose prose-sm dark:prose-invert">
                                                <ReactMarkdown>{valueNote}</ReactMarkdown>
                                            </div>
                                        ) : (
                                            <span className="italic opacity-40">—</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Usage hint — which tables reference this enum */}
            <UsedBySection enumName={enumItem.name} />
        </div>
    );
};

function UsedBySection({ enumName }: { enumName: string }) {
    const { tables, setSelectedTableId } = useDocumentationStore();

    const usages: Array<{ tableName: string; tableId: number; fieldName: string }> = [];
    for (const table of tables) {
        for (const field of table.fields ?? []) {
            if (field.type?.type_name === enumName) {
                usages.push({ tableName: table.name, tableId: table.id, fieldName: field.name });
            }
        }
    }

    if (usages.length === 0) return null;

    return (
        <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Tag className="w-3.5 h-3.5" />
                Used By
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {usages.map((u, i) => (
                    <button
                        key={i}
                        onClick={() => setSelectedTableId(u.tableId)}
                        className="p-3 rounded-md border border-border bg-sidebar hover:bg-accent/50 transition-colors text-left group"
                    >
                        <span className="font-mono text-[13px] font-semibold group-hover:text-primary transition-colors">{u.tableName}</span>
                        <span className="text-muted-foreground mx-1.5">·</span>
                        <span className="font-mono text-[13px] text-muted-foreground">{u.fieldName}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
