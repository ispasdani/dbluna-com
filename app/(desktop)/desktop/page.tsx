"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function DesktopDashboard() {
    const [file, setFile] = useState<string | null>(null);
    const [targetServer, setTargetServer] = useState<string>("localhost, 1433");
    const [logs, setLogs] = useState<string[]>([]);
    const [isRunning, setIsRunning] = useState(false);
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
            setLogs([]); // Clear previous logs

            // Listen for logs
            (window as any).electron.onLog((log: string) => {
                setLogs((prev) => [...prev, log]);
            });

            // Start import
            const success = await (window as any).electron.runImport(file, targetServer);

            // Stop listening
            (window as any).electron.removeLogListener();
            setIsRunning(false);

            if (success) {
                setLogs((prev) => [...prev, "\n[SYSTEM] Import successful!"]);
            } else {
                setLogs((prev) => [...prev, "\n[SYSTEM ERROR] Import failed or exited with an error."]);
            }
        }
    };

    useEffect(() => {
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [logs]);

    return (
        <div className="flex flex-col h-full p-8 max-w-5xl mx-auto">
            <header className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-slate-100">
                    Database Workstation
                </h1>
                <p className="text-slate-400 mt-2">
                    Import and validate .bacpac files locally.
                </p>
            </header>

            <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm mb-6">
                <h2 className="text-xl font-semibold mb-4 text-slate-200">
                    New Import Job
                </h2>

                <div className="space-y-6">
                    <div className="flex flex-col space-y-2">
                        <span className="text-sm font-medium text-slate-400">Target File (.bacpac)</span>
                        <div className="flex items-center space-x-4">
                            <Button onClick={handleSelectFile} variant="secondary" disabled={isRunning}>
                                Select .bacpac
                            </Button>
                            <span className="text-sm text-slate-300 font-mono bg-slate-950 px-3 py-1 rounded-md border border-slate-800 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                                {file ? file : "No file selected"}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col space-y-2">
                        <span className="text-sm font-medium text-slate-400">Target SQL Server</span>
                        <input
                            type="text"
                            value={targetServer}
                            onChange={(e) => setTargetServer(e.target.value)}
                            disabled={isRunning}
                            className="bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-700"
                            placeholder="e.g. localhost, 1433"
                        />
                    </div>

                    <Button
                        onClick={handleRunImport}
                        disabled={!file || isRunning}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        {isRunning ? "Running Import..." : "Execute Import"}
                    </Button>
                </div>
            </section>

            {/* Terminal Window for Logs */}
            <section className="flex-1 min-h-[300px] flex flex-col bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center">
                    <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Console Output</span>
                </div>
                <div className="flex-1 p-4 overflow-y-auto font-mono text-sm text-slate-300 whitespace-pre-wrap">
                    {logs.length === 0 ? (
                        <span className="text-slate-600 italic">Logs will appear here when an import is running...</span>
                    ) : (
                        logs.map((log, i) => (
                            <span key={i} className="block leading-relaxed">{log}</span>
                        ))
                    )}
                    <div ref={logsEndRef} />
                </div>
            </section>
        </div>
    );
}
