"use client";

import { useEffect, useRef } from "react";
import { useCanvasStore } from "@/store/useCanvasStore";

export function useDiagramAutoSave() {
    const tables = useCanvasStore((s) => s.tables);
    const notes = useCanvasStore((s) => s.notes);
    const areas = useCanvasStore((s) => s.areas);
    const relationships = useCanvasStore((s) => s.relationships);
    const setSavingStatus = useCanvasStore((s) => s.setSavingStatus);

    const isInitialMount = useRef(true);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        // Skip the first run so we don't show "Saving" on page load
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }

        // Trigger saving status
        setSavingStatus("saving");

        // Clear existing timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        // Simulate save delay
        timeoutRef.current = setTimeout(() => {
            setSavingStatus("saved");

            // Keep "Saved" for a while then go back to idle if we want to hide it
            // or just keep "Saved" visible. DrawDB keeps it visible for a bit.
            timeoutRef.current = setTimeout(() => {
                setSavingStatus("idle");
            }, 2000);
        }, 800);

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [tables, notes, areas, relationships, setSavingStatus]);
}
