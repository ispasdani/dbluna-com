/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { Database, Table as TableIcon, ArrowLeft, X, Server, Plug, Upload } from "lucide-react";
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
import { ObjectExplorerTree, type DbObjectNode } from "./explorer/object-explorer-tree";
import { SchemaViewerGrid } from "./explorer/schema-viewer-grid";
import { QueryEditorTab } from "./explorer/query-editor-tab";
import { useConnectionStore } from "@/store/connection";
import { ConnectToServerDialog } from "./explorer/connect-dialog";
import { ImportBacpacDialog } from "./explorer/import-dialog";
import { ExportBacpacDialog } from "./explorer/export-dialog";
import { useViewStore } from "@/store/useViewStore";

// Sub-component to manage per-tab querying and rendering
function TableDataGrid({ dbName, tableName }: { dbName: string, tableName: string }) {
    const [tableData, setTableData] = useState<any[]>([]);
    const [isQuerying, setIsQuerying] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const fetchTableData = async () => {
            if (typeof window !== "undefined" && (window as any).electron) {
                setIsQuerying(true);
                try {
                    const result = await (window as any).electron.queryTable(dbName, tableName);
                    if (isMounted) {
                        if (result && result.success) {
                            setTableData(result.data || []);
                        } else {
                            console.error(`Error querying table:`, result?.error);
                            setTableData([]);
                            
                            // Check for fatal connection dropped errors
                            const errMsg = (result?.error || "").toLowerCase();
                            if (errMsg.includes("not connected") || errMsg.includes("connection is closed") || errMsg.includes("no active database")) {
                                useConnectionStore.getState().clearConnection();
                            }
                        }
                    }
                } catch (error: any) {
                    console.error(`Failed to query table ${tableName}`, error);
                    if (isMounted) {
                        setTableData([]);
                        const errMsg = (error?.message || "").toLowerCase();
                        if (errMsg.includes("not connected") || errMsg.includes("connection is closed") || errMsg.includes("no active database")) {
                            useConnectionStore.getState().clearConnection();
                        }
                    }
                } finally {
                    if (isMounted) setIsQuerying(false);
                }
            }
        };

        fetchTableData();
        return () => { isMounted = false; };
    }, [tableName, dbName]);

    if (isQuerying) {
        return (
            <div className="h-full flex items-center justify-center p-6 bg-background">
                <div className="flex flex-col items-center space-y-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    <p className="text-muted-foreground text-sm">Querying {tableName}...</p>
                </div>
            </div>
        );
    }

    if (tableData.length === 0) {
        return (
            <div className="h-full flex items-center justify-center text-muted-foreground bg-background">
                <p>No rows found or empty table.</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-background">
            {/* Header info bar */}
            <div className="px-4 py-2 border-b border-border bg-muted/50 flex">
                <span className="text-xs text-muted-foreground">
                    Showing top {tableData.length} rows
                </span>
            </div>
            {/* Grid Area */}
            <div className="flex-1 overflow-hidden p-4">
                <div className="rounded-md border border-border bg-sidebar overflow-hidden h-full flex flex-col">
                    <ScrollArea className="flex-1 w-full">
                        <Table>
                            <TableHeader className="bg-background sticky top-0 z-10 border-b border-border">
                                <TableRow className="hover:bg-transparent border-none">
                                    {Object.keys(tableData[0] || {}).map((key) => (
                                        <TableHead key={key} className="text-[11px] text-muted-foreground uppercase whitespace-nowrap h-8 px-2 bg-sidebar border-r border-border last:border-r-0">
                                            {key}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tableData.map((row, i) => (
                                    <TableRow key={i} className="border-border/50 hover:bg-accent/30 transition-colors">
                                        {Object.values(row).map((val: any, j) => (
                                            <TableCell key={j} className="whitespace-nowrap text-foreground py-1 px-2 text-[13px] leading-tight border-r border-border/50 last:border-r-0">
                                                {val === null ? (
                                                    <span className="text-muted-foreground italic">NULL</span>
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
    dbName: string;
    schemaName?: string;
    tableName?: string;
    queryName: string;
    title: string;
    type: 'table' | 'query' | 'design';
    initialMode?: "script-create" | "script-select" | "empty";
    objectType?: 'table' | 'view' | 'procedure';
};

export default function DatabaseExplorer() {
    const router = useRouter();
    const connectionConfig = useConnectionStore(state => state.connectionConfig);
    const setConnectionConfig = useConnectionStore(state => state.setConnectionConfig);

    const [showConnectDialog, setShowConnectDialog] = useState(false);
    const [showImportDialog, setShowImportDialog] = useState(false);
    const [showExportDialog, setShowExportDialog] = useState(false);
    const [exportSourceDb, setExportSourceDb] = useState<string | null>(null);

    const setWorkspaceMode = useViewStore(state => state.setWorkspaceMode);

    // Tab state
    const [openTabs, setOpenTabs] = useState<TabItem[]>([]);
    const [activeTabId, setActiveTabId] = useState<string>('');

    useEffect(() => {
        let isMounted = true;

        const handleAutoConnect = async () => {
            if (!connectionConfig) {
                let autoConnected = false;
                try {
                    const saved = localStorage.getItem("dbviewer_recent_connections");
                    if (saved) {
                        const parsed = JSON.parse(saved);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            const profile = parsed[0];
                            // Only auto-connect for Windows Auth since we don't store passwords for SQL Auth yet
                            if (profile.authenticationMode === "windows") {
                                if (typeof window !== "undefined" && (window as any).electron) {
                                    const config = {
                                        server: profile.server,
                                        port: 1433,
                                        options: { encrypt: false, trustServerCertificate: true }
                                    };
                                    const result = await (window as any).electron.connectDb(config);
                                    if (result && result.success && isMounted) {
                                        setConnectionConfig({ ...config, authenticationMode: "windows" });
                                        autoConnected = true;
                                    }
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error("Auto-connect failed:", e);
                }
                
                if (isMounted && !autoConnected) {
                    setShowConnectDialog(true);
                }
            }
        };
        
        handleAutoConnect();

        return () => {
            isMounted = false;
        };
    }, [connectionConfig, setConnectionConfig]);

    const handleDisconnect = () => {
        setConnectionConfig(null);
        setOpenTabs([]);
        setActiveTabId('');
    };

    const handleTreeAction = (action: 'select' | 'design' | 'script-create' | 'script-select' | 'new-query' | 'export-bacpac', node: DbObjectNode) => {
        if (!node.dbName || !node.name) return;

        if (action === 'export-bacpac') {
            setExportSourceDb(node.dbName);
            setShowExportDialog(true);
            return;
        }

        let schemaName = '';
        let tableNameOnly = '';
        let queryName = '';

        if (action !== 'new-query') {
            schemaName = node.schemaName || node.name.split('.')[0];
            tableNameOnly = node.name.split('.').slice(1).join('.');
            queryName = `[${schemaName}].[${tableNameOnly}]`;
        }

        const actionId = action === 'new-query' ? Date.now().toString() : queryName;
        const tabId = `${action}::${node.dbName}::${actionId}`;
        const exists = openTabs.find(t => t.id === tabId);

        if (!exists) {
            let title = node.name;
            let type: TabItem['type'] = 'table';
            let initialMode: TabItem['initialMode'];

            if (action === 'select') {
                title = `${node.name} - Top 1000`;
                type = 'table';
            } else if (action === 'design') {
                title = `${node.name} - Design`;
                type = 'design';
            } else if (action === 'script-create') {
                title = `SQLQuery - ${node.name}`;
                type = 'query';
                initialMode = 'script-create';
            } else if (action === 'script-select') {
                title = `SQLQuery - ${node.name}`;
                type = 'query';
                initialMode = 'script-select';
            } else if (action === 'new-query') {
                title = `SQLQuery - ${node.dbName}`;
                type = 'query';
                initialMode = 'empty';
            }

            setOpenTabs(prev => [...prev, {
                id: tabId,
                dbName: node.dbName!,
                schemaName,
                tableName: tableNameOnly,
                queryName,
                title,
                type,
                initialMode,
                objectType: (node.type === 'table' || node.type === 'view' || node.type === 'procedure') ? node.type : undefined
            }]);
        }
        setActiveTabId(tabId);
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

    return (
        <div className="flex w-full h-full bg-background text-foreground overflow-hidden">
            {/* @ts-expect-error Shadcn resizable types mismatch */}
            <ResizablePanelGroup direction="horizontal">

                {/* Object Explorer Sidebar */}
                <ResizablePanel defaultSize={20} minSize={15} className="bg-sidebar border-r border-border flex flex-col z-10 w-full relative">
                    <div className="p-3 border-b border-border flex flex-col space-y-2 shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <Button variant="ghost" size="icon" onClick={() => setWorkspaceMode('diagram')} className="h-7 w-7 text-muted-foreground hover:text-white shrink-0">
                                    <ArrowLeft className="h-4 w-4" />
                                </Button>
                                <h2 className="font-semibold text-foreground text-sm truncate">Object Explorer</h2>
                            </div>
                            <div className="flex space-x-1">
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => setShowImportDialog(true)} 
                                    className="h-7 w-7 text-muted-foreground hover:text-white shrink-0" 
                                    title="Import BACPAC"
                                >
                                    <Upload className="h-4 w-4" />
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => setShowConnectDialog(true)} 
                                    className="h-7 w-7 text-muted-foreground hover:text-white shrink-0" 
                                    title="Connect to Object Explorer"
                                >
                                    <Plug className="h-4 w-4 text-green-500" />
                                </Button>
                                {connectionConfig && (
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        onClick={handleDisconnect} 
                                        className="h-7 w-7 text-muted-foreground hover:text-red-400 shrink-0" 
                                        title="Disconnect"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>

                    <ScrollArea className="flex-1 w-full pl-0">
                        <div className="flex-1 h-full w-full">
                            {!connectionConfig ? (
                                <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 h-full text-muted-foreground mt-10">
                                    <Server className="h-10 w-10 text-muted-foreground" />
                                    <p className="text-sm">Not connected to any server</p>
                                    <Button size="sm" onClick={() => setShowConnectDialog(true)} className="bg-blue-600 hover:bg-blue-500 text-white mt-2 h-8">
                                        Connect...
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex flex-col h-full w-full">
                                    {/* Root Node Header */}
                                    <div className="flex items-center px-1.5 py-0.5 space-x-1 hover:bg-accent/50 cursor-default select-none group border-b border-transparent">
                                        <Server className="w-3.5 h-3.5 text-green-500 shrink-0" />
                                        <span className="text-[13px] font-medium text-foreground truncate py-0.5">
                                            {connectionConfig.server} ({connectionConfig.user ? connectionConfig.user : 'Windows Auth'})
                                        </span>
                                    </div>
                                    <div className="pl-4">
                                        <ObjectExplorerTree
                                            onNodeDoubleClick={(node) => handleTreeAction('select', node)}
                                            onNodeAction={handleTreeAction}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </ResizablePanel>

                <ResizableHandle className="w-1 bg-accent hover:bg-blue-500 data-[panel-group-direction=vertical]:h-1 data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=horizontal]:w-1 data-[panel-group-direction=horizontal]:h-full transition-colors cursor-col-resize" withHandle />

                {/* Main Workspace Area (Tabs) */}
                <ResizablePanel defaultSize={80} className="flex flex-col overflow-hidden bg-background relative w-full h-full">
                    {openTabs.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-4">
                            <Database className="h-16 w-16 text-muted-foreground" />
                            <p>Select a table from the Object Explorer to view its data.</p>
                        </div>
                    ) : (
                        <Tabs value={activeTabId} onValueChange={setActiveTabId} className="flex-1 flex flex-col min-h-0 min-w-0">
                            <div className="border-b border-border bg-background pt-2 px-0 flex items-center shrink-0 w-full overflow-hidden">
                                <ScrollArea className="w-full flex-1">
                                    <TabsList className="bg-transparent h-9 p-0 justify-start gap-1 w-max px-2">
                                        {openTabs.map(tab => (
                                            <TabsTrigger
                                                key={tab.id}
                                                value={tab.id}
                                                className="group h-9 px-3 rounded-t-md rounded-b-none border border-transparent data-[state=active]:bg-sidebar data-[state=active]:border-border data-[state=active]:border-b-slate-900 text-muted-foreground data-[state=active]:text-foreground min-w-[140px] flex items-center justify-between shadow-none mb-[-1px] z-10"
                                            >
                                                <div className="flex items-center space-x-2 truncate pr-4">
                                                    {tab.type === 'table' && <TableIcon className="h-4 w-4 shrink-0 text-blue-500" />}
                                                    {tab.type === 'design' && <Database className="h-4 w-4 shrink-0 text-purple-500" />}
                                                    {tab.type === 'query' && <Database className="h-4 w-4 shrink-0 text-yellow-500" />}
                                                    <span className="truncate text-xs font-medium">{tab.title.replace(/[\[\]]/g, '')}</span>
                                                </div>
                                                <div
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={(e) => handleCloseTab(e as any, tab.id)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            handleCloseTab(e as any, tab.id);
                                                        }
                                                    }}
                                                    className="opacity-0 group-hover:opacity-100 hover:bg-accent rounded-sm p-0.5 text-muted-foreground hover:text-white transition-all shrink-0 cursor-pointer"
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </div>
                                            </TabsTrigger>
                                        ))}
                                    </TabsList>
                                    <ScrollBar orientation="horizontal" className="h-1.5" />
                                </ScrollArea>
                            </div>

                            <div className="flex-1 overflow-hidden relative w-full bg-sidebar">
                                {openTabs.map(tab => (
                                    <TabsContent
                                        key={tab.id}
                                        value={tab.id}
                                        className="h-full m-0 p-0 absolute inset-0 focus-visible:outline-none"
                                        forceMount={true}
                                        style={{ display: activeTabId === tab.id ? 'flex' : 'none', flexDirection: 'column' }}
                                    >
                                        {tab.type === 'table' && (
                                            <TableDataGrid dbName={tab.dbName} tableName={tab.queryName} />
                                        )}
                                        {tab.type === 'design' && tab.schemaName && tab.tableName && (
                                            <SchemaViewerGrid dbName={tab.dbName} schemaName={tab.schemaName} tableName={tab.tableName} />
                                        )}
                                        {tab.type === 'query' && (
                                            <QueryEditorTab dbName={tab.dbName} schemaName={tab.schemaName} tableName={tab.tableName} initialMode={tab.initialMode} objectType={tab.objectType} />
                                        )}
                                    </TabsContent>
                                ))}
                            </div>
                        </Tabs>
                    )}
                </ResizablePanel>

                <ConnectToServerDialog 
                    open={showConnectDialog} 
                    onOpenChange={setShowConnectDialog}
                    onConnected={() => setShowConnectDialog(false)}
                />
                <ImportBacpacDialog 
                    open={showImportDialog} 
                    onOpenChange={setShowImportDialog} 
                />
                <ExportBacpacDialog
                    open={showExportDialog}
                    onOpenChange={setShowExportDialog}
                    sourceDbName={exportSourceDb}
                />
            </ResizablePanelGroup>
        </div>
    );
}
