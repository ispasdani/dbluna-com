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

    useEffect(() => {
        // Skip the first run so we don't show "Saving" on page load
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }

        // A write is genuinely pending now (the debounced storage layer will
        // flush it shortly). "saved" is set for real by the storage layer's
        // onWriteComplete callback once the IndexedDB write actually lands —
        // see the `storage:` option in useCanvasStore's persist config.
        setSavingStatus("saving");
    }, [tables, notes, areas, relationships, setSavingStatus]);
}
