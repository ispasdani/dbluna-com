# Phase 1: Harden Local-First Persistence

## Context

`artifacts/local_first_sharing_plan.md` lays out a 4-phase roadmap to make dbluna fully usable without an account (local-first, drawdb-style), with cloud sync as an opt-in upgrade later. Before building the share-link feature (Phase 2), we agreed to first harden the local persistence layer (Phase 1), since sharing/collaboration features assume local storage is already solid.

Today, diagrams live in `localStorage` via Zustand `persist` (5MB cap, synchronous — can jank on large schemas), the "Saving..." indicator is a fake timer that doesn't reflect real persistence, there's no way to see/manage all your local diagrams, and no export/import/backup story. This phase fixes all four.

## Architecture note

`store/debounced-storage.ts`'s `createDebouncedStorage` backs **both** `useCanvasStore` (`"canvas-storage"`) and `useEditorStore` (`"editor-storage"`, per-diagram camera state). Swapping its backing store to IndexedDB affects both, and the hydration gate (below) must wait on both stores, not just one.

## 1. localStorage → IndexedDB

- Add `idb-keyval` to `package.json`.
- Modify `store/debounced-storage.ts` in place (both stores get the upgrade automatically): replace `localStorage.getItem/setItem/removeItem` with `idb-keyval`'s `get/set/del` (via a dedicated custom store to namespace it, e.g. `createStore("dbluna-db", "keyval")`). Keep the exact same debounce/pending-map/flush-on-`pagehide`/`visibilitychange` structure — only the read/write primitive goes from sync to async. Wrap idb calls in try/catch (mirroring the existing "storage full — drop the write" comment) for private-browsing/quota edge cases.
- One-time migration, run inside `getItem` (awaited before it returns): if IndexedDB has no value for `name` but `localStorage.getItem(name)` does, copy it into IndexedDB, then `localStorage.removeItem(name)` only after the write resolves. Runs independently for both `"canvas-storage"` and `"editor-storage"` since it's generic over `name`.
- `createDebouncedStorage(delayMs, onWriteComplete?)` gains an optional callback invoked after each successful flush — this is the hook sub-item 2 uses.

## 2. Honest save indicator

- `hooks/use-diagram-autosave.ts`: remove the fake 800ms "saved" timer. Set `"saving"` immediately on any `tables/notes/areas/relationships` change (this part is true — a write really is now pending/debounced). `"saved"` gets set for real via the `onWriteComplete` callback wired into `useCanvasStore`'s `createDebouncedStorage(500, () => set({ savingStatus: "saved" }))` — i.e., the store learns about real persistence directly from the storage layer. Keep a cosmetic `"saved" → "idle"` fade timer (~2s), but move it into `saving-indicator.tsx`'s existing local `displayStatus` state, triggered reactively off `savingStatus === "saved"` rather than the edit event.
- `components/diagram-general/saving-indicator.tsx`: swap `CloudUpload`/`CloudCheck` icons for local-appropriate ones (`HardDrive`/`Save` or similar from lucide-react) and change copy to "Saving…" / "Saved locally" — the current cloud iconography is misleading for what's actually local-only storage. Leave room for a future distinct "Synced" (cloud) state without building it now — that's Phase 3.

## 3. Local diagram manager

