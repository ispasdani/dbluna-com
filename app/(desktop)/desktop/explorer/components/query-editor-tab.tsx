"use client";

import { useState, useEffect } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QueryEditorTabProps {
    dbName: string;
    schemaName: string;
    tableName: string;
    initialMode?: "script-create" | "empty";
}

export function QueryEditorTab({ dbName, schemaName, tableName, initialMode = "empty" }: QueryEditorTabProps) {
    const [query, setQuery] = useState("");
    const [isLoading, setIsLoading] = useState(initialMode !== "empty");

    useEffect(() => {
        if (initialMode === "script-create") {
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

    return (
        <div className="h-full flex flex-col bg-[#1e1e1e]">
            {/* Toolbar */}
            <div className="flex items-center space-x-2 px-4 py-2 border-b border-slate-800 bg-slate-900 shadow-sm shrink-0">
                <Button variant="outline" size="sm" className="h-8 text-green-500 border-slate-700 bg-slate-800 hover:bg-slate-700 hover:text-green-400">
                    <Play className="h-4 w-4 mr-1.5" /> Execute
                </Button>
                <div className="h-4 w-px bg-slate-700 mx-2" />
                <span className="text-xs text-slate-400">
                    Database: <strong className="text-slate-300">{dbName}</strong>
                </span>
            </div>

            {/* Editor Area */}
            <div className="flex-1 overflow-hidden relative">
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
            
            {/* Results Pane placeholder (for later steps) */}
            <div className="h-32 border-t border-slate-800 bg-slate-900/50 p-2 overflow-hidden flex flex-col shrink-0 text-slate-500 text-xs">
                 <div className="px-2 py-1 border-b border-slate-800/50 font-medium pb-2 select-none">Messages</div>
                 <div className="flex-1 p-2 font-mono overflow-auto">
                     {query ? 'Command(s) completed successfully.' : 'Ready.'}
                 </div>
            </div>
        </div>
    );
}
