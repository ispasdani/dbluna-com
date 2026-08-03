"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HardDrive, Save, Cloud, CloudOff, RefreshCw } from "lucide-react";
import { useCanvasStore } from "@/store/useCanvasStore";
import { retryCloudAutoSaveNow } from "@/hooks/use-cloud-autosave";

export function SavingIndicator() {
    const savingStatus = useCanvasStore((s) => s.savingStatus);
    const [displayStatus, setDisplayStatus] = useState(savingStatus);
    // Mirrors savingStatus into displayStatus during render (React's
    // documented "adjusting state during rendering" pattern) rather than via
    // an effect — the effect below is reserved for the one thing that's a
    // genuine external timer: fading "saved" back to idle after a delay.
    const [prevSavingStatus, setPrevSavingStatus] = useState(savingStatus);
    if (savingStatus !== prevSavingStatus) {
        setPrevSavingStatus(savingStatus);
        setDisplayStatus(savingStatus);
    }

    const activeDiagramId = useCanvasStore((s) => s.activeDiagramId);
    const storage = useCanvasStore((s) =>
        s.activeDiagramId ? s.diagrams[s.activeDiagramId]?.storage : undefined
    );
    const cloudSyncStatus = useCanvasStore((s) => s.cloudSyncStatus);
    const cloudSyncErrorReason = useCanvasStore((s) => s.cloudSyncErrorReason);

    useEffect(() => {
        // "saved" is a real persistence event (see use-diagram-autosave.ts),
        // but we still fade it back to idle after a bit so it doesn't linger
        // forever — that part is cosmetic, not a persistence claim.
        if (savingStatus === "saved") {
            const timeout = setTimeout(() => setDisplayStatus("idle"), 2000);
            return () => clearTimeout(timeout);
        }
    }, [savingStatus]);

    const isCloud = activeDiagramId && storage === "cloud";

    if (displayStatus === "idle" && !isCloud) return null;

    return (
        <div className="flex items-center gap-3">
            {displayStatus !== "idle" && (
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
            )}

            {isCloud && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium">
                    {cloudSyncStatus === "saving" && (
                        <>
                            <Cloud className="w-3.5 h-3.5 text-primary animate-pulse" />
                            <span className="text-muted-foreground">Syncing...</span>
                        </>
                    )}
                    {cloudSyncStatus === "synced" && (
                        <>
                            <Cloud className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-muted-foreground">Synced</span>
                        </>
                    )}
                    {cloudSyncStatus === "error" && cloudSyncErrorReason === "not-pro" && (
                        <Link href="/pricing" className="flex items-center gap-1.5 hover:underline">
                            <CloudOff className="w-3.5 h-3.5 text-destructive" />
                            <span className="text-muted-foreground">Pro required — not syncing</span>
                        </Link>
                    )}
                    {cloudSyncStatus === "error" && cloudSyncErrorReason !== "not-pro" && (
                        <>
                            <CloudOff className="w-3.5 h-3.5 text-destructive" />
                            <span className="text-muted-foreground">Sync error</span>
                            <button
                                type="button"
                                onClick={() => retryCloudAutoSaveNow()}
                                className="flex items-center gap-1 text-primary hover:underline"
                            >
                                <RefreshCw className="w-3 h-3" />
                                Retry
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
