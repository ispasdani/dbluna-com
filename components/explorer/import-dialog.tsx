"use client";

import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ImportBacpacDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ImportBacpacDialog({ open, onOpenChange }: ImportBacpacDialogProps) {
    const [file, setFile] = useState<string | null>(null);
    const [targetServer, setTargetServer] = useState<string>("localhost, 1433");
    const [targetDb, setTargetDb] = useState<string>("");
    const [logs, setLogs] = useState<string[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    const [importSuccess, setImportSuccess] = useState(false);
    const logsEndRef = useRef<HTMLDivElement>(null);

    const handleSelectFile = async () => {
        if (typeof window !== "undefined" && (window as any).electron) {
            const selectedPath = await (window as any).electron.openBacpacFile();
            if (selectedPath) {
                setFile(selectedPath);
            }
        } else {
            alert("Electron environment not detected. Running in web mode.");
        }
    };

    const handleRunImport = async () => {
        if (!file) {
            alert("Please select a .bacpac file first.");
            return;
        }

        if (typeof window !== "undefined" && (window as any).electron) {
            setIsRunning(true);
            setImportSuccess(false);
            setLogs([]); // Clear previous logs

            // Listen for logs
            (window as any).electron.onLog((log: string) => {
                setLogs((prev) => [...prev, log]);
            });

            // Start import
            const success = await (window as any).electron.runImport(file, targetServer, targetDb);

            setIsRunning(false);

            if (success) {
                setLogs((prev) => [...prev, "\n[SYSTEM] Import successful! Data-tier application restored."]);
                setImportSuccess(true);
            } else {
                setLogs((prev) => [...prev, "\n[SYSTEM ERROR] Import failed or exited with an error."]);
            }

            // Stop listening after a short delay
            setTimeout(() => {
                if (typeof window !== "undefined" && (window as any).electron) {
                    (window as any).electron.removeLogListener();
                }
            }, 500);
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
            setFile(null);
            setTargetServer("localhost, 1433");
            setTargetDb("");
            setLogs([]);
            setIsRunning(false);
            setImportSuccess(false);
        }
    }, [open]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] bg-sidebar border-border text-foreground p-0 overflow-hidden flex flex-col max-h-[80vh]">
                <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
                    <DialogTitle className="text-xl font-semibold text-foreground">Import BACPAC</DialogTitle>
                </DialogHeader>

                <div className="p-6 flex flex-col space-y-6 overflow-y-auto">
                    <div className="flex flex-col space-y-2">
                        <span className="text-sm font-medium text-muted-foreground">Target File (.bacpac)</span>
                        <div className="flex items-center space-x-4">
                            <Button onClick={handleSelectFile} variant="secondary" disabled={isRunning}>
                                Select .bacpac
                            </Button>
                            <span className="text-sm text-foreground font-mono bg-background px-3 py-1 rounded-md border border-border flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                                {file ? file : "No file selected"}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col space-y-2">
                        <span className="text-sm font-medium text-muted-foreground">Target SQL Server</span>
                        <input
                            type="text"
                            value={targetServer}
                            onChange={(e) => setTargetServer(e.target.value)}
                            disabled={isRunning}
                            className="bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-slate-700"
                            placeholder="e.g. localhost, 1433"
                        />
                    </div>

                    <div className="flex flex-col space-y-2">
                        <span className="text-sm font-medium text-muted-foreground">Target Database Name</span>
                        <input
                            type="text"
                            value={targetDb}
                            onChange={(e) => setTargetDb(e.target.value)}
                            disabled={isRunning}
                            className="bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-slate-700"
                            placeholder="Leaves empty for auto-generated name..."
                        />
                    </div>

                    <Button
                        onClick={handleRunImport}
                        disabled={!file || isRunning}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        {isRunning ? "Running Import..." : "Execute Import"}
                    </Button>

                    {/* Terminal Window for Logs */}
                    <div className="flex border-t border-border pt-6">
                        <div className="w-full h-[200px] flex flex-col bg-background border border-border rounded-lg overflow-hidden shrink-0">
                            <div className="bg-sidebar px-3 py-1.5 border-b border-border flex items-center shrink-0">
                                <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">Console Output</span>
                            </div>
                            <div className="flex-1 p-3 overflow-y-auto font-mono text-xs text-foreground whitespace-pre-wrap">
                                {logs.length === 0 ? (
                                    <span className="text-muted-foreground italic">Logs will appear here when an import is running...</span>
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
