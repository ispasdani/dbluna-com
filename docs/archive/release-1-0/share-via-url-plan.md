# Share via URL — Release 1.0 Implementation Plan

## Context

`artifacts/local_first_sharing_plan.md` (Phase 2) calls for drawdb-style link sharing: compress the
current diagram into the URL fragment, no server, no account, recipient sees a read-only view and can
fork it into their own local copy. [`hardening-local-first-persistance.md`](hardening-local-first-persistance.md)
(Phase 1, done) built the local-first storage this depends on: `useCanvasStore.diagrams` is now the
durable per-diagram record with `name`/`updatedAt`, and `/d/[id]` already reads/writes it correctly
after IndexedDB hydration.

Decisions already made in conversation, carried into this plan:
- A share link is **always view-only**. The only way someone else gets edit access is a real invited
  collaborator (Convex `diagramMembers` roles, Phase 3) — never through a link.
- Viewing a shared link **never requires sign-in**. That's the entire point of a no-account share.
- The size-based fallback (small → URL fragment, large → server snapshot) stays invisible to the user
  except for one conditional line: an expiry note, shown **only** when the fallback path is used. The
  ephemeral-snapshot fallback itself is **Phase 4**, not this plan — for now, a diagram too big for a
  URL disables sharing with an explanation, rather than silently degrading.

### New wrinkle since Phase 1: DBML Docs Integration merged into `main`

[`dbml-docs-integration-plan.md`](dbml-docs-integration-plan.md) landed while this plan was being
drafted and adds `enums: CanvasEnum[]`, `tableGroups: CanvasTableGroup[]`, `project: CanvasProject | null`
to `DiagramData` (`store/useCanvasStore.tsx`). Two consequences for this plan:
1. The compressed share payload must include these three fields too, or a shared link silently drops
   enum/table-group/project data — the same class of bug the merge resolution just fixed for
   export/import.
2. `components/diagram-general/code-editor.tsx` (canvas-mode DBML editor) is now a real two-way bound
   editing surface — typing DBML there parses back into the canvas. A read-only viewer must not expose
   it, not just the drag/resize affordances.

## Recommended architecture

**Render a minimal, dedicated viewer tree at `/d/view` — do not reuse `TopNavbar` / `DockPanel` /
`TabLauncherBar` / the DBML code editor / docs mode.** Concretely: `CanvasStage` (read-only) plus a
small custom header (logo, "Open as copy", nothing else). This is deliberately simpler than gating
every edit affordance across the existing editor chrome (toolbar add-table/note/area buttons, dock
panel field editors, the DBML code editor, My Diagrams, export/import) — none of that renders in the
viewer at all, so there's nothing to individually hide or accidentally leave exposed. It also sidesteps
needing to reason about the DBML code editor's write-back path entirely.

