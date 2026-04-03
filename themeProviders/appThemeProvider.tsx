// app/providers/AppThemeProvider.tsx
"use client";
import { ThemeProvider } from "next-themes";

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  // Enforce Codex light theme only
  return (
    <ThemeProvider attribute="class" forcedTheme="light" defaultTheme="light" enableSystem={false}>
      {children}
    </ThemeProvider>
  );
}
