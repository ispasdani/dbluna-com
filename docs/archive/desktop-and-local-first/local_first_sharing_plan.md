# Implementation Plan: Local-First Diagrams & No-Account Sharing

Make dbluna fully usable without an account or any cloud storage (drawdb-style), with
cloud save as an explicit opt-in upgrade. Four phases, each independently shippable.

## Current State (verified in code)

- `store/useCanvasStore.tsx` already persists all diagrams to **localStorage** via
  Zustand `persist` (`name: "canvas-storage"`, keyed per `activeDiagramId` in a
  `diagrams` record). Local persistence exists today.
- `hooks/use-diagram-autosave.ts` is a **simulation** — it only animates the
  Saving/Saved indicator with `setTimeout`; it never calls Convex.
- `convex/diagrams.ts` has full CRUD (`create`, `get`, `list`, `update`,
  `deleteDiagram`) with membership checks, but nothing in the canvas flow calls it.
- `diagrams.publicId` + `by_publicId` index exist in `convex/schema.ts` but no public
  route uses them.

Conclusion: the app is already de facto local-only. The work is (1) hardening local
persistence, (2) serverless sharing, (3) wiring Convex as an *opt-in* second backend,
(4) ephemeral server-side shares for large diagrams.

---

## Phase 1 — Harden local-first persistence

**Goal:** anonymous users get durable diagrams; storage won't silently break on big schemas.

1. **Move persistence from localStorage to IndexedDB.**
   - localStorage caps at ~5MB and is synchronous; a few large imported schemas can hit it.
   - Add `idb-keyval` and pass a custom `storage` to the existing `persist` config
     (`createJSONStorage(() => idbStorage)`); Zustand supports async storages natively.
   - Migration: on first load, if `canvas-storage` exists in localStorage, copy it into
     IndexedDB and delete the localStorage key.
2. **Make the save indicator honest.**
   - `useDiagramAutoSave` should reflect real persistence: "Saved locally" after the
     persist write flushes (subscribe to store changes / `persist.onFinishHydration`),
     instead of the current fake timer.
   - Indicator states: `Saved locally` (anonymous / local mode) vs `Synced` (cloud
     mode, Phase 3).
3. **Local diagram manager.**
   - A "My diagrams" view (route or modal) listing entries from the persisted
     `diagrams` record: name, table count, last modified. Rename / duplicate / delete.
   - Store currently keys diagrams by route `id`; add a `name` and `updatedAt` per
     `DiagramData` entry so the list is meaningful.
4. **Export / import files.**
   - Export current diagram as `.json` (full `DiagramData`) and `.dbml` (reuse the
     existing DBML tooling). Import `.json` back. This is the zero-trust escape hatch
     and a backup story before any cloud exists.

**Acceptance:** clear site data warning aside, an anonymous user can create 10 diagrams,
close the browser, come back, and everything is intact; a 200-table imported schema
persists without quota errors.

## Phase 2 — Share via URL (no storage anywhere)

**Goal:** drawdb-style "send a link" with zero server involvement.

1. Add `lz-string` (tiny, made for this: `compressToEncodedURIComponent`).
2. **Encode:** serialize `{v: 1, name, tables, relationships, notes, areas}` →
   compress → place in the **URL fragment**: `/d/view#<blob>`. Fragments are never
   sent to the server, so the schema never touches infrastructure.
3. **New route `app/(diagram)/d/view/page.tsx`:**
   - Client component; on mount reads `location.hash`, decompresses, validates shape
     (versioned envelope, reject unknown `v`), hydrates a **read-only** canvas.
   - Read-only mode: reuse `CanvasStage` with interactions disabled (a `readOnly` flag
     through the store or a prop) — pan/zoom yes, edit no.
   - "Open as copy" button: writes the decoded diagram into the local store under a
     new id and navigates to `/d/<newId>` — the receiver can now edit their own copy.
4. **Share dialog** in `TopNavbar`: "Copy link" + size feedback. If the compressed
   blob exceeds ~8KB, show a hint that the link is getting long; above ~32KB
   (conservative cross-browser/messenger limit), disable URL sharing and point to
   file export (or Phase 4 ephemeral link once it exists).

**Acceptance:** share a 30-table diagram from one browser profile to another with no
account and no network storage; receiver can view and fork it locally.

## Phase 3 — Opt-in cloud sync (wire up Convex for signed-in users)

