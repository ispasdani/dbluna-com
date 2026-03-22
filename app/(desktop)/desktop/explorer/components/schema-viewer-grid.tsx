"use client";

import { useState, useEffect } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Key } from "lucide-react";

interface SchemaViewerGridProps {
    dbName: string;
    schemaName: string;
    tableName: string;
}

export function SchemaViewerGrid({ dbName, schemaName, tableName }: SchemaViewerGridProps) {
    const [columns, setColumns] = useState<any[]>([]);
    const [isQuerying, setIsQuerying] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const fetchSchema = async () => {
            if (typeof window !== "undefined" && (window as any).electron) {
                setIsQuerying(true);
                try {
                    const result = await (window as any).electron.getTableSchema(dbName, schemaName, tableName);
                    if (isMounted) {
                        if (result && result.success) {
                            setColumns(result.data || []);
                        } else {
                            console.error(`Error querying schema:`, result?.error);
                            setColumns([]);
                        }
                    }
                } catch (error) {
                    console.error(`Failed to query schema for ${tableName}`, error);
                    if (isMounted) setColumns([]);
                } finally {
                    if (isMounted) setIsQuerying(false);
                }
            }
        };

        fetchSchema();
        return () => { isMounted = false; };
    }, [dbName, schemaName, tableName]);

    if (isQuerying) {
        return (
            <div className="h-full flex items-center justify-center p-6 bg-slate-950">
                <div className="flex flex-col items-center space-y-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-500"></div>
                    <p className="text-slate-500 text-sm">Loading schema for {tableName}...</p>
                </div>
            </div>
        );
    }

    if (columns.length === 0) {
        return (
            <div className="h-full flex items-center justify-center text-slate-500 bg-slate-950">
                <p>No schema found or empty table.</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-slate-950">
            <div className="px-4 py-2 border-b border-slate-800 bg-slate-900/50 flex">
                <span className="text-xs text-slate-400">
                    Showing {columns.length} columns for {schemaName}.{tableName}
                </span>
            </div>
            <div className="flex-1 overflow-hidden p-4">
                <div className="rounded-md border border-slate-800 bg-slate-900 overflow-hidden h-full flex flex-col">
                    <ScrollArea className="flex-1 w-full">
                        <Table>
                            <TableHeader className="bg-slate-950 sticky top-0 z-10 border-b border-slate-800">
                                <TableRow className="hover:bg-transparent border-none">
                                    <TableHead className="w-10 px-4"></TableHead>
                                    <TableHead className="text-xs text-slate-400 uppercase h-10 px-4">Column Name</TableHead>
                                    <TableHead className="text-xs text-slate-400 uppercase h-10 px-4">Data Type</TableHead>
                                    <TableHead className="text-xs text-slate-400 uppercase h-10 px-4">Max Length</TableHead>
                                    <TableHead className="text-xs text-slate-400 uppercase h-10 px-4">Allow Nulls</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {columns.map((col, i) => (
                                    <TableRow key={i} className="border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                        <TableCell className="px-4 py-3">
                                            {/* Dummy PK icon for illustration, precise PK detection requires complex query */}
                                            {i === 0 ? <Key className="h-3.5 w-3.5 text-yellow-500/70" /> : null}
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap text-slate-300 py-3 px-4 font-medium">
                                            {col.COLUMN_NAME}
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap text-blue-400 py-3 px-4">
                                            {col.DATA_TYPE}
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap text-slate-400 py-3 px-4">
                                            {col.CHARACTER_MAXIMUM_LENGTH === -1 ? 'MAX' : (col.CHARACTER_MAXIMUM_LENGTH || '-')}
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap text-slate-400 py-3 px-4">
                                            {col.IS_NULLABLE === 'YES' ? 'Yes' : 'No'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </div>
            </div>
        </div>
    );
}
