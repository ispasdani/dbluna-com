"use client";

import { useState, useEffect } from "react";
import { Database, Table as TableIcon, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function DatabaseExplorer() {
    const router = useRouter();
    const [tables, setTables] = useState<any[]>([]);
    const [activeTable, setActiveTable] = useState<string | null>(null);
    const [tableData, setTableData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isQuerying, setIsQuerying] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);

    useEffect(() => {
        const fetchTables = async () => {
            if (typeof window !== "undefined" && (window as any).electron) {
                try {
                    // Start connection for the explorer session
                    // We supply standard Dev SQL Server credentials for MacOS Docker environments.
                    const config = {
                        server: "localhost",
                        port: 1433,
                        user: "sa",
                        password: "yourStrong(!)Password", // Default dev SQL password
                        options: {
                            encrypt: false,
                            trustServerCertificate: true
                        }
                    };
                    const connResult = await (window as any).electron.connectDb(config);

                    if (!connResult || !connResult.success) {
                        setConnectionError(`Failed to connect to database: ${connResult?.error || 'Unknown error'}`);
                        setIsLoading(false);
                        return;
                    }

                    const result = await (window as any).electron.getTables();
                    if (result && result.success) {
                        setTables(result.data || []);
                    } else {
                        setConnectionError(`Failed to fetch tables: ${result?.error}`);
                        console.error('Failed to get tables:', result?.error);
                    }
                } catch (error) {
                    console.error("Failed to fetch tables", error);
                } finally {
                    setIsLoading(false);
                }
            } else {
                console.warn("Electron environment not detected.");
                setIsLoading(false);
            }
        };

        fetchTables();
    }, []);

    useEffect(() => {
        const fetchTableData = async () => {
            if (!activeTable) {
                setTableData([]);
                return;
            }

            if (typeof window !== "undefined" && (window as any).electron) {
                setIsQuerying(true);
                try {
                    const result = await (window as any).electron.queryTable(activeTable);
                    if (result && result.success) {
                        setTableData(result.data || []);
                    } else {
                        console.error(`Error querying table:`, result?.error);
                        setTableData([]);
                    }
                } catch (error) {
                    console.error(`Failed to query table ${activeTable}`, error);
                    setTableData([]);
                } finally {
                    setIsQuerying(false);
                }
            }
        };

        fetchTableData();
    }, [activeTable]);

    // Group tables by schema
    const schemas = tables.reduce((acc, table) => {
        const schema = table.TABLE_SCHEMA || 'dbo';
        if (!acc[schema]) {
            acc[schema] = [];
        }
        acc[schema].push(table);
        return acc;
    }, {} as Record<string, any[]>);

    return (
        <div className="flex h-screen bg-slate-950 text-slate-300 overflow-hidden">
            {/* Sidebar */}
            <div className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col">
                <div className="p-4 border-b border-slate-800 flex items-center space-x-3">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/desktop')} className="h-8 w-8 text-slate-400 hover:text-white">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center space-x-2">
                        <Database className="h-5 w-5 text-blue-500" />
                        <h2 className="font-semibold text-slate-100">Explorer</h2>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {isLoading ? (
                        <div className="text-sm text-slate-500 animate-pulse">Loading tables...</div>
                    ) : connectionError ? (
                        <div className="text-sm text-red-400 bg-red-950/30 p-3 rounded border border-red-900/50">
                            <strong>Connection Error:</strong><br />
                            <span className="break-all">{connectionError}</span>
                        </div>
                    ) : tables.length === 0 ? (
                        <div className="text-sm text-slate-500">No tables found.</div>
                    ) : (
                        Object.entries(schemas).map(([schema, schemaTables]) => (
                            <div key={schema}>
                                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">
                                    {schema}
                                </h3>
                                <ul className="space-y-1">
                                    {(schemaTables as any[]).map((t) => {
                                        // Some standard queries return TABLE_SCHEMA, some might not. We fallback safely.
                                        const tableName = t.TABLE_NAME || t.name || 'Unknown Table';
                                        const queryName = t.TABLE_SCHEMA ? `[${t.TABLE_SCHEMA}].[${tableName}]` : `[${tableName}]`;
                                        const isActive = activeTable === queryName;

                                        return (
                                            <li key={queryName}>
                                                <button
                                                    onClick={() => setActiveTable(queryName)}
                                                    className={`w-full flex items-center space-x-2 px-2 py-1.5 rounded-md text-sm transition-colors ${isActive
                                                        ? "bg-blue-600/20 text-blue-400"
                                                        : "hover:bg-slate-800 text-slate-300"
                                                        }`}
                                                >
                                                    <TableIcon className={`h-4 w-4 ${isActive ? "text-blue-400" : "text-slate-500"}`} />
                                                    <span className="truncate">{tableName}</span>
                                                </button>
                                            </li>
                                        )
                                    })}
                                </ul>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="h-14 border-b border-slate-800 flex items-center px-6 bg-slate-900/50">
                    {activeTable ? (
                        <h2 className="text-lg font-medium text-slate-100 flex items-center">
                            <TableIcon className="h-5 w-5 mr-2 text-slate-400" />
                            {activeTable.replace(/[\[\]]/g, '')}
                        </h2>
                    ) : (
                        <span className="text-slate-500">Select a table to view data</span>
                    )}
                </div>

                <div className="flex-1 overflow-auto p-6">
                    {!activeTable ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
                            <Database className="h-16 w-16 text-slate-800" />
                            <p>Select a table from the sidebar to explore its rows.</p>
                        </div>
                    ) : isQuerying ? (
                        <div className="h-full flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                        </div>
                    ) : tableData.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-slate-500">
                            <p>No rows found or empty table.</p>
                        </div>
                    ) : (
                        <div className="rounded-md border border-slate-800 overflow-hidden bg-slate-900">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-slate-400 uppercase bg-slate-950 border-b border-slate-800">
                                        <tr>
                                            {Object.keys(tableData[0] || {}).map((key) => (
                                                <th key={key} className="px-4 py-3 font-medium whitespace-nowrap">
                                                    {key}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {tableData.map((row, i) => (
                                            <tr key={i} className="hover:bg-slate-800/50 transition-colors">
                                                {Object.values(row).map((val: any, j) => (
                                                    <td key={j} className="px-4 py-3 whitespace-nowrap text-slate-300">
                                                        {val === null ? (
                                                            <span className="text-slate-600 italic">NULL</span>
                                                        ) : typeof val === 'object' ? (
                                                            JSON.stringify(val)
                                                        ) : String(val)}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
