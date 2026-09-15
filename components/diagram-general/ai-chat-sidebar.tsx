"use client";

import { useState } from "react";
import { WandSparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useViewStore } from "@/store/useViewStore";
import { AiChatPanel } from "./ai-chat-panel";

// Floating "Luna AI" button, pinned to the canvas's bottom-right corner just
// above the minimap (minimap: 160px tall at bottom-4, so 16 + 160 + 12 gap).
export function AiChatLauncher() {
  const isOpen = useViewStore((s) => s.isAiChatOpen);
  const toggleAiChat = useViewStore((s) => s.toggleAiChat);

  return (
    <button
      type="button"
      onClick={toggleAiChat}
      title="Luna AI"
      aria-label="Luna AI"
      aria-expanded={isOpen}
      className={cn(
        "absolute right-4 bottom-[188px] z-20 h-11 w-11 rounded-2xl",
        "flex items-center justify-center cursor-pointer text-white",
        "bg-gradient-to-br from-[#ff8a5c] via-[#ff6347] to-[#e5392a] shadow-lg shadow-[#e5392a]/30",
        "transition-[transform,opacity] duration-150 hover:scale-105 active:scale-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2",
        isOpen && "pointer-events-none opacity-0",
      )}
    >
      <WandSparkles className="h-5 w-5" />
    </button>
  );
}

interface AiChatSidebarProps {
  readOnly?: boolean;
}

// Right-docked sidebar overlaying the canvas. Mounted on first open and then
// kept mounted while hidden, so closing it mid-reply doesn't abort the stream.
export function AiChatSidebar({ readOnly = false }: AiChatSidebarProps) {
  const isOpen = useViewStore((s) => s.isAiChatOpen);
  const setAiChatOpen = useViewStore((s) => s.setAiChatOpen);
  const [hasOpened, setHasOpened] = useState(isOpen);

  // Render-time state adjustment (not an effect) — flips once, on first open.
  if (isOpen && !hasOpened) setHasOpened(true);

  if (!hasOpened) return null;

  return (
    <aside
      aria-label="Luna AI"
      inert={!isOpen}
      className={cn(
        "absolute inset-y-0 right-0 z-30 w-[400px] max-w-full",
        "border-l border-border bg-dock-bg shadow-xl",
        "transition-transform duration-200 ease-out",
        isOpen ? "translate-x-0" : "translate-x-full shadow-none",
      )}
    >
      <AiChatPanel readOnly={readOnly} onClose={() => setAiChatOpen(false)} />
    </aside>
  );
}
