"use client";

import { useEffect, useState } from "react";
import { HardDrive, Save } from "lucide-react";
import { useCanvasStore } from "@/store/useCanvasStore";

export function SavingIndicator() {
    const savingStatus = useCanvasStore((s) => s.savingStatus);
    const [displayStatus, setDisplayStatus] = useState(savingStatus);

    useEffect(() => {
        setDisplayStatus(savingStatus);

        // "saved" is a real persistence event (see use-diagram-autosave.ts),
        // but we still fade it back to idle after a bit so it doesn't linger
        // forever — that part is cosmetic, not a persistence claim.
        if (savingStatus === "saved") {
            const timeout = setTimeout(() => setDisplayStatus("idle"), 2000);
            return () => clearTimeout(timeout);
        }
    }, [savingStatus]);

    if (displayStatus === "idle") return null;

    return (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all duration-300">
            {displayStatus === "saving" ? (
                <>
                    <HardDrive className="w-3.5 h-3.5 text-primary animate-pulse" />
                    <span className="text-muted-foreground">Saving...</span>
                </>
            ) : (
                <>
                    <Save className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-muted-foreground">Saved locally</span>
                </>
            )}
        </div>
    );
}
