"use client";

import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ExportBacpacDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sourceDbName: string | null;
}

export function ExportBacpacDialog({ open, onOpenChange, sourceDbName }: ExportBacpacDialogProps) {
    const [targetFile, setTargetFile] = useState<string | null>(null);
    const [sourceServer, setSourceServer] = useState<string>("localhost, 1433");
    const [logs, setLogs] = useState<string[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    const [exportSuccess, setExportSuccess] = useState(false);
    const logsEndRef = useRef<HTMLDivElement>(null);

    const handleSelectFile = async () => {
        if (typeof window !== "undefined" && (window as any).electron) {
            const defaultName = sourceDbName ? `${sourceDbName}_export.bacpac` : "export.bacpac";
            const selectedPath = await (window as any).electron.saveBacpacFile(defaultName);
            if (selectedPath) {
                setTargetFile(selectedPath);
            }
        } else {
            alert("Electron environment not detected. Running in web mode.");
        }
    };

    const handleRunExport = async () => {
        if (!targetFile || !sourceDbName) {
            alert("Please select a target file path and ensure a source database is selected.");
            return;
        }

        if (typeof window !== "undefined" && (window as any).electron) {
            setIsRunning(true);
            setExportSuccess(false);
            setLogs([]); // Clear previous logs

            // Listen for logs
            (window as any).electron.onLog((log: string) => {
                setLogs((prev) => [...prev, log]);
            });

            // Start export
            const success = await (window as any).electron.runExport(sourceServer, sourceDbName, targetFile);

            // Stop listening
            (window as any).electron.removeLogListener();
            setIsRunning(false);

            if (success) {
                setLogs((prev) => [...prev, "\n[SYSTEM] Export successful! Data-tier application saved."]);
                setExportSuccess(true);
            } else {
                setLogs((prev) => [...prev, "\n[SYSTEM ERROR] Export failed or exited with an error."]);
            }
        }
    };

    useEffect(() => {
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [logs]);

    // Reset state when dialog opens
    useEffect(() => {
        if (open) {
            setTargetFile(null);
            setSourceServer("localhost, 1433");
            setLogs([]);
            setIsRunning(false);
            setExportSuccess(false);
        }
    }, [open]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] bg-sidebar border-border text-foreground p-0 overflow-hidden flex flex-col max-h-[80vh]">
                <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
                    <DialogTitle className="text-xl font-semibold text-foreground">Export Data-tier Application (BACPAC)</DialogTitle>
                </DialogHeader>

                <div className="p-6 flex flex-col space-y-6 overflow-y-auto">
                    <div className="flex flex-col space-y-2">
                        <span className="text-sm font-medium text-muted-foreground">Source SQL Server</span>
                        <input
                            type="text"
                            value={sourceServer}
                            onChange={(e) => setSourceServer(e.target.value)}
                            disabled={isRunning}
                            className="bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-slate-700"
                            placeholder="e.g. localhost, 1433"
                        />
                    </div>

                    <div className="flex flex-col space-y-2">
                        <span className="text-sm font-medium text-muted-foreground">Source Database</span>
                        <input
                            type="text"
                            value={sourceDbName || ""}
                            disabled={true}
                            className="bg-background border border-border rounded-md px-3 py-2 text-sm text-muted-foreground focus:outline-none opacity-80 cursor-not-allowed"
                            placeholder="Select a database from Object Explorer"
                        />
                    </div>

                    <div className="flex flex-col space-y-2">
                        <span className="text-sm font-medium text-muted-foreground">Save to (.bacpac)</span>
                        <div className="flex items-center space-x-4">
                            <Button onClick={handleSelectFile} variant="secondary" disabled={isRunning}>
                                Browse...
                            </Button>
                            <span className="text-sm text-foreground font-mono bg-background px-3 py-1 rounded-md border border-border flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                                {targetFile ? targetFile : "No path selected"}
                            </span>
                        </div>
                    </div>

                    <Button
                        onClick={handleRunExport}
                        disabled={!targetFile || !sourceDbName || isRunning}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        {isRunning ? "Running Export..." : "Execute Export"}
                    </Button>

                    {/* Terminal Window for Logs */}
                    <div className="flex border-t border-border pt-6">
                        <div className="w-full h-[200px] flex flex-col bg-background border border-border rounded-lg overflow-hidden shrink-0">
                            <div className="bg-sidebar px-3 py-1.5 border-b border-border flex items-center shrink-0">
                                <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">Console Output</span>
                            </div>
                            <div className="flex-1 p-3 overflow-y-auto font-mono text-xs text-foreground whitespace-pre-wrap">
                                {logs.length === 0 ? (
                                    <span className="text-muted-foreground italic">Logs will appear here when an export is running...</span>
                                ) : (
                                    logs.map((log, i) => (
                                        <span key={i} className="block leading-relaxed">{log}</span>
                                    ))
                                )}
                                <div ref={logsEndRef} />
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
