import { AppThemeProvider } from "@/themeProviders/appThemeProvider";

export default function WebLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Clerk, Convex, the fonts and globals.css all come from app/layout.tsx now.
  return (
    <div className="min-h-dvh flex flex-col">
      <AppThemeProvider>{children}</AppThemeProvider>
    </div>
  );
}
