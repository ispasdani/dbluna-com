"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Check, Copy, Eye, Link as LinkIcon, Share2, UserX } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { DiagramData } from "@/store/useCanvasStore";
import { encodeDiagramForShare, estimateShareLinkSize } from "@/lib/share-link";
import { cn } from "@/lib/utils";
import styles from "./small-dialog.module.scss";

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
  const kb = Math.max(1, Math.ceil(size / 1024));

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
      <DialogContent className={cn(styles.content, styles.narrow)}>
        <DialogHeader className={styles.header}>
          <span className={styles.badge}>
            <Share2 className="size-4" />
          </span>
          <div className="min-w-0">
            <DialogTitle className={styles.title}>Share a view-only link</DialogTitle>
            <DialogDescription className={styles.subtitle}>
              <b>{diagram.name}</b>
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className={styles.body}>
          <ul className={styles.facts}>
            <li>
              <span className={styles.factIcon}>
                <UserX className="size-4" />
              </span>
              <span className={styles.factText}>
                No account needed
                <small>Anyone with the link can open it</small>
              </span>
            </li>
            <li>
              <span className={styles.factIcon}>
                <Eye className="size-4" />
              </span>
              <span className={styles.factText}>
                View only
                <small>They can&apos;t change your diagram</small>
              </span>
            </li>
            <li>
              <span className={styles.factIcon}>
                <Copy className="size-4" />
              </span>
              <span className={styles.factText}>
                Their own copy
                <small>They can save a copy to edit for themselves</small>
              </span>
            </li>
          </ul>

          {/* The whole diagram travels inside the link, so its length is the limit. */}
          <div className={styles.meter}>
            <div className={styles.meterRow}>
              <span>Link size</span>
              <span>
                ~{kb} KB of {HARD_SIZE_LIMIT / 1024} KB
              </span>
            </div>
            <div className={cn(styles.bar, isLarge && styles.barWarn, tooBig && styles.barFull)}>
              <i style={{ width: `${Math.min(100, (size / HARD_SIZE_LIMIT) * 100)}%` }} />
            </div>
          </div>

          {tooBig && (
            <div className={cn(styles.note, styles.noteError)} role="alert">
              <AlertCircle className="size-4" />
              <span>This diagram is too large to share as a link. Export it as JSON or DBML instead.</span>
            </div>
          )}
          {isLarge && (
            <div className={cn(styles.note, styles.noteWarn)}>
              <AlertCircle className="size-4" />
              <span>This link is on the long side. Some messaging apps may cut very long links short.</span>
            </div>
          )}
        </div>

        <div className={styles.foot}>
          <span className={styles.footInfo}>{copied ? "Paste it anywhere to share." : ""}</span>
          <span className={styles.spacer} />
          <button type="button" className={styles.primary} onClick={handleCopy} disabled={tooBig}>
            {copied ? <Check className="size-4" /> : <LinkIcon className="size-4" />}
            {copied ? "Link copied" : "Copy link"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
