"use client";

/**
 * TEMPORARY: per-subtree render cost attribution, companion to
 * lib/debug-selection.ts. Wrap a subtree in <DebugProfiler id="...">, click
 * something, and every commit that subtree takes part in is logged with the
 * time React actually spent on it.
 *
 * Only commits that cost more than NOISE_MS are logged, so an idle page stays
 * quiet. Delete this file and its call sites once the cause is found.
 */

import { Profiler, type ReactNode } from "react";
import { DEBUG, dlog, onMark } from "./debug-selection";

const NOISE_MS = 3;

/**
 * Bumped by instrumented leaf components. Counters are global and cumulative
 * per click — draining them inside a Profiler attributes another subtree's
 * renders to whichever one commits first, so the summary is reported once,
 * after the click has settled.
 */
const counters = new Map<string, number>();
/** Per-subtree render cost for the current click, summed across commits. */
const subtreeMs = new Map<string, number>();

export function countRender(name: string) {
  if (!DEBUG) return;
  counters.set(name, (counters.get(name) ?? 0) + 1);
}

if (DEBUG) {
  onMark(() => {
    counters.clear();
    subtreeMs.clear();
    setTimeout(() => {
      if (!counters.size && !subtreeMs.size) return;
      // Flattened into the message on purpose: an object argument shows up
      // collapsed in the console and has to be expanded by hand to be read.
      let total = 0;
      for (const v of subtreeMs.values()) total += v;
      const subtrees = Array.from(subtreeMs)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k}=${v.toFixed(0)}ms`)
        .join("  ");
      const renders = Array.from(counters)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k}x${v}`)
        .join("  ");
      dlog(
        "SUMMARY",
        `React ${total.toFixed(0)}ms | ${subtrees} | RENDERS: ${renders || "(none)"}`
      );
    }, 1500);
  });
}

export function DebugProfiler({ id, children }: { id: string; children: ReactNode }) {
  if (!DEBUG) return <>{children}</>;

  return (
    <Profiler
      id={id}
      onRender={(_id, phase, actualDuration) => {
        subtreeMs.set(id, (subtreeMs.get(id) ?? 0) + actualDuration);
        if (actualDuration < NOISE_MS) return;
        dlog("RENDER", `${id} ${phase} took ${actualDuration.toFixed(0)}ms`);
      }}
    >
      {children}
    </Profiler>
  );
}
