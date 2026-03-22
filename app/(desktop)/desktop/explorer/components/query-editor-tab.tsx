"use client";

import { useState, useEffect } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";
import { Play } from "lucide-react";
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
import { cn } from "@/lib/utils";

interface QueryEditorTabProps {
    dbName: string;
    schemaName?: string;
    tableName?: string;
    initialMode?: "script-create" | "empty";
}

export function QueryEditorTab({ dbName, schemaName, tableName, initialMode = "empty" }: QueryEditorTabProps) {
    const [query, setQuery] = useState("");
    const [isLoading, setIsLoading] = useState(initialMode !== "empty");
    const [isExecuting, setIsExecuting] = useState(false);
    
    // Execution state
    const [results, setResults] = useState<any[][]>([]);
    const [messages, setMessages] = useState<string[]>([]);
    const [activePaneTab, setActivePaneTab] = useState<"results" | "messages">("messages");

    useEffect(() => {
        if (initialMode === "script-create" && schemaName && tableName) {
            const generateCreateScript = async () => {
                if (typeof window !== "undefined" && (window as any).electron) {
                    try {
                        const result = await (window as any).electron.getTableSchema(dbName, schemaName, tableName);
                        if (result && result.success && result.data) {
                            const columns = result.data;
                            let script = `CREATE TABLE [${schemaName}].[${tableName}] (\n`;
                            const colDefs = columns.map((col: any) => {
                                let def = `    [${col.COLUMN_NAME}] ${col.DATA_TYPE}`;
                                if (['varchar', 'nvarchar', 'char', 'nchar'].includes(col.DATA_TYPE)) {
                                    def += `(${col.CHARACTER_MAXIMUM_LENGTH === -1 ? 'MAX' : col.CHARACTER_MAXIMUM_LENGTH})`;
                                }
                                def += col.IS_NULLABLE === 'YES' ? ' NULL' : ' NOT NULL';
                                return def;
                            });
                            script += colDefs.join(",\n");
                            script += "\n);\nGO";
                            setQuery(script);
                        } else {
                            setQuery(`-- Failed to load schema for ${schemaName}.${tableName}\n-- ${result?.error || 'Unknown error'}`);
                        }
                    } catch (error: any) {
                        setQuery(`-- Error generating script: ${error.message}`);
                    } finally {
                        setIsLoading(false);
                    }
                }
            };
            generateCreateScript();
        }
    }, [dbName, schemaName, tableName, initialMode]);

    const handleExecute = async () => {
        if (!query.trim()) return;
        setIsExecuting(true);
        setResults([]);
        setMessages([]);
        setActivePaneTab("messages");
        
        try {
            const res = await (window as any).electron.executeQuery(dbName, query);
            if (res.success) {
                const newMsgs: string[] = [];
                if (res.rowsAffected && res.rowsAffected.length > 0) {
                    res.rowsAffected.forEach((rowCount: number) => {
                        newMsgs.push(`(${rowCount} row(s) affected)`);
                    });
                }
                newMsgs.push('Command(s) completed successfully.');
                setMessages(newMsgs);
                
                if (res.recordsets && res.recordsets.length > 0 && res.recordsets[0].length > 0) {
                    setResults(res.recordsets);
                    setActivePaneTab("results");
                }
            } else {
                setMessages([`Error: ${res.error}`]);
            }
        } catch (error: any) {
            setMessages([`Execution failed: ${error.message}`]);
        } finally {
            setIsExecuting(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'F5') {
            e.preventDefault();
            handleExecute();
        }
    };

    return (
        <div className="h-full flex flex-col bg-[#1e1e1e]" onKeyDown={handleKeyDown}>
            {/* Toolbar */}
            <div className="flex items-center space-x-2 px-4 py-2 border-b border-slate-800 bg-slate-900 shadow-sm shrink-0">
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleExecute}
                    disabled={isExecuting || isLoading || !query.trim()}
                    className="h-8 text-green-500 border-slate-700 bg-slate-800 hover:bg-slate-700 hover:text-green-400 disabled:opacity-50"
                >
                    <Play className="h-4 w-4 mr-1.5" /> Execute
                </Button>
                <div className="h-4 w-px bg-slate-700 mx-2" />
                <span className="text-xs text-slate-400">
                    Database: <strong className="text-slate-300">{dbName}</strong>
                </span>
                {isExecuting && (
                    <span className="text-xs text-slate-400 animate-pulse ml-4 flex items-center">
                        <div className="h-3 w-3 border-2 border-t-blue-500 border-slate-600 rounded-full animate-spin mr-2" />
                        Executing...
                    </span>
                )}
            </div>

            {/* Editor Area */}
            <div className="flex-1 overflow-hidden relative border-b border-slate-800">
                {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-500"></div>
                    </div>
                ) : (
                    <div className="absolute inset-0 overflow-auto">
                        <CodeMirror
                            value={query}
                            height="100%"
                            theme="dark"
                            extensions={[sql()]}
                            onChange={(val) => setQuery(val)}
                            className="text-sm h-full font-mono"
                        />
                    </div>
                )}
            </div>
            
            {/* Results Pane */}
            <div className="h-64 bg-slate-900 flex flex-col shrink-0">
                <div className="flex px-2 pt-2 border-b border-slate-800 bg-[#0f111a]">
                    <button 
                        className={cn("px-4 py-1.5 text-xs font-medium border-b-2 transition-colors", activePaneTab === 'results' ? "border-blue-500 text-slate-100" : "border-transparent text-slate-500 hover:text-slate-300")}
                        onClick={() => setActivePaneTab('results')}
                    >
                        Results {results.length > 0 && `(${results.length})`}
                    </button>
                    <button 
                        className={cn("px-4 py-1.5 text-xs font-medium border-b-2 transition-colors", activePaneTab === 'messages' ? "border-blue-500 text-slate-100" : "border-transparent text-slate-500 hover:text-slate-300")}
                        onClick={() => setActivePaneTab('messages')}
                    >
                        Messages
                    </button>
                </div>
                
                <div className="flex-1 overflow-hidden relative bg-slate-950">
                    {activePaneTab === 'messages' && (
                        <div className="absolute inset-0 p-3 font-mono text-xs overflow-auto">
                            {messages.length === 0 ? (
                                <div className="text-slate-600 italic">No messages.</div>
                            ) : (
                                messages.map((msg, idx) => (
                                    <div key={idx} className={msg.startsWith('Error') || msg.startsWith('Execution failed') ? "text-red-400" : "text-slate-300"}>
                                        {msg}
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                    
                    {activePaneTab === 'results' && (
                        <div className="absolute inset-0 overflow-auto p-2">
                            {results.length === 0 ? (
                                <div className="text-slate-600 italic text-xs p-2">No results to display.</div>
                            ) : (
                                results.map((recordset, rsIdx) => (
                                    <div key={rsIdx} className="mb-6 border border-slate-800 rounded-md overflow-hidden">
                                        <ScrollArea className="w-full max-h-[400px]">
                                            <Table>
                                                <TableHeader className="bg-slate-900 sticky top-0 z-10 border-b border-slate-800">
                                                    <TableRow className="hover:bg-transparent border-none">
                                                        {Object.keys(recordset[0] || {}).map((colName) => (
                                                            <TableHead key={colName} className="text-xs text-slate-400 h-8 px-4 whitespace-nowrap bg-slate-900 shadow-sm border-r border-slate-800/50">
                                                                {colName}
                                                            </TableHead>
                                                        ))}
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {recordset.map((row, rowIdx) => (
                                                        <TableRow key={rowIdx} className="border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                                            {Object.values(row).map((val: any, colIdx) => (
                                                                <TableCell key={colIdx} className="whitespace-nowrap text-slate-300 py-2 px-4 text-xs border-r border-slate-800/50">
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
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
