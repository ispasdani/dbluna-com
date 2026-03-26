"use client";

import { useEffect, useRef } from "react";
import { useCanvasStore } from "@/store/useCanvasStore";

export function useDesktopDiagramAutosave(diagramId: string) {
    const tables = useCanvasStore((s) => s.tables);
    const notes = useCanvasStore((s) => s.notes);
    const areas = useCanvasStore((s) => s.areas);
    const relationships = useCanvasStore((s) => s.relationships);
    const setSavingStatus = useCanvasStore((s) => s.setSavingStatus);

    const isInitialMount = useRef(true);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Initial load from Electron
    useEffect(() => {
        let isMounted = true;
        const load = async () => {
            if (typeof window !== "undefined" && (window as any).electron) {
                const res = await (window as any).electron.loadDiagram(diagramId);
                if (res?.success && isMounted) {
                    const data = res.data;
                    useCanvasStore.setState({
                        ...(data.tables && { tables: data.tables }),
                        ...(data.notes && { notes: data.notes }),
                        ...(data.areas && { areas: data.areas }),
                        ...(data.relationships && { relationships: data.relationships })
                    });
                }
            }
        };
        load();
        
        return () => { isMounted = false; };
    }, [diagramId]);

    // Save triggers
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }

        setSavingStatus("saving");

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(async () => {
            if (typeof window !== "undefined" && (window as any).electron) {
                const payload = {
                    id: diagramId,
                    name: "Diagram " + diagramId.replace("dg_", ""),
                    tables,
                    notes,
                    areas,
                    relationships
                };
                await (window as any).electron.saveDiagram(payload);
            }
            
            setSavingStatus("saved");
            timeoutRef.current = setTimeout(() => {
                setSavingStatus("idle");
            }, 2000);
        }, 800);

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [tables, notes, areas, relationships, diagramId, setSavingStatus]);
}