`CanvasStage` itself still gets a `readOnly` prop for defense-in-depth (the viewer reuses it directly,
and it's a small, contained change) — pan/zoom/select keep working, drag/resize/delete initiation and
the connection-drag-to-create-relationship gesture get a top-of-handler early return.

## Proposed changes

### 1. `proxy.ts` — public route for the viewer

Add `"/d/view(.*)"` to `isPublicRoute` (the `(.*)` tolerates future additions without another
middleware edit, per current investigation of `createRouteMatcher`'s matching). This is the one
existing file this plan touches that isn't new — everything else is additive.

### 2. Compression — add `lz-string`

Not currently a dependency (confirmed absent from `package.json` and the whole repo). Add it. Reuse
the **same versioned-envelope shape** `lib/diagram-io.ts` already established for JSON export/import
(`{ v: 1, ...DiagramData-shaped fields }`), so encode/decode and the existing `parseImportedDiagramJson`
validation logic can share a schema-check helper rather than duplicating it. Envelope must include
`enums`/`tableGroups`/`project` (see Context) alongside `tables`/`notes`/`areas`/`relationships`/
`background`/`snapToGrid`/`isFocusModeEnabled`. `name` is included so the viewer can show a title;
`updatedAt` is not meaningful for a snapshot and can be omitted from the wire format.

New `lib/share-link.ts`:
- `encodeDiagramForShare(diagram: DiagramData): string` — build the envelope, `JSON.stringify`,
  `compressToEncodedURIComponent` (lz-string), return the fragment-ready string.
- `decodeDiagramFromShare(fragment: string): DiagramData | null` — inverse, decompress, validate via
  the shared envelope-check (reject unknown `v`, missing arrays), return `null` on anything malformed
  rather than throwing (the viewer route shows an "invalid or corrupted link" state on `null`).
- Size check: `estimateShareLinkSize(diagram)` returning the compressed byte length, so the share
  dialog can apply the soft-warning (~8KB) / hard-cutoff (~32KB) thresholds without compressing twice.

### 3. Read-only canvas mode

- `store/useCanvasStore.tsx`: no store-level flag needed for the viewer itself (see architecture note —
  the viewer never calls store-mutating actions since it hydrates from the decoded fragment into a
  throwaway render, not the persisted store). Add a `readOnly?: boolean` **prop** to `CanvasStage`
  instead, threaded from the two call sites (`/d/[id]/page.tsx` passes `false`/omitted, `/d/view`
  passes `true`).
- `components/diagram-sections/canvas/canvas.tsx`: guard the mutating entry points identified by
  inspection — table/note/area drag-start (`onTablePointerDown`, `onNotePointerDown`,
  `onAreaPointerDown`), resize-handle detection, the connection-drag gesture (`onColumnPointerDown`),
  and the Delete/Backspace keyup branch — each gets an `if (readOnly) return;` at the top. Pan, zoom,
  selection, and the minimap stay fully functional. Table/note/area node components
  (`table-node.tsx`/`note-node.tsx`/`area-node.tsx`) receive the same `readOnly` prop to hide/disable
  their lock/color/delete controls rather than leaving them visible but silently no-op.

### 4. `/d/view` route

New `app/(diagram)/d/view/page.tsx` (inherits the existing `app/(diagram)/layout.tsx` wrapper
automatically, same as `d/[id]` does):
- `"use client"`. On mount, read `location.hash`, strip the leading `#`, call
  `decodeDiagramFromShare`. `null` → render an "This link is invalid or has been corrupted" state.
  Success → render `CanvasStage` fed the decoded data directly as props/local state (not through
  `useCanvasStore` — this is a one-shot render of someone else's data, not something to persist into
  the viewer's own local diagrams until they explicitly fork it).
- Header: logo + diagram name (read-only) + **"Open as copy"** button. That button calls
  `useCanvasStore.getState().importDiagram(crypto.randomUUID(), decodedData)` (the same action Phase 1
  built for JSON import — already creates a new diagram without touching anything the viewer's browser
  already has) and navigates to `/d/<newId>`, handing the recipient an editable local copy.
- No `SavingIndicator`, no `TopNavbar`, no docs mode, no code editor.

### 5. Share dialog

New `components/diagram-sections/top-navbar/share-dialog.tsx`, opened via a **"Share"** button in
`TopNavbar` (next to "My Diagrams" — same placement pattern from Phase 1):
- Reads the active diagram's live fields the same way `handleExportJson` already does in
  `top-navbar.tsx` (tables/notes/areas/relationships/enums/tableGroups/project/background/snapToGrid/
  isFocusModeEnabled/name).
- Calls `estimateShareLinkSize`. Under the soft threshold: show "Copy link" only. Between soft and hard
  threshold: show "Copy link" plus a small non-blocking size hint. At/above the hard cutoff: disable
  "Copy link", show "This diagram is too large to share as a link — export it as JSON/DBML instead"
  (pointing at the Phase 1 export feature; the ephemeral-snapshot fallback that would otherwise handle
  this is Phase 4).
- "Copy link" writes `${origin}/d/view#${encodeDiagramForShare(diagram)}` to the clipboard
  (`navigator.clipboard.writeText`) and shows a brief "Copied" confirmation — no expiry note in this
  plan, since URL-fragment links don't expire (that messaging only applies once Phase 4's ephemeral
  snapshots exist).

## Edge cases

- **Diagram containing enums/tableGroups/project but the recipient's `/d/view` load runs before
  `lz-string` finishes parsing a very old (pre-DBML-integration) link**: `decodeDiagramFromShare`
  defaults missing `enums`/`tableGroups`/`project` to `[]`/`[]`/`null` (mirroring the same backward-
  compatible defaulting already added to `parseImportedDiagramJson` during the merge resolution),
  rather than rejecting the link outright.
- **Malformed/truncated fragment** (copy-paste truncation, manual edits): `decodeDiagramFromShare`
  returns `null` on any decompress/parse/shape failure; the viewer shows the invalid-link state, never
  a partial/garbled canvas.
- **Recipient opens the link while already signed in / mid-editing their own diagram**: `/d/view` is a
  fully separate route from `/d/[id]` and never touches `useCanvasStore`'s persisted `diagrams` record
  until "Open as copy" is clicked, so it can't collide with or overwrite anything already open in
  another tab.

## Critical files

- `proxy.ts` (one-line addition)
- new `lib/share-link.ts` (reuses the envelope-validation approach from `lib/diagram-io.ts`)
- `store/useCanvasStore.tsx` — no data model change, just consumed by the new route
- `components/diagram-sections/canvas/canvas.tsx`, `table-node.tsx`, `note-node.tsx`, `area-node.tsx` —
  add `readOnly` prop + guards
- new `app/(diagram)/d/view/page.tsx`
- new `components/diagram-sections/top-navbar/share-dialog.tsx`, wired into
  `components/diagram-sections/top-navbar/top-navbar.tsx`

## Verification

### Automated
- `npx tsc --noEmit`, `npm run build` clean.
- Add a round-trip test alongside the existing `lib/__tests__/dbml-roundtrip.test.ts` pattern:
  `encodeDiagramForShare` → `decodeDiagramFromShare` returns the original data for a diagram containing
  tables, relationships, notes, areas, enums, table groups, and a project note.

### Manual
1. Build a diagram with at least one table, relationship, note, area, enum, and table group. Open
   Share → Copy link. Paste the link in a private/incognito window (no sign-in prompt) — confirm it
   renders read-only, pan/zoom work, and no edit affordance (drag, resize, delete, lock, add-table,
   code editor, My Diagrams, export) is visible or reachable.
2. Click "Open as copy" — confirm it lands on a new `/d/<id>`, fully editable, with all data intact,
   and the original diagram in the sharer's browser is untouched.
3. Grow a diagram past ~32KB compressed (many tables/columns) — confirm the share dialog disables
   "Copy link" with the size explanation instead of producing a broken/truncated link.
4. Tamper with a copied link's fragment (delete a few characters) and open it — confirm the invalid-
   link state renders, not a partial canvas or a crash.
