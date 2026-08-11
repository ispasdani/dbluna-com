# Version History — Release 1.0 Implementation Plan

## Context

[things left to do.md](../things%20left%20to%20do.md) lists version history as "advertised, no code at
all" — `constants/pricing.tsx:221` already lists it as a Pro/Enterprise feature in the comparison table,
but there is no `diagramVersions` table, no server code, and no UI anywhere in the app.

Researched whether a comparable tool (drawDB) offers this locally, since local-first is this app's
default mode. It doesn't: drawDB's OSS/local tier only has a session-scoped undo/redo timeline (lost on
reload) plus IndexedDB autosave of the *current* state only. Persistent version history is exclusively a
drawDB Pro + cloud feature there too — no existing local-history precedent to draw from, in this app or
the comparable one.

This plan follows [collaboration-plan.md](collaboration-plan.md)'s established pattern instead:
**version history is cloud-only and Pro-gated, full stop.** There's no server-side row to snapshot
against for a diagram that only lives in IndexedDB, and the feature is already sold as Pro/Enterprise on
the pricing page. A local diagram gets no history until it's promoted — same answer as collaboration's
"you must sync to cloud to invite someone."

## Current state

- No `diagramVersions` table, no `convex/diagramVersions.ts`, no UI.
- `diagrams.update` ([convex/diagrams.ts](../convex/diagrams.ts)) already does the relevant things this
  plan builds on: a full-document patch mutation, guarded by `requireProDiagramEditor`, with an
  `expectedUpdatedAt` optimistic-lock check (Phase B §1 of the collaboration plan) that already throws a
  distinguishable `ConvexError("CONFLICT")`.
- `use-cloud-autosave.ts` debounces pushes to that mutation on every local change (1.5s), whole-document
  dump — the same call this plan hooks snapshotting into.
- `InviteDialog` ([components/diagram-sections/top-navbar/invite-dialog.tsx](../components/diagram-sections/top-navbar/invite-dialog.tsx))
  already has the exact `storage === "local"` → "sync to cloud & continue" branch this plan's `HistoryDialog`
  should copy structurally.
- `useCloudSync(localId)` ([hooks/use-cloud-sync.ts](../hooks/use-cloud-sync.ts)) already makes
  `saveToCloud()` fail with a `not-pro` reason and surface an upgrade alert — this plan relies on that
  existing gate rather than adding a second one.

## Design

### 1. Schema

```ts
diagramVersions: defineTable({
  diagramId: v.id("diagrams"),
  createdAt: v.number(),
  createdBy: v.id("users"),
  kind: v.union(v.literal("promotion"), v.literal("auto"), v.literal("manual")),
  label: v.optional(v.string()), // only set for kind: "manual"
  // Full snapshot — same shape as the diagrams table's own content fields.
  name: v.string(),
  tables: v.array(/* same object shape as diagrams.tables */),
  relationships: v.array(/* same as diagrams.relationships */),
  areas: v.array(/* same as diagrams.areas */),
  notes: v.array(/* same as diagrams.notes */),
  enums: v.optional(v.array(/* same as diagrams.enums */)),
  tableGroups: v.optional(v.array(/* same as diagrams.tableGroups */)),
  project: v.optional(v.object(/* same as diagrams.project */)),
  camera: v.object({ x: v.number(), y: v.number(), zoom: v.number() }),
})
  .index("by_diagram", ["diagramId"])
  .index("by_diagram_and_created", ["diagramId", "createdAt"]),
```

Full snapshots, not diffs — matches how `diagrams` itself already stores full arrays rather than
field-level deltas, so no new serialization format to invent.

### 2. Trigger model: hybrid, decided server-side

The auto-snapshot threshold check must live **inside** `diagrams.update`, not client-side in
`use-cloud-autosave.ts`. With collaboration live, multiple devices/collaborators can each be
independently debouncing pushes to the same diagram — if the "has it been long enough since the last
snapshot" check lived client-side, every client would need a round-trip to find out anyway (defeats the
point), and concurrent pushes could race into duplicate snapshots. Server-side, inside the same
transaction as the patch, there's one source of truth:

- **Auto**: on every `update` call, look up the newest `diagramVersions` row for that diagram — **of any
  kind**, not just `auto`. If it's older than 30 min (confirmed), insert a version of the **pre-patch**
  state before applying the patch. Checking the newest row regardless of kind means a manual save resets
  the auto-clock too, per your "the time should be reset after each save" — the next auto-snapshot only
  fires 30 min after whichever save (auto or manual) happened most recently, not 30 min after the last
  *auto* one specifically.
