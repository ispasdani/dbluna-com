"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function DesktopDashboard() {
    const [file, setFile] = useState<string | null>(null);

    const handleSelectFile = async () => {
        // We will implement window.electron calls here in Step 4
        // For now, it's just a mockup
        if (typeof window !== "undefined" && (window as any).electron) {
            const selectedPath = await (window as any).electron.openBacpacFile();
            setFile(selectedPath);
        } else {
            alert("Electron environment not detected. Running in web mode.");
        }
    };

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

            <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
                <h2 className="text-xl font-semibold mb-4 text-slate-200">
                    New Import Job
                </h2>

                <div className="space-y-6">
                    <div className="flex flex-col space-y-2">
                        <span className="text-sm font-medium text-slate-400">Target File</span>
                        <div className="flex items-center space-x-4">
                            <Button onClick={handleSelectFile} variant="secondary">
                                Select .bacpac
                            </Button>
                            <span className="text-sm text-slate-300 font-mono bg-slate-950 px-3 py-1 rounded-md border border-slate-800">
                                {file ? file : "No file selected"}
                            </span>
                        </div>
                    </div>

                    {/* Further form elements will go here in Step 4 */}
                </div>
            </section>
        </div>
    );
}
