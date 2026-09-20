"use client";

/**
 * TEMPORARY diagnostic instrumentation for the "click a table and the whole
 * screen blanks" report on large schemas.
 *
 * Off unless switched on, so it costs nothing in normal use:
 *
 *   localStorage.setItem("dbluna:debug", "1"); location.reload();
 *   // or open the diagram with ?debug=1
 *
 * Turn it off again with:
 *
 *   localStorage.removeItem("dbluna:debug"); location.reload();
 *
 * Everything lands in the console and in a ring buffer you can dump with
 * `__dbluna.report()`. Delete this file and its call sites once the cause is
 * found.
 */

export interface DebugEntry {
  t: number;
  tag: string;
  msg: string;
  data?: unknown;
}

const BUFFER_LIMIT = 500;

function readFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search).get("debug") === "1") return true;
    return window.localStorage.getItem("dbluna:debug") === "1";
  } catch {
    return false;
  }
}

export const DEBUG = readFlag();

const buffer: DebugEntry[] = [];
let t0 = typeof performance !== "undefined" ? performance.now() : 0;

/** Milliseconds since the last `mark()`, so a click's timeline reads from 0. */
const since = () => +(performance.now() - t0).toFixed(1);

export function dlog(tag: string, msg: string, data?: unknown) {
  if (!DEBUG) return;
  const entry: DebugEntry = { t: since(), tag, msg, data };
  buffer.push(entry);
  if (buffer.length > BUFFER_LIMIT) buffer.shift();
   
  console.log(`%c[${entry.t}ms] ${tag}`, "color:#7c3aed;font-weight:600", msg, data ?? "");
}

const markListeners = new Set<() => void>();

/** Lets the profiler reset its per-click counters when a new click starts. */
export function onMark(fn: () => void) {
  markListeners.add(fn);
  return () => void markListeners.delete(fn);
}

/** Resets the clock — called on pointer-down so each click reads from 0ms. */
export function mark(label: string) {
  if (!DEBUG) return;
  t0 = performance.now();
  for (const fn of markListeners) fn();
   
  console.log(`%c───── ${label} ─────`, "color:#0284c7;font-weight:700");
  buffer.push({ t: 0, tag: "MARK", msg: label });
}

/**
 * Logs mounts and unmounts. An unmount here is the interesting one: it means
 * React threw the subtree away, which is what "everything disappears" looks
 * like from the outside.
 */
export function logMount(name: string) {
  if (!DEBUG) return () => {};
  dlog("mount", `${name} MOUNTED`);
  return () => dlog("mount", `%c${name} UNMOUNTED`);
}

/** Watches the main thread and reports any stall long enough to drop frames. */
function startBlockProbe() {
  if (!DEBUG || typeof window === "undefined") return;
  let prev = performance.now();
  setInterval(() => {
    const now = performance.now();
    const gap = now - prev;
    prev = now;
    // A backgrounded tab throttles timers to ~1s, which is not a stall.
    if (document.hidden) return;
    if (gap > 50) dlog("BLOCK", `main thread blocked ${gap.toFixed(0)}ms`);
  }, 4);
}

if (DEBUG && typeof window !== "undefined") {
  startBlockProbe();
  (window as unknown as Record<string, unknown>).__dbluna = {
    report: () => {
       
      console.table(buffer.map((e) => ({ ms: e.t, tag: e.tag, msg: e.msg })));
      return buffer;
    },
    raw: () => buffer,
    clear: () => {
      buffer.length = 0;
    },
    off: () => {
      try {
        window.localStorage.removeItem("dbluna:debug");
      } catch {}
       
      console.log("dbluna debug off — reload to apply");
    },
  };
   
  console.log(
    "%cdbluna debug ON — click a table, then run __dbluna.report()",
    "color:#16a34a;font-weight:700"
  );
}

/**
 * Logs which top-level store keys change, and whether the value is a *new
 * object* or genuinely different content. A key like `tables` getting a fresh
 * array identity on a click is enough to re-render the whole canvas even when
 * nothing in it actually changed — that shows up here as `identity-only`.
 */
export function watchStore<T extends object>(
  name: string,
  store: { subscribe: (fn: (state: T, prev: T) => void) => () => void }
) {
  if (!DEBUG) return () => {};
  return store.subscribe((nextState, prevState) => {
    const next = nextState as Record<string, unknown>;
    const prev = prevState as Record<string, unknown>;
    const changed: Record<string, string> = {};
    for (const key of Object.keys(next)) {
      const a = prev[key];
      const b = next[key];
      if (a === b) continue;
      if (typeof b === "function") continue;
      if (Array.isArray(a) && Array.isArray(b)) {
        const sameLength = a.length === b.length;
        const sameItems = sameLength && a.every((v, i) => v === b[i]);
        changed[key] = sameItems
          ? `identity-only (${b.length} items, same contents)`
          : `changed (${a.length} -> ${b.length} items)`;
        continue;
      }
      changed[key] = `${JSON.stringify(a)?.slice(0, 60)} -> ${JSON.stringify(b)?.slice(0, 60)}`;
    }
    if (Object.keys(changed).length) dlog("state", `${name} changed`, changed);
  });
}
