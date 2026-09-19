"use client";

import { useState } from "react";
import { WandSparkles } from "lucide-react";
import { useViewStore } from "@/store/useViewStore";
import { AiChatPanel } from "./ai-chat-panel";
import styles from "./ai-chat.module.scss";

// Floating "Luna AI" button, pinned to the canvas's bottom-right corner just
// above the minimap. Same glass surface as the floating toolbar.
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
      className={styles.launcher}
    >
      <span className={styles.mark}>
        <WandSparkles className="size-4" />
      </span>
      Ask Luna
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
    <aside aria-label="Luna AI" inert={!isOpen} data-open={isOpen} className={styles.sidebar}>
      <AiChatPanel readOnly={readOnly} onClose={() => setAiChatOpen(false)} />
    </aside>
  );
}
