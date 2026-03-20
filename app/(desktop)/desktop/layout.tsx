import type { Metadata } from "next";
import { AppThemeProvider } from "@/themeProviders/appThemeProvider";
import { LicenseGateway } from "@/components/LicenseGateway";

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
                <LicenseGateway>
                    <main className="flex-1 overflow-hidden">{children}</main>
                </LicenseGateway>
            </AppThemeProvider>
        </div>
    );
}
