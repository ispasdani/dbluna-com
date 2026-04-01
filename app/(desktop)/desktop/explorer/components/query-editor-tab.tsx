"use client";

import { useState, useEffect, useRef } from "react";
import Editor, { useMonaco } from "@monaco-editor/react";
import { Play, Download, FileJson, FileText } from "lucide-react";
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

    const monaco = useMonaco();
    const schemaProviderRef = useRef<any>(null);
    const queryRef = useRef(""); // Use ref to safely access current query in shortcuts

    useEffect(() => {
        queryRef.current = query;
    }, [query]);

    useEffect(() => {
        if (monaco && dbName) {
            const fetchSchemaAndRegister = async () => {
                if (typeof window !== "undefined" && (window as any).electron) {
                    try {
                        const res = await (window as any).electron.getSchemaDictionary(dbName);
                        if (res && res.success && res.data) {
                            const dictionary = res.data;
                            
                            if (schemaProviderRef.current) {
                                schemaProviderRef.current.dispose();
                            }
                            
                            schemaProviderRef.current = monaco.languages.registerCompletionItemProvider('sql', {
                                provideCompletionItems: (model: any, position: any) => {
                                    const word = model.getWordUntilPosition(position);
                                    const range = {
                                        startLineNumber: position.lineNumber,
                                        endLineNumber: position.lineNumber,
                                        startColumn: word.startColumn,
                                        endColumn: word.endColumn
                                    };
                                    
                                    const suggestions: any[] = [];
                                    const seen = new Set();
                                    
                                    dictionary.forEach((item: any) => {
                                        if (!seen.has('table_' + item.table_name)) {
                                            seen.add('table_' + item.table_name);
                                            suggestions.push({
                                                label: item.table_name,
                                                kind: monaco.languages.CompletionItemKind.Struct,
                                                insertText: item.table_name,
                                                detail: `Table (${item.schema_name})`,
                                                range: range
                                            });
                                        }
                                        if (!seen.has('col_' + item.column_name)) {
                                            seen.add('col_' + item.column_name);
                                            suggestions.push({
                                                label: item.column_name,
                                                kind: monaco.languages.CompletionItemKind.Field,
                                                insertText: item.column_name,
                                                detail: `Column in ${item.table_name}`,
                                                range: range
                                            });
                                        }
                                    });
                                    
                                    return { suggestions };
                                }
                            });
                        }
                    } catch (e) {
                        console.error("Failed to fetch schema dictionary for intellisense", e);
                    }
                }
            };
            fetchSchemaAndRegister();
            
            return () => {
                if (schemaProviderRef.current) {
                    schemaProviderRef.current.dispose();
                }
            };
        }
    }, [monaco, dbName]);

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

    const handleExportCSV = async (recordset: any[], rsIndex: number) => {
        if (!recordset || recordset.length === 0) return;
        try {
            const filePath = await (window as any).electron.saveFile(`Result_${rsIndex + 1}.csv`, [{ name: 'CSV', extensions: ['csv'] }]);
            if (!filePath) return;
            
            const headers = Object.keys(recordset[0]);
            let csvString = headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(',') + '\n';
            
            for (const row of recordset) {
                const rowValues = headers.map(h => {
                    let val = row[h];
                    if (val === null || val === undefined) return '""';
                    if (typeof val === 'object') val = JSON.stringify(val);
                    const valStr = String(val).replace(/"/g, '""');
                    return `"${valStr}"`;
                });
                csvString += rowValues.join(',') + '\n';
            }
            
            const res = await (window as any).electron.writeTextData(filePath, csvString);
            if (res.success) {
                setMessages(prev => [...prev, `[SYSTEM] Exported Result ${rsIndex + 1} to CSV successfully: ${filePath}`]);
            } else {
                setMessages(prev => [...prev, `[SYSTEM ERROR] Failed to export CSV: ${res.error}`]);
            }
        } catch (e: any) {
            setMessages(prev => [...prev, `[SYSTEM ERROR] Export exception: ${e.message}`]);
        }
    };

    const handleExportJSON = async (recordset: any[], rsIndex: number) => {
        if (!recordset || recordset.length === 0) return;
        try {
            const filePath = await (window as any).electron.saveFile(`Result_${rsIndex + 1}.json`, [{ name: 'JSON', extensions: ['json'] }]);
            if (!filePath) return;
            
            const jsonString = JSON.stringify(recordset, null, 2);
            
            const res = await (window as any).electron.writeTextData(filePath, jsonString);
            if (res.success) {
                setMessages(prev => [...prev, `[SYSTEM] Exported Result ${rsIndex + 1} to JSON successfully: ${filePath}`]);
            } else {
                setMessages(prev => [...prev, `[SYSTEM ERROR] Failed to export JSON: ${res.error}`]);
            }
        } catch (e: any) {
            setMessages(prev => [...prev, `[SYSTEM ERROR] Export exception: ${e.message}`]);
        }
    };

    const handleExecute = async () => {
        const q = queryRef.current;
        if (!q.trim()) return;
        setIsExecuting(true);
        setResults([]);
        setMessages([]);
        setActivePaneTab("messages");
        
        try {
            const res = await (window as any).electron.executeQuery(dbName, q);
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

    const handleEditorMount = (editor: any, monaco: any) => {
        editor.addCommand(monaco.KeyCode.F5, () => {
            handleExecute();
        });
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
            <div className="flex items-center space-x-2 px-4 py-2 border-b border-border bg-sidebar shadow-sm shrink-0">
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleExecute}
                    disabled={isExecuting || isLoading || !query.trim()}
                    className="h-8 text-green-500 border-slate-700 bg-accent hover:bg-slate-700 hover:text-green-400 disabled:opacity-50"
                >
                    <Play className="h-4 w-4 mr-1.5" /> Execute
                </Button>
                <div className="h-4 w-px bg-slate-700 mx-2" />
                <span className="text-xs text-muted-foreground">
                    Database: <strong className="text-foreground">{dbName}</strong>
                </span>
                {isExecuting && (
                    <span className="text-xs text-muted-foreground animate-pulse ml-4 flex items-center">
                        <div className="h-3 w-3 border-2 border-t-blue-500 border-slate-600 rounded-full animate-spin mr-2" />
                        Executing...
                    </span>
                )}
            </div>

            {/* Editor Area */}
            <div className="flex-1 overflow-hidden relative border-b border-border">
                {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-500"></div>
                    </div>
                ) : (
                    <div className="absolute inset-0">
                        <Editor
                            height="100%"
                            defaultLanguage="sql"
                            value={query}
                            theme="light"
                            onChange={(val) => setQuery(val || "")}
                            onMount={handleEditorMount}
                            options={{
                                minimap: { enabled: true },
                                fontSize: 13,
                                fontFamily: "'Consolas', 'Courier New', monospace",
                                wordWrap: 'on',
                                padding: { top: 16 }
                            }}
                        />
                    </div>
                )}
            </div>
            
            {/* Results Pane */}
            <div className="h-64 bg-sidebar flex flex-col shrink-0">
                <div className="flex px-2 pt-2 border-b border-border bg-background">
                    <button 
                        className={cn("px-4 py-1.5 text-xs font-medium border-b-2 transition-colors", activePaneTab === 'results' ? "border-blue-500 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
                        onClick={() => setActivePaneTab('results')}
                    >
                        Results {results.length > 0 && `(${results.length})`}
                    </button>
                    <button 
                        className={cn("px-4 py-1.5 text-xs font-medium border-b-2 transition-colors", activePaneTab === 'messages' ? "border-blue-500 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
                        onClick={() => setActivePaneTab('messages')}
                    >
                        Messages
                    </button>
                </div>
                
                <div className="flex-1 overflow-hidden relative bg-background">
                    {activePaneTab === 'messages' && (
                        <div className="absolute inset-0 p-3 font-mono text-xs overflow-auto">
                            {messages.length === 0 ? (
                                <div className="text-muted-foreground italic">No messages.</div>
                            ) : (
                                messages.map((msg, idx) => (
                                    <div key={idx} className={msg.startsWith('Error') || msg.startsWith('Execution failed') ? "text-red-400" : "text-foreground"}>
                                        {msg}
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                    
                    {activePaneTab === 'results' && (
                        <div className="absolute inset-0 overflow-auto p-2">
                            {results.length === 0 ? (
                                <div className="text-muted-foreground italic text-xs p-2">No results to display.</div>
                            ) : (
                                results.map((recordset, rsIdx) => (
                                    <div key={rsIdx} className="mb-6 border border-border rounded-md overflow-hidden bg-background shadow-sm">
                                        <div className="flex justify-between items-center bg-sidebar px-3 py-1.5 border-b border-border">
                                            <span className="text-xs font-semibold text-muted-foreground">Result {rsIdx + 1} ({recordset.length} rows)</span>
                                            <div className="flex space-x-2">
                                                <Button variant="ghost" size="sm" className="h-6 text-xs px-2 text-muted-foreground hover:text-foreground" onClick={() => handleExportCSV(recordset, rsIdx)}>
                                                    <FileText className="h-3 w-3 mr-1.5" /> CSV
                                                </Button>
                                                <Button variant="ghost" size="sm" className="h-6 text-xs px-2 text-muted-foreground hover:text-foreground" onClick={() => handleExportJSON(recordset, rsIdx)}>
                                                    <FileJson className="h-3 w-3 mr-1.5" /> JSON
                                                </Button>
                                            </div>
                                        </div>
                                        <ScrollArea className="w-full max-h-[400px]">
                                            <Table>
                                                <TableHeader className="bg-sidebar sticky top-0 z-10 border-b border-border">
                                                    <TableRow className="hover:bg-transparent border-none">
                                                        {Object.keys(recordset[0] || {}).map((colName) => (
                                                            <TableHead key={colName} className="text-xs text-muted-foreground h-8 px-4 whitespace-nowrap bg-sidebar shadow-sm border-r border-border/50">
                                                                {colName}
                                                            </TableHead>
                                                        ))}
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {recordset.map((row, rowIdx) => (
                                                        <TableRow key={rowIdx} className="border-border/50 hover:bg-accent/30 transition-colors">
                                                            {Object.values(row).map((val: any, colIdx) => (
                                                                <TableCell key={colIdx} className="whitespace-nowrap text-foreground py-2 px-4 text-xs border-r border-border/50">
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
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
