import type { PersistStorage, StorageValue } from "zustand/middleware";

/**
 * A localStorage-backed PersistStorage that debounces writes.
 *
 * zustand's persist middleware serializes + writes to localStorage on EVERY
 * store update. During high-frequency interactions (panning the camera,
 * resizing notes/areas) that means a synchronous JSON.stringify +
 * localStorage.setItem per pointermove, which causes visible jank.
 *
 * This storage defers both the stringify and the write until the state has
 * been quiet for `delayMs`, and flushes immediately when the page is hidden
 * or unloaded so nothing is lost.
 */
export function createDebouncedStorage<T>(delayMs = 500): PersistStorage<T> {
  const pending = new Map<string, StorageValue<T>>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const flush = (name: string) => {
    const timer = timers.get(name);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.delete(name);
    }
    const value = pending.get(name);
    if (value !== undefined) {
      pending.delete(name);
      try {
        localStorage.setItem(name, JSON.stringify(value));
      } catch {
        // Storage full or unavailable — drop the write.
      }
    }
  };

  const flushAll = () => {
    for (const name of Array.from(pending.keys())) flush(name);
  };

  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", flushAll);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushAll();
    });
  }

  return {
    getItem: (name) => {
      // If a write is still pending, hand back the latest in-memory value.
      const queued = pending.get(name);
      if (queued !== undefined) return queued;
      if (typeof window === "undefined") return null;
      const raw = localStorage.getItem(name);
      return raw ? (JSON.parse(raw) as StorageValue<T>) : null;
    },
    setItem: (name, value) => {
      if (typeof window === "undefined") return;
      pending.set(name, value);
      const existing = timers.get(name);
      if (existing !== undefined) clearTimeout(existing);
      timers.set(name, setTimeout(() => flush(name), delayMs));
    },
    removeItem: (name) => {
      const timer = timers.get(name);
      if (timer !== undefined) clearTimeout(timer);
      timers.delete(name);
      pending.delete(name);
      if (typeof window !== "undefined") localStorage.removeItem(name);
    },
  };
}
