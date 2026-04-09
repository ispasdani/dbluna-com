"use client";

import ReactMarkdown from "react-markdown";
import { Key } from "lucide-react";
import { cn } from "@/lib/utils";

export const TableDocView = ({ table }: { table: any }) => {
    if (!table) return null;

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">{table.name}</h1>
                {table.note ? (
                    <div className="mt-4 prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
                        <ReactMarkdown>{table.note}</ReactMarkdown>
                    </div>
                ) : (
                    <p className="mt-2 text-sm text-muted-foreground italic">No description provided.</p>
                )}
            </div>

            <div className="rounded-md border border-border overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-sidebar border-b border-border">
                        <tr>
                            <th className="px-4 py-3 font-medium text-muted-foreground w-1/3">Column</th>
                            <th className="px-4 py-3 font-medium text-muted-foreground w-1/4">Type</th>
                            <th className="px-4 py-3 font-medium text-muted-foreground">Details</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {table.fields.map((field: any) => (
                            <tr key={field.id} className="hover:bg-accent/50 transition-colors bg-background">
                                <td className="px-4 py-3 flex items-center font-mono text-[13px]">
                                    <span className={cn("font-medium", field.pk ? "text-blue-500" : "text-foreground")}>
                                        {field.name}
                                    </span>
                                    {field.pk && <Key className="w-3.5 h-3.5 ml-2 text-yellow-500" />}
                                </td>
                                <td className="px-4 py-3 font-mono text-[13px] text-emerald-600 dark:text-emerald-400">
                                    {field.type.type_name}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex flex-col space-y-1.5 text-xs">
                                        {(field.unique || field.not_null || field.dbdefault) && (
                                            <div className="flex items-center space-x-2">
                                                {field.unique && <span className="bg-orange-500/10 text-orange-500 px-1.5 py-0.5 rounded uppercase text-[10px] font-bold tracking-wider">Unique</span>}
                                                {field.not_null && <span className="bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded uppercase text-[10px] font-bold tracking-wider">Not Null</span>}
                                                {field.dbdefault && <span className="bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded text-[10px] tracking-wider font-mono">def: {field.dbdefault.value}</span>}
                                            </div>
                                        )}
                                        {field.note && (
                                            <div className="text-muted-foreground prose prose-sm dark:prose-invert">
                                                <ReactMarkdown>{field.note}</ReactMarkdown>
                                            </div>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
