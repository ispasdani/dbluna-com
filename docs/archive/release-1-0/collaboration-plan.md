# Collaboration — Release 1.0 Implementation Plan

Single source of truth for the collaboration phase. Supersedes and merges
`collaboration-invites-plan.md` and `realtime-collaboration-plan.md` — both removed.

## Context

[share-via-url-plan.md](share-via-url-plan.md) covers anonymous, read-only viewing via a link.
[paid-editing-access-plan.md](paid-editing-access-plan.md) covers who can edit *their own* diagrams
(paid, signed-in users). Neither covers **becoming a real collaborator on someone else's diagram.**
Today there is no way for a second person to join a diagram at all — `diagrams.ts`'s `create` mutation
inserts exactly one `diagramMembers` row (the owner) and nothing else in the codebase ever inserts
another one.

Collaboration splits into two genuinely separate problems, built as two phases:

- **Phase A — Access**: how a second person gets onto a diagram at all — the owner invites someone, or
  someone requests access and the owner approves it. Confirmed in conversation: neither flow needs a new
  service. Both reuse Convex + Clerk and follow the same self-serve, link-based pattern Phase 2 already
  established for sharing — the owner (or the app) generates a link/record, no email gets sent by the
  app itself. An email provider (Resend pairs natively with Convex) is a later enhancement, not a
  prerequisite.
