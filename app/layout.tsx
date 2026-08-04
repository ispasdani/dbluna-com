import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
    subsets: ["latin"],
    variable: "--font-sans",
});

const geistMono = Geist_Mono({
    subsets: ["latin"],
    variable: "--font-mono",
});

export const metadata: Metadata = {
    title: "DBLuna",
    description: "Offline database import workstation",
};

export default function RootLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    return (
        <html
            lang="en"
            className={`${inter.variable} ${geistMono.variable}`}
            suppressHydrationWarning
        >
            <body
                className="font-sans antialiased [--pattern-fg:var(--color-charcoal-900)]/10 dark:[--pattern-fg:var(--color-neutral-100)]/30"
                data-palette="claude"
            >
                {children}
            </body>
        </html>
    );
}
