import type { Metadata } from "next";
import { AppThemeProvider } from "@/themeProviders/appThemeProvider";

export const metadata: Metadata = {
    title: "DBLuna Workstation",
    description: "Offline database import workstation",
};

export default function DesktopLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    return (
        <div className="min-h-dvh font-sans antialiased text-white bg-slate-950 flex flex-col">
            <AppThemeProvider>
                {/* Note: We do NOT wrap the entire desktop app in ClerkProvider or ConvexProvider initially.
            This will be handled by the LicenseGateway component later. */}
                <main className="flex-1 overflow-hidden">{children}</main>
            </AppThemeProvider>
        </div>
    );
}