- **Phase B — Real-time**: what happens once two members are actually on the same diagram at the same
  time — live document sync, a guard against silently overwriting someone else's edit, and presence
  (who's currently here). No live cursors and no CRDT/operational merge in this phase — see Options
  Considered.

**Local-first ↔ cloud tension**: a diagram has no shared source of truth for a second member until its
owner promotes it to cloud storage. This isn't a new problem to solve — [hooks/use-cloud-sync.ts](../hooks/use-cloud-sync.ts)
already has the promotion mechanism (`saveToCloud()`/`makeLocalOnly()`), and IndexedDB persistence
already covers cloud diagrams too (`store/useCanvasStore.tsx` persists the whole `canvas-storage` blob
regardless of `storage` mode) — so "local-first" behavior (instant local reads, offline editing) survives
promotion to cloud. Phase A §4 below is the one piece of new UI this requires: triggering that existing
promotion inline from the Invite dialog. Phase B assumes a `cloudId` already exists by the time any of
it applies.

## Current state

- `diagramMembers` table exists (`owner`/`admin`/`editor`/`viewer` roles, `invitedAt`/`acceptedAt`
  fields) but is only ever written once per diagram, for the owner.
- `convex/guards.ts` has `requireSignedIn`, `requireDiagramRole`, `requireDiagramViewer`,
  `requireDiagramEditor`, `requireDiagramOwnerOrAdmin` — all written, none called by anything.
- No invite mutation, no request-access mutation, no token/link route, no UI for either flow anywhere
  in the app.
- `constants/pricing.tsx` lists "Team members: Free=1, Pro=up to 5, Enterprise=unlimited" — read as a
  **membership cap** (how many people can be added to a diagram), not a promise that every invited
  member edits for free regardless of their own plan. See Phase A §5.
- The cloud-sync path ([hooks/use-cloud-reconciliation.ts](../hooks/use-cloud-reconciliation.ts),
  [hooks/use-cloud-autosave.ts](../hooks/use-cloud-autosave.ts)) is pull-once-on-mount +
  debounced-push-on-change, and the push ([convex/diagrams.ts](../convex/diagrams.ts) `update`)
  overwrites the *entire* document — all tables/relationships/areas/notes as full arrays, no
  field-level merge. Today, with a single owner and no invite path built, that's harmless. The moment
  Phase A ships and a second member can actually edit, this becomes a silent-data-loss bug: two people
  editing the same diagram in different tabs can each hold a stale full snapshot, and whichever
  debounced push lands second wins, discarding the other's changes with no warning to either person.
  Phase B exists to close that gap before/alongside Phase A shipping, not as a "nice to have."

## Phase A — Access: invites & requests

### A1. Schema: a dedicated pending-invite table, not an overloaded `diagramMembers`

Recommend a **new** `diagramInvites` table rather than shoehorning "pending" state into
`diagramMembers` (which would force every existing membership query to start filtering out
not-yet-real members, and `diagramMembers.userId` would need to become optional/nullable to support
inviting someone who doesn't have an account yet):

```ts
diagramInvites: defineTable({
  diagramId: v.id("diagrams"),
  token: v.string(),
  invitedEmail: v.string(),
  role: v.union(v.literal("admin"), v.literal("editor"), v.literal("viewer")),
  createdBy: v.id("users"),
  createdAt: v.number(),
  expiresAt: v.number(),
  usedAt: v.optional(v.number()),
}).index("by_token", ["token"]).index("by_diagram", ["diagramId"]),
```

`invitedEmail` is metadata + a binding check, not a delivery mechanism — the app still never sends an
email itself. It exists so (a) the owner's pending-invite list shows *who* they invited instead of an
anonymous token, and (b) `accept` can refuse to hand out membership to whoever happens to have the link.

### A2. Owner-initiated invite

- `diagramInvites.create({ diagramId, invitedEmail, role })` — guarded by `requireDiagramOwnerOrAdmin`
  (existing, unused guard). Generates a random token, inserts the pending row (default 7-day
  `expiresAt`), returns the token so the caller can build `/d/<diagramId>/join?token=<token>`. Does
  **not** check whether `invitedEmail` belongs to an existing account — same success state either way,
  so the flow never reveals to the owner whether an email is registered (avoids an account-enumeration
  leak).
- `diagramInvites.revoke({ inviteId })` — owner/admin only, for canceling before it's used.
- **New "Invite" dialog** (`components/diagram-sections/top-navbar/invite-dialog.tsx`), separate from
  the existing `ShareDialog` — don't conflate them, they mean different things: `ShareDialog` produces
  an anonymous read-only link with no account required; this produces a link that, once opened by a
  signed-in user whose email matches, grants **real membership**. Email input + role picker
  (editor/viewer) + "Copy invite link". Owner sends it however they want (Slack, email, etc.) — the app
  doesn't send anything. If the diagram is still `storage: "local"` when the dialog opens, show a short
  inline step first — *"Inviting someone syncs this diagram to the cloud so they can access it."* —
  that calls the existing `saveToCloud()` ([hooks/use-cloud-sync.ts](../hooks/use-cloud-sync.ts)) and
  continues into the normal invite UI once `storage` flips to `"cloud"`. The button itself stays
  visible on local diagrams rather than being hidden, matching how every other Pro-gated action in
  `TopNavbar` already works (Export, Share, etc. are always clickable; gating happens on click).
- **New route** `app/(diagram)/d/[id]/join/page.tsx` — stays behind the existing Clerk gate on `/d/*`
  (accepting an invite is exactly the "sign in" moment, so this should *not* be added to
  `proxy.ts`'s public routes). On load: call `diagramInvites.accept({ token })`; on success redirect to
  `/d/<id>`; on expired/used/invalid token, show a clear error state (mirroring `/d/view`'s
  invalid-link state from Phase 2).
- `diagramInvites.accept({ token })` — guarded by `requireSignedIn` (existing). Looks up by token,
  checks not expired/not used, and **checks the caller's Clerk email matches `invitedEmail`**
  (case-insensitive) before doing anything else — reject with a clear "this invite was sent to a
  different email" message otherwise, no membership granted. On a match, inserts a real
  `diagramMembers` row for the caller with the invite's role (regardless of the caller's own plan —
  see A5) and marks `usedAt`.

### A3. Recipient-initiated request

- New `diagramAccessRequests` table: `{ diagramId, requestedBy: Id<"users">, requestedRole:
  "editor"|"viewer", createdAt, status: "pending"|"approved"|"denied" }`.
- `diagramAccessRequests.create({ diagramId, requestedRole })` — guarded by `requireSignedIn`. Called
  from a **"Request edit access"** button shown to a signed-in user who isn't a member of the diagram
  they're looking at.
- `diagramAccessRequests.listPendingForDiagram({ diagramId })` — guarded by
  `requireDiagramOwnerOrAdmin`. Powers a badge/list for the owner.
- `diagramAccessRequests.approve({ requestId })` / `.deny({ requestId })` — owner/admin only. Approve
  inserts a `diagramMembers` row and marks the request approved.
- **UI**: a badge on the "My Diagrams" button in `TopNavbar` (reuses the existing dialog's per-diagram
  rows to list pending requests with approve/deny buttons) — powered by Convex's `useQuery` reactivity,
  no polling, no push infrastructure needed.

### A4. Local-only diagrams: promotion before inviting

An owner can only invite from a diagram that has a `cloudId` — there's no shared record for a second
person to attach to otherwise. Rather than hiding the Invite button on local diagrams (inconsistent
with how every other gated action in this app behaves) or dead-ending on an error, the Invite dialog
detects `storage === "local"` and walks the owner through `saveToCloud()` inline before showing the
invite form — see the dialog description in A2. This is the only new "promotion" behavior needed; the
underlying mechanism (`useCloudSync`) already exists and is already Pro-gated.

### A5. Free-tier members: view-only, not blocked from joining

Membership and edit-capability are deliberately separate. `diagramInvites.accept` grants the invite's
role (editor/viewer) regardless of the accepting user's own plan — a Free-tier invitee still becomes a
real member and can view the diagram. The existing Pro gate (`requireProDiagramEditor`,
`EDITING_GATE_ENABLED`, the `readOnly` store flag) already blocks their writes exactly as it blocks a
Free *owner* today — **no guard changes needed**, and `requireProDiagramEditor` checking the acting
user's own plan (not the diagram owner's) is correct as-is. "Team members: up to 5" on the pricing page
should be read as a membership cap, not a promise that invited members edit for free; worth a footnote
on the pricing page so support doesn't read it as a seat-sharing bug report.

The one real gap: today's upgrade-toast copy (`useUpgradeToastStore`) is owner-framed ("Upgrade to Pro
to edit your diagrams"). It needs a role-aware variant for invited-but-not-Pro members — e.g. *"You were
invited to edit this diagram — upgrade to Pro to make changes."* — so it doesn't read as though they
created the diagram themselves.

### A6. Severing cloud sync must not orphan collaborators

`useCloudSync`'s `makeLocalOnly()` ([hooks/use-cloud-sync.ts](../hooks/use-cloud-sync.ts)) currently
soft-deletes the Convex record and clears the local `cloudId` link unconditionally — fine for a solo
owner, but once `diagramMembers.length > 1` this silently cuts off every invited collaborator's access
with no warning to anyone, including the owner. Add a check before proceeding: block the action
entirely whenever other members exist (an owner who wants out of cloud sync with active collaborators
should remove them first, not accidentally orphan them). A softer "this will remove access for N
people, continue?" confirmation is a reasonable alternative if an outright block feels too strict in
practice.

## Phase B — Real-time: live sync, conflict guard, presence

### B1. Optimistic-lock check on the server (the actual data-loss fix)

`diagrams.update` currently has no idea whether the client's snapshot is stale. Add an
`expectedUpdatedAt: v.number()` arg; the handler compares it to the current doc's `updatedAt` before
patching and throws a distinguishable `ConvexError("CONFLICT")` if they don't match:

```ts
const current = await ctx.db.get(args.diagramId);
if (current.updatedAt !== args.expectedUpdatedAt) {
  throw new ConvexError("CONFLICT");
}
```

This is the enforcement point — client-side comparisons alone can't prevent the race, since two pushes
can both pass a client-side check and still land back-to-back on the server. `expectedUpdatedAt` is
just the client's `lastSyncedAt`, which `useCanvasStore` already tracks per diagram
([lib/diagram-persistence.ts](../lib/diagram-persistence.ts) already threads `remoteUpdatedAt` through
`pushCloudDiagram`'s return value — just needs to also go out on the request).

### B2. Live subscription instead of pull-on-mount

Replace `useCloudReconciliation`'s one-shot `convex.query(api.diagrams.get, ...)` with a reactive
`useQuery(api.diagrams.get, { diagramId })`. When the query result's `updatedAt` advances past the
store's `lastSyncedAt` **and there's no dirty local state pending push**, merge it in via the existing
`importDiagram` path (same as reconciliation does today) — now within ~1 request round-trip instead of
only at mount. When there *is* dirty local state, don't clobber it — that's the conflict case, handled
next.

### B3. Conflict UI

When `doPush()` in `use-cloud-autosave.ts` catches the new `CONFLICT` error: stop the debounce loop,
surface a blocking banner ("[Name] changed this diagram. Reload to see their changes — your local
changes will be lost if you continue editing without reloading.") with a single "Reload" action that
re-pulls and replaces local state. This deliberately does **not** attempt an auto-merge — see Options
Considered. Reuse the existing toast/banner pattern from `useUpgradeToastStore` rather than building a
new notification primitive.

### B4. Presence (who's here)

New table:

```ts
diagramPresence: defineTable({
  diagramId: v.id("diagrams"),
  userId: v.id("users"),
  lastSeenAt: v.number(),
})
  .index("by_diagram", ["diagramId"])
  .index("by_diagram_and_user", ["diagramId", "userId"]),
```

- `diagramPresence.heartbeat({ diagramId })` — guarded by `requireDiagramViewer` (existing, unused
  guard), upserts the caller's row with `lastSeenAt: Date.now()`.
- `diagramPresence.listActive({ diagramId })` — reactive query, guarded by `requireDiagramViewer`,
  returns members with `lastSeenAt` within the last 30s, joined to `users` for name/avatar.
- New `hooks/use-presence.ts`: heartbeats immediately on mount and every 10s while
  `app/(diagram)/d/[id]/page.tsx` is active; no explicit "leave" mutation — the 30s staleness window
  handles disconnects/closed tabs for free.
- New `components/diagram-sections/top-navbar/presence-avatars.tsx` — avatar stack next to the
  Invite/Share buttons, powered directly by `listActive`'s `useQuery` (no polling).
- Cleanup: a `convex/crons.ts` job deleting `diagramPresence` rows older than, say, 10 minutes, so the
  table doesn't grow unbounded. Not load-bearing for correctness (the 30s filter already hides stale
  rows from the UI) — just hygiene.

## Options considered for the Phase B sync model

1. **Chosen: reactive sync + server-enforced conflict guard + presence avatars.** No auto-merge. When
   two people edit concurrently, the second push is rejected and that person is told to reload —
   annoying but honest, and it fixes the actual silent-data-loss bug with a small, bounded change (one
   new arg, one new table, one new hook).
2. **Add live cursors/selection on top of #1.** Same guard underneath — still last-write-wins on
   conflict, just with better "someone's about to step on this" visibility beforehand. Reasonable
   later phase if conflicts turn out to be common in practice; deferred here since it's pure UX polish
   on top of a mechanism that doesn't exist yet.
3. **CRDT/OT-based field-level merge** (e.g. Yjs), replacing the whole-array-dump `update` mutation with
   granular operations so concurrent edits merge instead of racing. This is a genuine rewrite of the
   sync engine and the `diagrams` document shape — multi-week, not a phase. Most comparable tools
   (dbdiagram.io, drawSQL) don't do this either; presence + an honest conflict guard is the norm for
   this category. Not recommended unless usage data shows frequent same-table concurrent edits after
   shipping #1.

## Open questions (flagging rather than deciding unilaterally)

- **Does `/d/view` (the anonymous share link) ever offer "Request access"?** Leaning **no** — that
  route's whole positioning is "no account needed," and prompting sign-in there muddies it. Request
  access should only surface once someone is already signed in and hits a permission wall on
  `/d/[id]`. Worth confirming before building.
- **Invite link lifetime**: defaulting to 7 days, matching the retention language already used for
  Phase 4's (unbuilt) ephemeral snapshots — open to a different default.
- **Single-use vs. reusable invite links**: resolved — A1/A2's email binding means a reusable "anyone
  with this link joins as X" link doesn't pair with a single invited email, so single-use is the only
  design consistent with the rest of this plan.
- **Conflict banner UX (B3)**: hard block (must reload before continuing to edit) vs. soft warning
  (dismiss and keep editing, accepting the overwrite risk)? Leaning hard block — matches the read-only
  gate's existing "no silent data loss" posture — but worth confirming.
- **Presence staleness window (B4)**: 30s proposed; could be tighter (more "live" but more heartbeat
  traffic) or looser.

## Sequencing

Build order: **Phase A, then Phase B.**

- Phase A's request-access half needs a UI moment where a signed-in user hits a wall — that moment is
  created by [paid-editing-access-plan.md](paid-editing-access-plan.md)'s read-only rendering for
  non-members/non-pro users. Phase A's invite half has no hard technical dependency on that plan (an
  owner could invite a collaborator today regardless of billing), but per the pricing page,
  collaboration itself is meant to be Pro-gated — so invite creation should probably call
  `requirePro(owner)` too once that plan's plan data is real, or the two features contradict the
  pricing page on day one.
- Phase B has no hard technical dependency on Phase A — Convex reactivity doesn't care how a second
  `diagramMembers` row got created. In practice, though, there's nothing to test or ship value from
  until a second real member exists, so Phase A ships first and an invited collaborator becomes the
  test case for Phase B.

## Critical files

**Phase A**
- `convex/schema.ts` (`diagramInvites` incl. `invitedEmail`, `diagramAccessRequests` tables)
- new `convex/diagramInvites.ts`, new `convex/diagramAccessRequests.ts`
- `convex/guards.ts` (reuses `requireSignedIn`, `requireDiagramOwnerOrAdmin` — already written)
- new `app/(diagram)/d/[id]/join/page.tsx`
- new `components/diagram-sections/top-navbar/invite-dialog.tsx` (email input, role picker, local→cloud
  promotion step)
- `components/diagram-sections/top-navbar/top-navbar.tsx` (Invite button, pending-request badge)
- `components/diagram-sections/top-navbar/my-diagrams-dialog.tsx` (pending-request list per diagram)
- `hooks/use-cloud-sync.ts` (`makeLocalOnly()` orphan guard — A6)
- `store/useUpgradeToastStore.ts` (role-aware, invitee-framed upgrade copy — A5)

**Phase B**
- `convex/schema.ts` (`diagramPresence` table)
- `convex/diagrams.ts` (`expectedUpdatedAt` arg + conflict check on `update`)
- new `convex/diagramPresence.ts`
- `convex/guards.ts` (reuses `requireDiagramViewer` — already written, unused)
- `hooks/use-cloud-reconciliation.ts` (one-shot query → `useQuery`)
- `hooks/use-cloud-autosave.ts` (send `expectedUpdatedAt`, handle `CONFLICT`)
- `lib/diagram-persistence.ts` (thread `expectedUpdatedAt` through `pushCloudDiagram`)
- new `hooks/use-presence.ts`
- new `components/diagram-sections/top-navbar/presence-avatars.tsx`
- new `convex/crons.ts` (presence cleanup)

## Verification

**Phase A**

1. Owner generates an invite link with role "editor" and an email, opens it in a private window as a
   different signed-in user whose email matches → lands on the diagram with real edit access (not a
   copy — the actual diagram).
2. Same link opened by a signed-in user whose email does *not* match `invitedEmail` → rejected with a
   clear message, no membership granted.
3. Expired or already-used invite link → clear error state, no membership granted.
4. A signed-in non-member hits a permission wall on someone else's diagram, clicks "Request edit
   access" → owner sees it (badge/list) without refreshing (Convex reactivity) → approves → requester's
   next visit to that diagram is editable.
5. Denied request grants no access; revoked invite (before use) can no longer be accepted.
6. Owner clicks Invite on a local-only diagram → prompted to sync to cloud inline → after confirming,
   the normal invite form appears and works as in #1, without a separate flow or page reload.
7. A Free-tier user accepts an "editor" invite → can open and view the diagram immediately; attempting
   to edit shows the invitee-framed upgrade prompt ("You were invited to edit... upgrade to Pro"), not a
   generic error or silent no-op.
8. Owner with 2+ diagram members clicks "Make local-only" → blocked (or requires explicit confirmation
   naming the affected collaborators) rather than silently cutting off their access.

**Phase B**

9. Two signed-in members (via a Phase A invite) open the same cloud diagram in two browser profiles →
   each sees the other's avatar in the presence stack within ~10s.
10. Member A edits a table; without reloading, Member B sees the change land within one debounce cycle
    (no manual refresh needed).
11. Member A and Member B both go offline briefly, edit concurrently, then reconnect — whichever pushes
    second gets the conflict banner, not a silent overwrite; clicking Reload pulls the surviving version
    cleanly.
12. Closing a tab removes that member from the presence stack (for everyone else) within the staleness
    window, with no explicit action needed.