- **Manual**: `update` gains an optional `versionLabel: v.optional(v.string())` arg. When present, insert
  a version of the **post-patch** state tagged `kind: "manual"` with that label — "checkpoint exactly
  what I see right now." Reuses the exact same mutation and payload the autosave already sends; no new
  race between "did the debounce flush yet" and "did the checkpoint fire."
- **Promotion**: `saveToCloud()` → `createCloudDiagram` inserts a `kind: "promotion"` version at the
  moment a local diagram first gets a `cloudId`, so there's always a version 1 to fall back to.

### 3. Retention

Proposing: unlimited `manual` and the one `promotion` version are kept forever; `auto` versions are
capped to the most recent 20 per diagram (oldest auto version deleted when the 21st is inserted, inside
the same `update` transaction). Keeps storage bounded without a cron job. Open to a time-bucketed scheme
(hourly for a day, daily after, à la GitHub) later if 20 proves too few in practice — not worth the
complexity for a first version.

### 4. Restore

`diagramVersions.restore({ diagramId, versionId })`:
1. Snapshot the **current** state first, `kind: "auto"` — makes restore itself non-destructive; undoing
   a bad restore is just restoring again.
2. Patch `diagrams` with the target version's content fields, bump `updatedAt`.

No new local-sync code needed on the client: Phase B of the collaboration plan already replaced
pull-on-mount with a reactive `useQuery(api.diagrams.get, ...)` that merges in server changes whenever
`updatedAt` advances and there's no dirty local state pending push — a restore is just another
`updatedAt` bump from that query's point of view, on every connected device/collaborator.

**Restoring never deletes anything** — confirmed per your question. `restore` only ever *inserts* a row
(the pre-restore auto-snapshot); it never deletes the version being restored *to*, versions in between,
or any other row. The only deletion in this whole plan is §3's pruning, which only removes the single
oldest `auto` row once the cap is exceeded — it can't touch the specific version involved in a restore
unless that version happens to also be the single oldest auto row on the list, and even then, restoring
*to* it doesn't protect it from that unrelated pruning pass. `manual` and `promotion` versions are never
pruned regardless of age.

### 5. Gating and permissions

