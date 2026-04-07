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
        <div className="h-screen w-screen font-sans antialiased text-foreground bg-background flex overflow-hidden">
            <AppThemeProvider>
                <LicenseGateway>
                    <div className="flex w-full h-full">
                        <main className="flex-1 overflow-hidden bg-background relative">
                            {children}
                        </main>
                    </div>
                </LicenseGateway>
            </AppThemeProvider>
        </div>
    );
}
