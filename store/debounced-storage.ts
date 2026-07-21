import type { PersistStorage, StorageValue } from "zustand/middleware";
import { get as idbGet, set as idbSet, del as idbDel, createStore, type UseStore } from "idb-keyval";

let dbStore: UseStore | undefined;
function getDbStore(): UseStore {
  if (!dbStore) dbStore = createStore("dbluna-db", "keyval");
  return dbStore;
}

// One-time-per-key migration from the old localStorage-backed persist (pre-IndexedDB).
// Runs lazily inside getItem so it's covered by the same window/SSR guard as everything
// else here, and completes before rehydration reads "real" data.
const migratedKeys = new Set<string>();
async function migrateFromLocalStorage(name: string): Promise<void> {
  if (migratedKeys.has(name)) return;
  migratedKeys.add(name);
  try {
    const existing = await idbGet<string>(name, getDbStore());
    if (existing !== undefined) return; // already migrated or never used localStorage
    const raw = localStorage.getItem(name);
    if (raw == null) return;
    await idbSet(name, raw, getDbStore());
    localStorage.removeItem(name); // only delete after the IndexedDB write resolved
  } catch {
    migratedKeys.delete(name); // let a later load retry
  }
}

/**
 * An IndexedDB-backed PersistStorage that debounces writes.
 *
 * zustand's persist middleware serializes + writes on EVERY store update.
 * During high-frequency interactions (panning the camera, resizing notes/areas)
 * that means a stringify + write per pointermove, which causes visible jank.
 *
 * This storage defers both the stringify and the write until the state has
 * been quiet for `delayMs`, and flushes immediately when the page is hidden
 * or unloaded so nothing is lost. Note that unlike the old localStorage version,
 * the IndexedDB flush is async — browsers don't guarantee it completes before
 * an actual unload, though pagehide/visibilitychange give it a head start.
 *
 * `onWriteComplete` fires after a flush actually lands in IndexedDB, which is
 * what drives the "Saved locally" indicator (vs. a fake timer).
 */
export function createDebouncedStorage<T>(
  delayMs = 500,
  onWriteComplete?: (name: string) => void
): PersistStorage<T> {
  const pending = new Map<string, StorageValue<T>>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const flush = async (name: string) => {
    const timer = timers.get(name);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.delete(name);
    }
    const value = pending.get(name);
    if (value === undefined) return;
    pending.delete(name);
    try {
      await idbSet(name, JSON.stringify(value), getDbStore());
      onWriteComplete?.(name);
    } catch {
      // Storage full or unavailable — drop the write.
    }
  };

  const flushAll = () => {
    for (const name of Array.from(pending.keys())) void flush(name);
  };

  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", flushAll);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushAll();
    });
  }

  return {
    getItem: async (name) => {
      // If a write is still pending, hand back the latest in-memory value.
      const queued = pending.get(name);
      if (queued !== undefined) return queued;
      if (typeof window === "undefined") return null;
      await migrateFromLocalStorage(name);
      try {
        const raw = await idbGet<string>(name, getDbStore());
        return raw ? (JSON.parse(raw) as StorageValue<T>) : null;
      } catch {
        return null;
      }
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
      if (typeof window !== "undefined") {
        void idbDel(name, getDbStore()).catch(() => {});
      }
    },
  };
}