- **Cloud-only, click-time gate** — the History button in `TopNavbar` stays visible always (matches
  Export/Share/Invite's existing "gate on click, not on visibility" pattern), and `HistoryDialog` copies
  `InviteDialog`'s exact `storage === "local"` branch: show "Sync to cloud & continue" via the existing
  `useCloudSync(localId).saveToCloud()`, which already fails with a `not-pro` alert for Free users. One
  prompt covers both "you're local" and "you're Free" — no separate Pro pre-check needed before it.
- **Viewing — resolved, and simpler than originally proposed**: a Free-tier user gets no History access
  at all, full stop — not a degraded/partial view. New `requireProDiagramViewer` guard
  (`requireDiagramViewer` + `requirePro`, mirroring `requireProDiagramEditor`'s existing composition)
  gates `diagramVersions.list` entirely on the *requesting* user's own plan. This changes nothing about
  how a Free user normally opens the diagram — `diagrams.get` is untouched, so they still always see
  "the main one, the latest saved version" exactly as today. History is an extra Pro-only lens on top of
  that, not a different diagram-loading path.
- **Restoring — resolved: any editor**, not owner/admin-only. Reuses the existing
  `requireProDiagramEditor` guard as-is (no new guard needed) — same permission level as a normal edit,
  since editors can already freely rewrite the live document anyway and (per §4 above) restoring can't
  destroy any existing version row.

### 6. UI

- New `components/diagram-sections/top-navbar/history-dialog.tsx`, structurally identical to
  `InviteDialog`: local → cloud-promotion step, else a list of versions (relative timestamp, who made
  it — join `createdBy` to `users`, label if manual) each with a "Restore" button, available to any
  editor. No diff summary in v1 (confirmed) — plain list first.
- A "Save version" manual-checkpoint entry point somewhere reachable before a risky change — simplest is
  a button inside `HistoryDialog` itself ("Save current state as a version") rather than a separate
  top-navbar button, since it's a low-frequency action.
- New `components/diagram-sections/top-navbar/history-button.tsx` (or inline in `top-navbar.tsx` next to
  the Invite button, same as `presence-avatars.tsx` sits nearby).

## Options considered

1. **Chosen: hybrid trigger, full snapshots, cloud+Pro gated.** Smallest change that gives real safety
   (auto) and real intent (manual), reusing the existing `update` mutation's transaction and the
   existing cloud-promotion UX wholesale.
2. **Manual-only.** Simpler (no threshold logic, no pruning), but offers no protection against damage
   nobody thought to checkpoint before — rejected per your earlier call to go hybrid.
3. **Diffs instead of full snapshots.** Smaller storage per version, but this app's whole sync model is
   already full-array dumps (`diagrams.update` has no field-level patching), so diffing would be a new
   serialization concern solely for this feature. Not worth it until storage actually becomes a problem.
4. **Local version history (session timeline or IndexedDB-persisted snapshots).** Investigated via
   drawDB as a possible precedent — doesn't exist there either in any persisted form. Rejected: no
   server-side record for a second device or collaborator to ever see, and duplicates work the cloud
   path already does properly.

## Decisions (previously open, now resolved)

- **Viewer gating**: Free users get no History access at all — always see latest only, same as today.
  Pro-only, no partial/degraded view for Free collaborators.
- **Restore permission**: any editor (reuses `requireProDiagramEditor` as-is), not owner/admin-only —
  restoring can't destroy any existing version, so it's no more dangerous than a normal edit.
- **Auto-snapshot threshold**: 30 min, confirmed. Resets on *any* save (auto or manual), not just auto.
- **Auto-version cap**: 20, confirmed as the starting default — easy to retune once there's usage data.
- **Diff summary in the list UI**: not in v1 — plain timestamp + author list first.

## Sequencing

No hard dependency on anything unbuilt — Phase A/B of collaboration are both already shipped, and this
plan only *reads* their existing pieces (`useCloudSync`, the reactive `diagrams.get` query, the
`update` mutation's transaction). Can be built standalone:

1. Schema + `convex/diagramVersions.ts` (`create` internal helper used by `update`/`saveToCloud`, `list`,
   `restore`).
2. `diagrams.update`'s auto-threshold check + `versionLabel` arg + pruning.
3. `createCloudDiagram`'s promotion snapshot.
4. `HistoryDialog` + button wiring in `top-navbar.tsx`.

## Critical files

- `convex/schema.ts` (`diagramVersions` table)
- new `convex/diagramVersions.ts`
- `convex/diagrams.ts` (`update`'s auto-snapshot + `versionLabel` + pruning; `create`'s cloud-promotion
  snapshot — or wherever `createCloudDiagram`'s server-side mutation lives)
- `convex/guards.ts` (new `requireProDiagramViewer` for `list`; `restore` reuses existing
  `requireProDiagramEditor`)
- new `components/diagram-sections/top-navbar/history-dialog.tsx`
- `components/diagram-sections/top-navbar/top-navbar.tsx` (History button)
- `hooks/use-cloud-sync.ts` (reused as-is, no changes expected)

## Verification

1. Free user, local diagram → click History → cloud-promotion prompt → confirming fails with the
   existing "Upgrade to Pro" alert, no version created.
2. Pro user, local diagram → click History → cloud-promotion prompt → confirming succeeds → panel opens
   showing one `promotion` version.
3. Pro user edits, waits past the auto-threshold, edits again → a new `auto` version appears capturing
   the state *before* the second edit.
4. Pro user clicks "Save current state as a version" with a label → a `manual` version appears
   immediately with that label and the state at click time (not stale from a pending debounce).
5. Any editor (not just the owner) restores an older version → current state is overwritten, a fresh
   `auto` version of what was just replaced appears first in the list (restore is itself reversible, and
   the restored-to version plus everything in between is still in the list, untouched) → a second
   connected device/collaborator sees the restored state without manually reloading (Phase B's reactive
   query).
6. Free-tier collaborator (Pro owner's diagram) clicks History → sees the standard upgrade prompt, no
   list shown; opening the diagram itself is completely unaffected — still shows latest content.
7. Editor saves a manual version at minute 10 of a session → the next auto-snapshot doesn't fire until
   minute 40 (30 min after the manual save), not minute 30 (30 min after session start).
8. 21st auto-version triggers pruning of the oldest auto version only; manual and promotion versions are
   never pruned regardless of age.