**Goal:** cloud becomes the upgrade (cross-device sync, teams), never a requirement.

1. **Persistence adapter seam.** Define a small interface so the store stays the
   single source of truth and backends are pluggable:
   ```ts
   interface DiagramPersistence {
     load(id: string): Promise<DiagramData | null>;
     save(id: string, data: DiagramData): Promise<void>;
   }
   ```
   Implementations: `localPersistence` (wraps the existing persist storage) and
   `convexPersistence` (calls `api.diagrams.get` / `api.diagrams.update`).
2. **Per-diagram storage mode.** Add `storage: "local" | "cloud"` to each diagram's
   metadata. Existing local diagrams stay local. New diagrams default to local.
3. **"Save to cloud" action** (visible when signed in via Clerk):
   - Calls `api.diagrams.create` with the current state as `initialData`, marks the
     local entry `storage: "cloud"`, maps local id → Convex id.
   - Reverse path "Make local-only": pull latest, write to IndexedDB, soft-delete in
     Convex (`deleteDiagram`).
4. **Real autosave for cloud diagrams.** Rework `useDiagramAutoSave`:
   - Debounce (~1.5s after last change), diff-check, then `persistence.save(...)`.
   - Status: `saving → synced`, with `sync error — retry` on failure (keep local copy
     as truth; Convex is a replica that catches up).
   - Note: `api.diagrams.update` takes full-state dumps — fine at this stage; delta
     sync only matters when realtime collab arrives.
5. **Schema alignment fix (required before sync works):** the Convex `diagrams` table
   validators don't include `background` / `snapToGrid` (they live in
   `userPreferences`-adjacent canvas state) and the store's `DiagramData` doesn't
   include `camera`. Reconcile: add `camera` to what autosave sends; keep
   `background`/`snapToGrid` local-only (they're view prefs, not document data).

**Acceptance:** signed-in user clicks "Save to cloud" on a local diagram, opens it on
a second device, edits, and sees the edit reflected back on the first (on reload —
realtime subscriptions can come later via `useQuery`).

## Phase 4 — Ephemeral anonymous share links (large diagrams)

**Goal:** share links for diagrams too big for a URL, with a clear privacy story.

1. **New Convex table `sharedSnapshots`:**
   `{ publicId: string, data: bytes-or-json, createdAt: number, expiresAt: number }`,
   index `by_publicId`, no user linkage at all.
2. **Mutations:** `sharedSnapshots.create` (rate-limited — e.g. by IP or a
   lightweight anonymous cookie introduced for this purpose; returns `publicId`)
   and a public `sharedSnapshots.get`.
3. **Convex cron** (daily): delete rows past `expiresAt` (default 7 days; picker for
   1/7/30 days in the share dialog).
4. Share dialog logic becomes: small diagram → URL fragment (Phase 2); large →
   ephemeral snapshot link `/d/s/<publicId>` rendering the same read-only viewer.
   Copy in the dialog states the retention plainly: "Stored anonymously, auto-deleted
   after N days."

**Acceptance:** a 300-table diagram gets a working share link; the row disappears
after expiry; nothing ties the snapshot to a user.

---

## Sequencing & effort

| Phase | Depends on | Rough size |
|---|---|---|
| 1 IndexedDB + honest saves + manager + export | — | 2–4 days |
| 2 URL sharing + read-only viewer | 1 (viewer reuses read-only mode) | 2–3 days |
| 3 Convex opt-in sync | 1 (adapter seam) | 3–5 days |
| 4 Ephemeral snapshots | 2 (viewer), 3 optional | 1–2 days |

Phases 1+2 alone deliver the full drawdb story (local, free, shareable, no account) and
are pure frontend. Phase 3 is where accounts start paying for themselves. Phase 4 is a
small add-on once the viewer exists.

## Risks / notes

- **Read-only canvas mode** is the one piece both share viewers need and that doesn't
  exist yet; build it once in Phase 2 as a store-level `readOnly` flag rather than
  scattering `if` checks through components.
- **Clearing browser data deletes local diagrams.** Mitigate with visible "Saved
  locally" language, easy export, and (Phase 3) one-click cloud backup.
- **URL length limits** vary by messenger/browser more than by spec — hence the
  conservative 32KB cutoff and automatic fallback.
- The current `partialize` in `useCanvasStore` merges active-canvas state back into
  the `diagrams` record on every write; keep that behavior when swapping storage,
  it's what makes multi-diagram local persistence work.
