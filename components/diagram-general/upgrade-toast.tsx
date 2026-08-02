"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Sparkles, X } from "lucide-react";
import { useUpgradeToastStore } from "@/store/useUpgradeToastStore";

const AUTO_DISMISS_MS = 4500;

export function UpgradeToast() {
  const visible = useUpgradeToastStore((s) => s.visible);
  const nonce = useUpgradeToastStore((s) => s.nonce);
  const dismiss = useUpgradeToastStore((s) => s.dismiss);

  // Restarts on every `nonce` bump, so repeated blocked attempts keep the
  // toast alive instead of letting an in-flight timer cut it short.
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [visible, nonce, dismiss]);

  if (!visible) return null;

  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 z-[200] -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-neutral-950/95 px-5 py-4 shadow-[0_0_50px_-10px_rgba(168,85,247,0.7)] backdrop-blur">
        <div className="pointer-events-none absolute inset-0 rounded-xl bg-[conic-gradient(from_0deg,rgba(168,85,247,0.55),rgba(56,189,248,0.55),rgba(236,72,153,0.55),rgba(168,85,247,0.55))] opacity-40 blur-md animate-spin [animation-duration:6s]" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 via-purple-500 to-sky-400 shadow-lg shadow-purple-500/40">
            <Sparkles className="h-4 w-4 text-white" />
          </div>

          <div className="pr-1">
            <p className="text-sm font-medium text-white">
              Upgrade to Pro to perform this action
            </p>
            <p className="text-xs text-white/60">
              Free accounts can only view diagrams created by Pro users.
            </p>
          </div>

          <Link
            href="/pricing"
            className="ml-2 shrink-0 rounded-lg bg-gradient-to-r from-fuchsia-500 to-sky-400 px-3 py-1.5 text-xs font-semibold text-white transition-transform hover:scale-105"
          >
            Upgrade
          </Link>

          <button
            onClick={dismiss}
            className="ml-1 shrink-0 rounded-md p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
