"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash, FileBox } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DiagramDashboard() {
    const router = useRouter();
    const [diagrams, setDiagrams] = useState<any[]>([]);
    
    useEffect(() => {
        loadDiagrams();
    }, []);

    const loadDiagrams = async () => {
        if (typeof window !== "undefined" && (window as any).electron) {
            const res = await (window as any).electron.listDiagrams();
            if (res?.success) setDiagrams(res.data);
        }
    };

    const handleCreate = async () => {
        const id = "dg_" + Date.now();
        router.push(`/desktop/diagrams/${id}`);
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (typeof window !== "undefined" && (window as any).electron) {
             await (window as any).electron.deleteDiagram(id);
             loadDiagrams();
        }
    };

    return (
        <div className="p-8 h-full flex flex-col bg-background text-foreground overflow-y-auto w-full">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-2xl font-bold">Local Diagrams</h1>
                <Button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Plus className="w-4 h-4 mr-2"/> New Diagram
                </Button>
            </div>
            {diagrams.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border/50 rounded-xl relative group">
                    <div className="absolute inset-0 bg-blue-500/5 transition-opacity opacity-0 group-hover:opacity-100 rounded-xl pointer-events-none" />
                    <FileBox className="w-16 h-16 mb-4 opacity-50"/>
                    <p>No diagrams found. Create one to get started.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full">
                    {diagrams.map(d => (
                        <div 
                            key={d.id} 
                            onClick={() => router.push(`/desktop/diagrams/${d.id}`)}
                            className="p-5 rounded-xl border border-border bg-sidebar hover:bg-accent transition-all duration-200 cursor-pointer group relative flex flex-col h-36 shadow-sm hover:shadow-md hover:border-blue-500/50"
                        >
                            <h3 className="font-semibold text-lg truncate flex-1 text-foreground">{d.name}</h3>
                            <p className="text-xs text-muted-foreground mb-4">
                                Last modified: {new Date(d.lastModified).toLocaleString()}
                            </p>
                            <Button 
                                variant="destructive" 
                                size="icon" 
                                className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 hover:bg-red-600"
                                onClick={(e) => handleDelete(e, d.id)}
                                title="Delete Diagram"
                            >
                                <Trash className="w-4 h-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
