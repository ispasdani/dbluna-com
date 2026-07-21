# Collaboration Invites & Access Requests — Release 1.0 Implementation Plan

## Context

[share-via-url-plan.md](share-via-url-plan.md) covers anonymous, read-only viewing via a link.
[paid-editing-access-plan.md](paid-editing-access-plan.md) covers who can edit *their own* diagrams
(paid, signed-in users). Neither covers the third case: **becoming a real collaborator on someone
else's diagram.** Today there is no way for a second person to join a diagram at all — `diagrams.ts`'s
`create` mutation inserts exactly one `diagramMembers` row (the owner) and nothing else in the codebase
ever inserts another one.

This plan builds the two ways a second person gets access, matching the direction from our
conversation: **the owner invites someone**, or **someone requests access and the owner approves it**.
Confirmed in conversation: neither flow needs a new service. Both reuse Convex + Clerk and follow the
same self-serve, link-based pattern Phase 2 already established for sharing — the owner (or the app)
generates a link/record, no email gets sent by the app itself. An email provider (Resend pairs
natively with Convex) is a later enhancement, not a prerequisite.

## Current state

- `diagramMembers` table exists (`owner`/`admin`/`editor`/`viewer` roles, `invitedAt`/`acceptedAt`
  fields) but is only ever written once per diagram, for the owner.
- `convex/guards.ts` has `requireSignedIn`, `requireDiagramRole`, `requireDiagramViewer`,
  `requireDiagramEditor`, `requireDiagramOwnerOrAdmin` — all written, none called by anything.
- No invite mutation, no request-access mutation, no token/link route, no UI for either flow anywhere
  in the app.
- `constants/pricing.tsx` lists "Collaboration (up to 5 members)" as a **Pro-only** feature — so
  whether someone is even *allowed* to invite a collaborator ultimately depends on
  [paid-editing-access-plan.md](paid-editing-access-plan.md)'s plan data being real, not just on this
  plan's mechanics. See Sequencing below.

## Proposed changes

### 1. Schema: a dedicated pending-invite table, not an overloaded `diagramMembers`

