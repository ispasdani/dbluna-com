"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { useNoticeStore } from "@/store/useNoticeStore";

const AUTO_DISMISS_MS = 3500;

export function NoticeToast() {
  const message = useNoticeStore((s) => s.message);
  const nonce = useNoticeStore((s) => s.nonce);
  const dismiss = useNoticeStore((s) => s.dismiss);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [message, nonce, dismiss]);

  if (!message) return null;

  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 z-[190] -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4 duration-200"
    >
      <div className="flex items-center gap-2 rounded-lg border border-border bg-popover py-2 pl-3.5 pr-1.5 text-[13px] text-popover-foreground shadow-lg">
        <span>{message}</span>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