- `store/useCanvasStore.tsx`: add `name: string` and `updatedAt: number` to `DiagramData`. In `setDiagramId`, when `newDiagrams[id]` doesn't exist yet (brand-new diagram), stamp `name: "Untitled diagram"` and `updatedAt: Date.now()` at creation. In `partialize`, stamp `updatedAt: Date.now()` on every persist write (it already rebuilds the active diagram's entry on every write — natural place), preserving the existing `name` rather than overwriting it. Add `renameDiagram(id, name)`, `duplicateDiagram(id)` (clone under a fresh `crypto.randomUUID()`, name suffixed " (copy)"), `deleteDiagram(id)`.
- New `components/diagram-sections/top-navbar/my-diagrams-dialog.tsx`: a `Dialog` (same pattern as the existing Create/Rename dialogs in `top-navbar.tsx`) with a `Table` (reuse `components/ui/table.tsx`) listing every entry in `useCanvasStore.diagrams`: name (click → `router.push('/d/' + id)`), table count, last modified, and row actions (rename inline, duplicate, delete via `components/ui/alert-dialog.tsx` confirm — don't build a custom confirm). Sorted by `updatedAt` descending. Reads `useCanvasStore` directly — **does not** touch `useDockStore`.
- **Known pre-existing issue, out of scope for this phase**: `top-navbar.tsx`'s "Diagram Selector" dropdown is wired to `useDockStore` (`store/useDockStore.tsx`), which is a separate, non-persisted, hardcoded mock (`diagrams: ["Diagram A", "Diagram B", "Diagram C"]`) with no connection to `useCanvasStore.diagrams` or the real `/d/[id]` route. It's disconnected placeholder UI. We leave it untouched here and build the new My Diagrams dialog as an independent, correctly-wired surface — reconciling/removing the old dropdown is a separate follow-up.
- `top-navbar.tsx`: add a "My Diagrams" button (next to the existing "DBML Docs" toggle) that opens the new dialog.

## 4. Export / import

- New `lib/diagram-io.ts`: `exportDiagramAsJson(diagram, name)` (versioned envelope `{v: 1, ...}`, Blob download), `exportDiagramAsDbml(tables, relationships, name)` (reuses existing `generateDbmlFromCanvas` from `lib/generator/dbml-generator.ts` unchanged), `parseImportedDiagramJson(text)` (validates shape, rejects unknown `v`).
- `top-navbar.tsx`: "Export" dropdown (Export as JSON / Export as DBML, reusing the already-imported `Download`/`FileText` icons) and an "Import" button (hidden file input, `.json` only). Import always creates a **new** diagram (`crypto.randomUUID()`) via a new `importDiagram(id, data)` store action and navigates to it — never overwrites the diagram currently open.

## Hydration-gating fix (prerequisite for all of the above)

Async IndexedDB rehydration means `CanvasStage`'s mount effect (`setDiagramId(diagramId)`) could fire before real persisted data loads, risking clobbered/lost state.

- `useCanvasStore` and `useEditorStore`: add `hasHydrated: boolean` (default `false`) + setter, excluded from `partialize`. Add `onRehydrateStorage: () => (state, error) => { setHasHydrated(true) }` to both persist configs (fail-open on error, log it).
- New `hooks/use-store-hydration.ts`: `useStoreHydration()` returns `true` only once **both** stores report hydrated.
- `components/diagram-sections/canvas/canvas.tsx`: guard the `setDiagramId`/`setEditorDiagramId` effect with `hasHydrated`, added to its dependency array.
- `app/(diagram)/d/[id]/page.tsx`: call `useStoreHydration()`; render a lightweight loading state (reuse the `Loader2`/`animate-spin` pattern already used in `components/diagram-sections/import-schema-dialog.tsx`) until true, then render the existing tree unchanged.

## Edge cases handled

- **Deleting the currently-open diagram**: navigate away (`router.push("/")`) _before_ removing it from the store, so `CanvasStage` never re-renders against a just-deleted id (which would otherwise silently recreate it via `DEFAULT_DIAGRAM`).
- **Migration race**: delete-after-write-resolves, not delete-before/parallel, so concurrent tabs migrating the same key is benign (last-write-wins on identical source data).
- Both `"canvas-storage"` and `"editor-storage"` get migrated independently since the migration logic is generic over `name`.

## Critical files

- `store/debounced-storage.ts`, `store/useCanvasStore.tsx`, `store/useEditorStore.tsx`
- `hooks/use-diagram-autosave.ts`, new `hooks/use-store-hydration.ts`
- `components/diagram-general/saving-indicator.tsx`
- `components/diagram-sections/canvas/canvas.tsx`, `app/(diagram)/d/[id]/page.tsx`
- `components/diagram-sections/top-navbar/top-navbar.tsx`, new `.../my-diagrams-dialog.tsx`
- new `lib/diagram-io.ts` (reuses `lib/generator/dbml-generator.ts`)

## Verification

1. **IndexedDB swap**: add a table, check DevTools → Application → IndexedDB has the entry; reload → persists; delete entry in DevTools, reload → rehydrates cleanly to empty.
2. **Migration**: seed `localStorage.setItem("canvas-storage", <valid JSON>)` with no IndexedDB entry yet, reload → confirm it moved to IndexedDB and the localStorage key is gone.
3. **Honest indicator**: add a table, confirm "Saving…" → "Saved locally" transitions only after the IndexedDB entry actually updates (not a fixed timer) — verify by watching DevTools' IndexedDB panel refresh.
4. **Diagram manager**: create 3+ diagrams, add tables to each, open My Diagrams → confirm names/counts/timestamps correct, click-to-open navigates, rename/duplicate/delete all update the list and IndexedDB.
5. **Delete-active-diagram**: delete the diagram currently open from the dialog, confirm clean redirect with no resurrected empty diagram at the old URL.
6. **Export/import round-trip**: export a diagram with tables/relationships/notes/areas as `.json`, switch diagrams, import it back → new diagram id created, content matches, original untouched. Export `.dbml`, spot-check against the existing DBML Docs tab for the same diagram.
7. **Hydration gate**: throttle CPU/add artificial delay, confirm a brief loading state appears with no flash of an empty canvas before real data loads, especially on a diagram with existing tables.
