/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { Database, Table as TableIcon, ArrowLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useRouter } from "next/navigation";

// Sub-component to manage per-tab querying and rendering
function TableDataGrid({ tableName }: { tableName: string }) {
    const [tableData, setTableData] = useState<any[]>([]);
    const [isQuerying, setIsQuerying] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const fetchTableData = async () => {
            if (typeof window !== "undefined" && (window as any).electron) {
                setIsQuerying(true);
                try {
                    const result = await (window as any).electron.queryTable(tableName);
                    if (isMounted) {
                        if (result && result.success) {
                            setTableData(result.data || []);
                        } else {
                            console.error(`Error querying table:`, result?.error);
                            setTableData([]);
                        }
                    }
                } catch (error) {
                    console.error(`Failed to query table ${tableName}`, error);
                    if (isMounted) setTableData([]);
                } finally {
                    if (isMounted) setIsQuerying(false);
                }
            }
        };

        fetchTableData();
        return () => { isMounted = false; };
    }, [tableName]);

    if (isQuerying) {
        return (
            <div className="h-full flex items-center justify-center p-6 bg-slate-950">
                <div className="flex flex-col items-center space-y-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    <p className="text-slate-500 text-sm">Querying {tableName}...</p>
                </div>
            </div>
        );
    }

    if (tableData.length === 0) {
        return (
            <div className="h-full flex items-center justify-center text-slate-500 bg-slate-950">
                <p>No rows found or empty table.</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-slate-950">
            {/* Header info bar */}
            <div className="px-4 py-2 border-b border-slate-800 bg-slate-900/50 flex">
                <span className="text-xs text-slate-400">
                    Showing top {tableData.length} rows
                </span>
            </div>
            {/* Grid Area */}
            <div className="flex-1 overflow-hidden p-4">
                <div className="rounded-md border border-slate-800 bg-slate-900 overflow-hidden h-full flex flex-col">
                    <ScrollArea className="flex-1 w-full">
                        <Table>
                            <TableHeader className="bg-slate-950 sticky top-0 z-10 border-b border-slate-800">
                                <TableRow className="hover:bg-transparent border-none">
                                    {Object.keys(tableData[0] || {}).map((key) => (
                                        <TableHead key={key} className="text-xs text-slate-400 uppercase whitespace-nowrap h-10 px-4">
                                            {key}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tableData.map((row, i) => (
                                    <TableRow key={i} className="border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                        {Object.values(row).map((val: any, j) => (
                                            <TableCell key={j} className="whitespace-nowrap text-slate-300 py-3 px-4">
                                                {val === null ? (
                                                    <span className="text-slate-600 italic">NULL</span>
                                                ) : typeof val === 'object' ? (
                                                    JSON.stringify(val)
                                                ) : String(val)}
                                            </TableCell>
                                        ))}
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

type TabItem = {
    id: string;
    title: string;
    type: 'table' | 'query';
};

export default function DatabaseExplorer() {
    const router = useRouter();
    const [tables, setTables] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [connectionError, setConnectionError] = useState<string | null>(null);

    // Tab state
    const [openTabs, setOpenTabs] = useState<TabItem[]>([]);
    const [activeTabId, setActiveTabId] = useState<string>('');

    useEffect(() => {
        const fetchTables = async () => {
            if (typeof window !== "undefined" && (window as any).electron) {
                try {
                    const config = {
                        server: "localhost",
                        port: 1433,
                        user: "sa",
                        password: "daniel", // Default dev SQL password
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

    const handleOpenTable = (queryName: string, titleName: string) => {
        const exists = openTabs.find(t => t.id === queryName);
        if (!exists) {
            setOpenTabs(prev => [...prev, { id: queryName, title: titleName, type: 'table' }]);
        }
        setActiveTabId(queryName);
    };

    const handleCloseTab = (e: React.MouseEvent, id: string) => {
        e.stopPropagation(); // prevent triggering row selection
        const newTabs = openTabs.filter(t => t.id !== id);
        setOpenTabs(newTabs);
        if (activeTabId === id && newTabs.length > 0) {
            setActiveTabId(newTabs[newTabs.length - 1].id);
        } else if (newTabs.length === 0) {
            setActiveTabId('');
        }
    };

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
        <div className="flex h-screen w-full bg-slate-950 text-slate-300 overflow-hidden">
            {/* @ts-expect-error Shadcn resizable types mismatch */}
            <ResizablePanelGroup direction="horizontal">
                
                {/* Object Explorer Sidebar */}
                <ResizablePanel defaultSize={20} minSize={15} maxSize={40} className="bg-slate-900 border-r border-slate-800 flex flex-col z-10 w-full relative">
                    <div className="p-4 border-b border-slate-800 flex items-center space-x-3 shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => router.push('/desktop')} className="h-8 w-8 text-slate-400 hover:text-white shrink-0">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex items-center space-x-2 truncate">
                            <Database className="h-5 w-5 text-blue-500 shrink-0" />
                            <h2 className="font-semibold text-slate-100 truncate">Object Explorer</h2>
                        </div>
                    </div>

                    <ScrollArea className="flex-1 w-full pl-0">
                        <div className="p-4 space-y-6">
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
                                        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2 flex items-center">
                                            <Database className="h-3 w-3 mr-1.5" />
                                            {schema}
                                        </h3>
                                        <ul className="space-y-1">
                                            {(schemaTables as any[]).map((t) => {
                                                const tableName = t.TABLE_NAME || t.name || 'Unknown Table';
                                                const escapeId = (id: string) => id.replace(/\]/g, ']]');
                                                const queryName = t.TABLE_SCHEMA ? `[${escapeId(t.TABLE_SCHEMA)}].[${escapeId(tableName)}]` : `[${escapeId(tableName)}]`;
                                                const isActive = activeTabId === queryName;

                                                return (
                                                    <li key={queryName}>
                                                        <button
                                                            onClick={() => handleOpenTable(queryName, tableName)}
                                                            className={`w-full flex items-center space-x-2 px-2 py-1.5 rounded-md text-sm transition-colors ${isActive
                                                                ? "bg-blue-600/20 text-blue-400"
                                                                : "hover:bg-slate-800/50 text-slate-300"
                                                                }`}
                                                        >
                                                            <TableIcon className={`h-4 w-4 shrink-0 ${isActive ? "text-blue-400" : "text-slate-500"}`} />
                                                            <span className="truncate text-left">{tableName}</span>
                                                        </button>
                                                    </li>
                                                )
                                            })}
                                        </ul>
                                    </div>
                                ))
                            )}
                        </div>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </ResizablePanel>

                <ResizableHandle className="bg-slate-800" withHandle />

                {/* Main Workspace Area (Tabs) */}
                <ResizablePanel defaultSize={80} className="flex flex-col overflow-hidden bg-slate-950 relative w-full h-full">
                    {openTabs.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
                            <Database className="h-16 w-16 text-slate-800" />
                            <p>Select a table from the Object Explorer to view its data.</p>
                        </div>
                    ) : (
                        <Tabs value={activeTabId} onValueChange={setActiveTabId} className="flex-1 flex flex-col min-h-0 min-w-0">
                            <div className="border-b border-slate-800 bg-[#0f111a] pt-2 px-0 flex items-center shrink-0 w-full overflow-hidden">
                                <ScrollArea className="w-full flex-1">
                                    <TabsList className="bg-transparent h-9 p-0 justify-start gap-1 w-max px-2">
                                        {openTabs.map(tab => (
                                            <TabsTrigger 
                                                key={tab.id} 
                                                value={tab.id}
                                                className="group h-9 px-3 rounded-t-md rounded-b-none border border-transparent data-[state=active]:bg-slate-900 data-[state=active]:border-slate-800 data-[state=active]:border-b-slate-900 text-slate-400 data-[state=active]:text-slate-100 min-w-[140px] flex items-center justify-between shadow-none mb-[-1px] z-10"
                                            >
                                                <div className="flex items-center space-x-2 truncate pr-4">
                                                    {tab.type === 'table' && <TableIcon className="h-4 w-4 shrink-0 text-blue-500" />}
                                                    <span className="truncate text-xs font-medium">{tab.title.replace(/[\[\]]/g, '')}</span>
                                                </div>
                                                <button 
                                                    onClick={(e) => handleCloseTab(e, tab.id)}
                                                    className="opacity-0 group-hover:opacity-100 hover:bg-slate-700/50 rounded-sm p-0.5 text-slate-400 hover:text-white transition-all shrink-0"
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </button>
                                            </TabsTrigger>
                                        ))}
                                    </TabsList>
                                    <ScrollBar orientation="horizontal" className="h-1.5" />
                                </ScrollArea>
                            </div>
                            
                            <div className="flex-1 overflow-hidden relative w-full bg-slate-900">
                                {openTabs.map(tab => (
                                    <TabsContent 
                                        key={tab.id} 
                                        value={tab.id} 
                                        className="h-full m-0 p-0 absolute inset-0 focus-visible:outline-none"
                                        forceMount={true}
                                        style={{ display: activeTabId === tab.id ? 'flex' : 'none', flexDirection: 'column' }}
                                    >
                                        {/* Using generic data grid for table view */}
                                        <TableDataGrid tableName={tab.id} />
                                    </TabsContent>
                                ))}
                            </div>
                        </Tabs>
                    )}
                </ResizablePanel>
                
            </ResizablePanelGroup>
        </div>
    );
}
