import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { ConvexClientProvider } from "./providers/ConvexClientProvider";

const inter = Inter({
    subsets: ["latin"],
    variable: "--font-sans",
});

const geistMono = Geist_Mono({
    subsets: ["latin"],
    variable: "--font-mono",
});

export const metadata: Metadata = {
    metadataBase: new URL(
        process.env.NEXT_PUBLIC_SITE_URL ?? "https://dbluna.com"
    ),
    title: {
        default: "DBLuna",
        template: "%s | DBLuna",
    },
    description:
        "Design, document, and share database schemas visually or in DBML. Visual canvas, two-way code editor, and multi-format import/export.",
    robots: {
        googleBot: {
            index: true,
            follow: true,
            "max-snippet": -1,
            "max-image-preview": "large",
            "max-video-preview": -1,
        },
    },
    openGraph: {
        siteName: "DBLuna",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
    },
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
            >
                {/* Clerk and Convex live at the root, not per route group.
                    Each group owning its own <ClerkProvider> meant that
                    navigating between groups — /pricing (marketing) to /d
                    (diagram) — unmounted one provider and mounted another.
                    Clerk drives its redirects with
                    startTransition(() => router.push(to)) from inside the
                    provider (useInternalNavFun), so a cross-group redirect
                    tore down the component owning the in-flight transition:
                    post-checkout landings on /d fetched their RSC payload and
                    then never committed, leaving the spinner up until a manual
                    refresh. Mounted once here, the provider survives every
                    navigation. afterSignOutUrl keeps signing out of /d/[id]
                    from bouncing straight back into proxy.ts's auth.protect().
                */}
                <ClerkProvider afterSignOutUrl="/">
                    <ConvexClientProvider>{children}</ConvexClientProvider>
                </ClerkProvider>
            </body>
        </html>
    );
}
