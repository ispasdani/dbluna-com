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
                        className={`p-2.5 rounded-none mb-2 transition-colors border-l-2 ${
                            isActive 
                                ? "text-foreground bg-accent border-foreground" 
                                : "text-muted-foreground hover:text-foreground hover:bg-accent border-transparent"
                        }`}
                    >
                        <Icon strokeWidth={isActive ? 2 : 1.5} className="w-5 h-5" />
                    </button>
                );
            })}
        </div>
    );
}
