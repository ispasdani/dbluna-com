"use client";

import { useEffect, useState } from "react";
import { ClerkProvider, SignedIn, SignedOut, SignIn } from "@clerk/nextjs";
import { ConvexClientProvider } from "@/app/providers/ConvexClientProvider";
import { Button } from "@/components/ui/button";

export function LicenseGateway({ children }: { children: React.ReactNode }) {
    const [hasLicense, setHasLicense] = useState<boolean | null>(null);
    const [isActivating, setIsActivating] = useState(false);
    const [activationError, setActivationError] = useState<string | null>(null);

    useEffect(() => {
        const checkLicense = async () => {
            if (typeof window !== "undefined" && (window as any).electron && (window as any).electron.readLicense) {
                try {
                    const license = await (window as any).electron.readLicense();
                    if (license) {
                        setHasLicense(true);
                    } else {
                        setHasLicense(false);
                    }
                } catch (e) {
                    setHasLicense(false);
                }
            } else {
                // If not in electron environment or missing methods, we default to false for safety
                // or true if we want to bypass for web dev. For the plan, it says check electron.
                setHasLicense(false);
            }
        };
        checkLicense();
    }, []);

    const handleActivate = async () => {
        setIsActivating(true);
        setActivationError(null);
        try {
            const res = await fetch("/api/activate", { method: "POST" });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to activate");
            }
            const data = await res.json();

            if (typeof window !== "undefined" && (window as any).electron && (window as any).electron.saveLicense) {
                await (window as any).electron.saveLicense(data.license);
                setHasLicense(true);
            } else {
                throw new Error("Electron environment not detected. Cannot save license.");
            }
        } catch (e: any) {
            setActivationError(e.message);
        } finally {
            setIsActivating(false);
        }
    };

    if (hasLicense === null) {
        return <div className="flex items-center justify-center min-h-screen bg-slate-950 text-white">Loading...</div>;
    }

    if (hasLicense) {
        return <ConvexClientProvider>{children}</ConvexClientProvider>;
    }

    return (
        <ClerkProvider>
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white p-4">
                <SignedIn>
                    <div className="bg-slate-900 border border-slate-800 p-8 rounded-xl shadow-lg max-w-md w-full text-center">
                        <h2 className="text-2xl font-bold mb-4">Activate Workstation</h2>
                        <p className="text-slate-400 mb-8">
                            You are signed in. Click below to securely generate an offline license for this device.
                        </p>

                        {activationError && (
                            <div className="bg-red-950/50 border border-red-900 text-red-400 p-3 rounded-md mb-6 text-sm">
                                {activationError}
                            </div>
                        )}

                        <Button
                            onClick={handleActivate}
                            disabled={isActivating}
                            className="w-full"
                        >
                            {isActivating ? "Activating..." : "Generate Offline License"}
                        </Button>
                    </div>
                </SignedIn>
                <SignedOut>
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold mb-2">DBLuna Workstation</h1>
                        <p className="text-slate-400 max-w-md">Please sign in to activate your offline license for the desktop application.</p>
                    </div>
                    {/* Using hash routing to prevent Electron URL navigation issues */}
                    <SignIn routing="hash" />
                </SignedOut>
            </div>
        </ClerkProvider>
    );
}
