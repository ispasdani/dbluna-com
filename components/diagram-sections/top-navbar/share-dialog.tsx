"use client";

import { useMemo, useState } from "react";
import { Check, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { DiagramData } from "@/store/useCanvasStore";
import { encodeDiagramForShare, estimateShareLinkSize } from "@/lib/share-link";

// Matches artifacts/local_first_sharing_plan.md's Phase 2 thresholds: past the
// soft limit some messengers start mangling long links; past the hard limit
// they break outright. The ephemeral-snapshot fallback for oversized diagrams
// is Phase 4 — for now, sharing is simply disabled above the hard limit.
const SOFT_SIZE_LIMIT = 8 * 1024;
const HARD_SIZE_LIMIT = 32 * 1024;

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diagram: DiagramData;
}

export function ShareDialog({ open, onOpenChange, diagram }: ShareDialogProps) {
  const [copied, setCopied] = useState(false);

  const size = useMemo(() => estimateShareLinkSize(diagram), [diagram]);
  const tooBig = size >= HARD_SIZE_LIMIT;
  const isLarge = size >= SOFT_SIZE_LIMIT && !tooBig;

  const handleCopy = async () => {
    if (tooBig) return;
    const fragment = encodeDiagramForShare(diagram);
    const url = `${window.location.origin}/d/view#${fragment}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setCopied(false);
      }}
    >
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Share diagram</DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-3">
          <p className="text-sm text-muted-foreground">
            Anyone with this link can view <span className="font-medium text-foreground">{diagram.name}</span> —
            no account needed. They can&apos;t edit it, only open their own copy.
          </p>

          {tooBig && (
            <p className="text-xs text-destructive">
              This diagram is too large to share as a link. Export it as JSON or DBML instead
              (Export in the top bar).
            </p>
          )}
          {isLarge && (
            <p className="text-xs text-muted-foreground">
              This link is on the long side (~{Math.ceil(size / 1024)}KB) — some messaging apps may
              truncate very long links.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleCopy} disabled={tooBig} className="gap-2">
            {copied ? <Check className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
            {copied ? "Copied" : "Copy link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
