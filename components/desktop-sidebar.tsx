"use client";

import { usePathname, useRouter } from "next/navigation";
import { Database, GitCompareArrows } from "lucide-react";

export function DesktopSidebar() {
    const pathname = usePathname();
    const router = useRouter();

    const tabs = [
        {
            id: "explorer",
            icon: Database,
            path: "/desktop/explorer",
            title: "Database Explorer"
        },
        {
            id: "diagrams",
            icon: GitCompareArrows,
            path: "/desktop/diagrams",
            title: "Diagrams"
        }
    ];

    return (
        <div className="w-14 h-full bg-sidebar border-r border-border flex flex-col items-center py-4 shrink-0 z-50">
            {tabs.map(tab => {
                const isActive = pathname.startsWith(tab.path);
                const Icon = tab.icon;
                return (
                    <button
                        key={tab.id}
                        onClick={() => router.push(tab.path)}
                        title={tab.title}
                        className={`p-2.5 rounded-xl mb-3 transition-colors ${
                            isActive 
                                ? "text-blue-500 bg-blue-500/10" 
                                : "text-muted-foreground hover:text-foreground hover:bg-accent"
                        }`}
                    >
                        <Icon strokeWidth={isActive ? 2 : 1.5} className="w-6 h-6" />
                    </button>
                );
            })}
        </div>
    );
}