Recommend a **new** `diagramInvites` table rather than shoehorning "pending" state into
`diagramMembers` (which would force every existing membership query to start filtering out
not-yet-real members, and `diagramMembers.userId` would need to become optional/nullable to support
inviting someone who doesn't have an account yet):

```ts
diagramInvites: defineTable({
  diagramId: v.id("diagrams"),
  token: v.string(),
  role: v.union(v.literal("admin"), v.literal("editor"), v.literal("viewer")),
  createdBy: v.id("users"),
  createdAt: v.number(),
  expiresAt: v.number(),
  usedAt: v.optional(v.number()),
}).index("by_token", ["token"]).index("by_diagram", ["diagramId"]),
```

### 2. Owner-initiated invite

- `diagramInvites.create({ diagramId, role })` — guarded by `requireDiagramOwnerOrAdmin` (existing,
  unused guard). Generates a random token, inserts the pending row (default 7-day `expiresAt`), returns
  the token so the caller can build `/d/<diagramId>/join?token=<token>`.
- `diagramInvites.revoke({ inviteId })` — owner/admin only, for canceling before it's used.
- **New "Invite" dialog** (`components/diagram-sections/top-navbar/invite-dialog.tsx`), separate from
  the existing `ShareDialog` — don't conflate them, they mean different things: `ShareDialog` produces
  an anonymous read-only link with no account required; this produces a link that, once opened by a
  signed-in user, grants **real membership**. Role picker (editor/viewer) + "Copy invite link". Owner
  sends it however they want (Slack, email, etc.) — the app doesn't send anything.
- **New route** `app/(diagram)/d/[id]/join/page.tsx` — stays behind the existing Clerk gate on `/d/*`
  (accepting an invite is exactly the "sign in" moment, so this should *not* be added to
  `proxy.ts`'s public routes). On load: call `diagramInvites.accept({ token })`; on success redirect to
  `/d/<id>`; on expired/used/invalid token, show a clear error state (mirroring `/d/view`'s
  invalid-link state from Phase 2).
- `diagramInvites.accept({ token })` — guarded by `requireSignedIn` (existing). Looks up by token,
  checks not expired/not used, inserts a real `diagramMembers` row for the caller with the invite's
  role, marks `usedAt`.

### 3. Recipient-initiated request

- New `diagramAccessRequests` table: `{ diagramId, requestedBy: Id<"users">, requestedRole:
  "editor"|"viewer", createdAt, status: "pending"|"approved"|"denied" }`.
- `diagramAccessRequests.create({ diagramId, requestedRole })` — guarded by `requireSignedIn`. Called
  from a **"Request edit access"** button shown to a signed-in user who isn't a member of the diagram
  they're looking at.
- `diagramAccessRequests.listPendingForDiagram({ diagramId })` — guarded by
  `requireDiagramOwnerOrAdmin`. Powers a badge/list for the owner.
- `diagramAccessRequests.approve({ requestId })` / `.deny({ requestId })` — owner/admin only. Approve
  inserts a `diagramMembers` row and marks the request approved.
- **UI**: a badge on the "My Diagrams" button in `TopNavbar` (reuses the Phase 1 dialog's existing
  per-diagram rows to list pending requests with approve/deny buttons) — powered by Convex's `useQuery`
  reactivity, no polling, no push infrastructure needed.

## Open questions (flagging rather than deciding unilaterally)

- **Does `/d/view` (the anonymous share link) ever offer "Request access"?** I'd lean **no** — that
  route's whole positioning is "no account needed," and prompting sign-in there muddies it. Request
  access should only surface once someone is already signed in and hits a permission wall on
  `/d/[id]`. Worth confirming before building.
- **Invite link lifetime**: defaulting to 7 days, matching the retention language already used for
  Phase 4's (unbuilt) ephemeral snapshots — open to a different default.
- **Single-use vs. reusable invite links**: recommend single-use per invite (safer — a leaked
  admin/editor invite link can't be replayed by multiple people). A reusable "anyone with this link
  joins as viewer" link could be a nice power-user feature later; not in this plan's v1.

## Sequencing dependency

The **request-access** half needs a UI moment where a signed-in user hits a wall — that moment is
created by [paid-editing-access-plan.md](paid-editing-access-plan.md)'s read-only rendering for
non-members/non-pro users. The **invite** half has no hard technical dependency on that plan (an owner
could invite a collaborator today regardless of billing), but per the pricing page, collaboration
itself is meant to be Pro-gated — so invite creation should probably call `requirePro(owner)` too once
that plan's plan data is real, or the two features contradict the pricing page on day one.

## Critical files

- `convex/schema.ts` (`diagramInvites`, `diagramAccessRequests` tables)
- new `convex/diagramInvites.ts`, new `convex/diagramAccessRequests.ts`
- `convex/guards.ts` (reuses `requireSignedIn`, `requireDiagramOwnerOrAdmin` — already written)
- new `app/(diagram)/d/[id]/join/page.tsx`
- new `components/diagram-sections/top-navbar/invite-dialog.tsx`
- `components/diagram-sections/top-navbar/top-navbar.tsx` (Invite button, pending-request badge)
- `components/diagram-sections/top-navbar/my-diagrams-dialog.tsx` (pending-request list per diagram)

## Verification

1. Owner generates an invite link with role "editor", opens it in a private window as a different
   signed-in user → lands on the diagram with real edit access (not a copy — the actual diagram).
2. Expired or already-used invite link → clear error state, no membership granted.
3. A signed-in non-member hits a permission wall on someone else's diagram, clicks "Request edit
   access" → owner sees it (badge/list) without refreshing (Convex reactivity) → approves → requester's
   next visit to that diagram is editable.
4. Denied request grants no access; revoked invite (before use) can no longer be accepted.
