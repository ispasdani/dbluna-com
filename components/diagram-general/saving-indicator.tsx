"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DropdownMenu as Menu } from "radix-ui";
import { AlertCircle, Cloud, CloudOff, HardDrive, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useCanvasStore } from "@/store/useCanvasStore";
import { retryCloudAutoSaveNow } from "@/hooks/use-cloud-autosave";
import { useCloudSync } from "@/hooks/use-cloud-sync";
import { useConflictBannerStore } from "@/store/useConflictBannerStore";
import { cn } from "@/lib/utils";
import menu from "./toolbar-menus.module.scss";
import styles from "./saving-indicator.module.scss";

/** "just now", "12 min ago", "3 h ago", then a date and time. */
function relativeTime(t: number): string {
  const minutes = Math.round((Date.now() - t) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(t).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

/** Re-renders every 30s so "2 min ago" doesn't go stale while it's on screen. */
function useTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);
}

type Tone = "ok" | "busy" | "warn" | "error";

/**
 * Where the open diagram is saved and whether it's up to date — always shown.
 * The chip gives the one-word answer; clicking it opens the details and the
 * storage actions (save to cloud, make local-only, retry, reload).
 */
export function SavingIndicator() {
  const savingStatus = useCanvasStore((s) => s.savingStatus);
  const activeDiagramId = useCanvasStore((s) => s.activeDiagramId);
  const diagram = useCanvasStore((s) => (s.activeDiagramId ? s.diagrams[s.activeDiagramId] : undefined));
  const cloudSyncStatus = useCanvasStore((s) => s.cloudSyncStatus);
  const cloudSyncErrorReason = useCanvasStore((s) => s.cloudSyncErrorReason);
  const { isBusy, saveToCloud, makeLocalOnly } = useCloudSync(activeDiagramId ?? "");
  useTick();

  // "saved" is a real persistence event (see use-diagram-autosave.ts); it's
  // shown for a moment, then the chip settles back to where the diagram lives.
  const [justSaved, setJustSaved] = useState(false);
  const [prevStatus, setPrevStatus] = useState(savingStatus);
  if (savingStatus !== prevStatus) {
    setPrevStatus(savingStatus);
    setJustSaved(savingStatus === "saved");
  }
  useEffect(() => {
    if (!justSaved) return;
    const timeout = setTimeout(() => setJustSaved(false), 2000);
    return () => clearTimeout(timeout);
  }, [justSaved]);

  if (!activeDiagramId || !diagram) return null;

  const isCloud = diagram.storage === "cloud";
  const conflict = cloudSyncStatus === "error" && cloudSyncErrorReason === "conflict";
  const notPro = cloudSyncStatus === "error" && cloudSyncErrorReason === "not-pro";
  const syncError = cloudSyncStatus === "error" && !conflict && !notPro;

  // The chip: one tone and one short label, most urgent state first.
  let tone: Tone = "ok";
  let label: string;
  if (isCloud && conflict) {
    tone = "warn";
    label = "Edited elsewhere";
  } else if (isCloud && notPro) {
    tone = "warn";
    label = "Not syncing";
  } else if (isCloud && syncError) {
    tone = "error";
    label = "Sync error";
  } else if (savingStatus === "saving" || (isCloud && cloudSyncStatus === "saving")) {
    tone = "busy";
    label = isCloud ? "Syncing…" : "Saving…";
  } else if (justSaved && !isCloud) {
    label = "Saved";
  } else {
    label = isCloud ? "Saved to cloud" : "Saved on this device";
  }

  const Where = isCloud ? Cloud : HardDrive;

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <button
          type="button"
          className={cn(styles.chip, styles[tone])}
          title={isCloud ? "Saved to the cloud. Click for details" : "Saved in this browser. Click for details"}
        >
          <span className={styles.dot} aria-hidden />
          <Where className="size-3.5" />
          <span className={styles.label}>{label}</span>
        </button>
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Content align="start" sideOffset={8} className={cn(menu.menu, styles.panel)}>
          <div className={styles.head}>
            <span className={styles.headIcon}>
              <Where className="size-4" />
            </span>
            <span className={styles.headText}>
              {isCloud ? "Saved to the cloud" : "Saved on this device"}
              <small>
                {isCloud
                  ? "Available on any device you sign in on, and to people you invite."
                  : "Kept in this browser only. Clearing site data removes it."}
              </small>
            </span>
          </div>

          {conflict && (
            <div className={cn(styles.problem, styles.problemWarn)}>
              <AlertCircle className="size-3.5" />
              <span>Someone else edited this diagram. Reload to get their changes before you continue.</span>
            </div>
          )}
          {notPro && (
            <div className={cn(styles.problem, styles.problemWarn)}>
              <AlertCircle className="size-3.5" />
              <span>Cloud sync needs Pro. Your changes are saved on this device but not synced.</span>
            </div>
          )}
          {syncError && (
            <div className={cn(styles.problem, styles.problemError)}>
              <AlertCircle className="size-3.5" />
              <span>The last change didn&apos;t reach the cloud. It&apos;s safe on this device; retry to sync it.</span>
            </div>
          )}

          <dl className={styles.facts}>
            <dt>Last change</dt>
            <dd>{relativeTime(diagram.updatedAt)}</dd>
            {isCloud && (
              <>
                <dt>Last synced</dt>
                <dd>{diagram.lastSyncedAt ? relativeTime(diagram.lastSyncedAt) : "Not yet"}</dd>
              </>
            )}
            <dt>Saving</dt>
            <dd>Automatic</dd>
          </dl>

          <div className={styles.actions}>
            {conflict && (
              <Menu.Item className={menu.item} onSelect={() => useConflictBannerStore.getState().trigger()}>
                <span className={menu.icon}>
                  <RefreshCw className="size-4" />
                </span>
                <span className={menu.text}>
                  Reload their changes
                  <small>Get the latest version from the cloud</small>
                </span>
              </Menu.Item>
            )}
            {syncError && (
              <Menu.Item className={menu.item} onSelect={() => retryCloudAutoSaveNow()}>
                <span className={menu.icon}>
                  <RefreshCw className="size-4" />
                </span>
                <span className={menu.text}>
                  Retry sync
                  <small>Send the latest changes now</small>
                </span>
              </Menu.Item>
            )}
            {notPro && (
              <Menu.Item className={menu.item} asChild>
                <Link href="/pricing">
                  <span className={menu.icon}>
                    <Sparkles className="size-4" />
                  </span>
                  <span className={menu.text}>
                    Upgrade to Pro
                    <small>Turn cloud sync back on</small>
                  </span>
                </Link>
              </Menu.Item>
            )}

            {isCloud ? (
              <Menu.Item
                className={menu.item}
                disabled={isBusy}
                onSelect={() => {
                  void makeLocalOnly().then((result) => {
                    if (!result.ok && result.message) alert(result.message);
                  });
                }}
              >
                <span className={menu.icon}>
                  {isBusy ? <Loader2 className="size-4 animate-spin" /> : <CloudOff className="size-4" />}
                </span>
                <span className={menu.text}>
                  Keep on this device only
                  <small>Removes the cloud copy; other devices lose access</small>
                </span>
              </Menu.Item>
            ) : (
              <Menu.Item className={menu.item} disabled={isBusy} onSelect={() => void saveToCloud()}>
                <span className={menu.icon}>
                  {isBusy ? <Loader2 className="size-4 animate-spin" /> : <Cloud className="size-4" />}
                </span>
                <span className={menu.text}>
                  Save to cloud
                  <small>Open it anywhere and invite others</small>
                </span>
              </Menu.Item>
            )}
          </div>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
