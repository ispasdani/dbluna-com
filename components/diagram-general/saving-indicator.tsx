"use client";

import { useEffect, useState } from "react";
import { CloudUpload, CloudCheck } from "lucide-react";
import { useCanvasStore } from "@/store/useCanvasStore";
import { cn } from "@/lib/utils";

export function SavingIndicator() {
    const savingStatus = useCanvasStore((s) => s.savingStatus);
    const [displayStatus, setDisplayStatus] = useState(savingStatus);

    // We use local state to handle the transition grace period if needed,
    // but for now let's just sync with the store.
    useEffect(() => {
        setDisplayStatus(savingStatus);
    }, [savingStatus]);

    if (displayStatus === "idle") return null;

    return (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all duration-300">
            {displayStatus === "saving" ? (
                <>
                    <CloudUpload className="w-3.5 h-3.5 text-primary animate-pulse" />
                    <span className="text-muted-foreground">Saving...</span>
                </>
            ) : (
                <>
                    <CloudCheck className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-muted-foreground">Saved</span>
                </>
            )}
        </div>
    );
}
