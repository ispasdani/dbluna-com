# Paid Editing Access — Release 1.0 Implementation Plan

## Context

Business direction (2026-07-21): the only people who can perform any action on a diagram
(create/edit tables, notes, areas, relationships, etc.) are **signed-in, paid users**. Everyone else —
anonymous visitors and signed-in free-tier users alike — can only **view**. The one no-account viewing
path is the read-only share link built in [share-via-url-plan.md](share-via-url-plan.md); a viewer who
wants to actually change something has to sign in and be on a paid plan (or get invited as a
collaborator by the diagram's owner, once Phase 3 collaboration exists — not built yet).

This directly **reverses** my prior recommendation (previous session) to open up `/d/[id]` to
anonymous visitors. Under this business model that would be wrong: `proxy.ts` should keep gating
`/d/[id]` behind Clerk sign-in exactly as it does today. Nothing about that route's auth needs to
change — the gap is entirely on the *paid* side, which currently doesn't exist at all.

## Current state (verified, not assumed)

I audited the existing plan/billing scaffolding before writing this, because it looked more complete
than it is:

- **`convex/guards.ts`** already has `isPro(user)` (checks `subscriptionStatus === "active"`),
  `requirePro(user)`, and diagram-role guards (`requireDiagramViewer`/`Editor`/`OwnerOrAdmin`) — but
  **nothing in the codebase calls any of them**. `convex/diagrams.ts`'s mutations use ad-hoc inline
  checks instead.
- **No payment provider is integrated anywhere.** `app/api/activate/route.ts` is a mock "offline
  license" endpoint that hardcodes `tier: "pro"` for *any* authenticated user — its own comment says
  *"In a real app, this would verify the user's subscription tier in Stripe/Clerk before issuing the
  offline license."* It's a stub, not a real entitlement check.
- **The Clerk→Convex user sync is real** (`convex/http.ts`'s `/clerk` webhook, svix-verified, calls
  `internal.users.createUser`/`updateUser`/`deleteUser` on `user.created`/`updated`/`deleted`) — but it
  never sets `planId`, `subscriptionStatus`, or any billing field. **Every user's `subscriptionStatus`
  is `undefined` forever**, so `isPro(user)` returns `false` for 100% of real users today, including
  anyone who'd consider themselves a paying customer if such a thing existed.
- **The `plans` table has never been seeded** — no FREE/PRO documents exist anywhere.
- **`constants/pricing.tsx`** (Free: "Up to 5 diagrams", "Public diagrams only"; Pro: "Unlimited
  diagrams & tables", "Private & protected diagrams", "Collaboration") **isn't rendered on any page** —
  it's orphaned marketing copy with zero enforcement behind any of its claims (the "5 diagram" cap
  isn't checked in `diagrams.create` either).
- **Editing is 100% local today.** `useDiagramAutoSave` writes to IndexedDB via the Phase-1 debounced
  storage layer — there is no per-edit round-trip to Convex. `convex/diagrams.ts`'s `update` mutation
  exists but nothing in the running app calls it yet (that's Phase 3, "opt-in cloud sync," still
  unbuilt).

**Consequence that shapes this whole plan:** because editing never touches a server today, gating it
can only be a **client-side UI restriction** at first — there is no request to intercept and reject.
A technically motivated free user could still mutate `useCanvasStore` directly via devtools. Closing
that gap for real requires Phase 3 (cloud sync) to exist, so edits go through a Convex mutation that
can call `requirePro`/`requireDiagramEditor` server-side. This plan builds the honest, ship-now version
and calls out the hardening step as a named follow-on, not something silently glossed over.

## Recommended approach

### 1. Real plan assignment (prerequisite — nothing below means anything without this)

Recommend **Clerk Billing** (Stripe under the hood, managed through Clerk) over hand-rolling Stripe
directly: Clerk is already the auth provider and already has a webhook pipeline into Convex
(`convex/http.ts`), so this is meaningfully less new integration surface than standing up Stripe
Checkout + Stripe webhooks + a second secret/signing setup from scratch. If there's a reason to prefer
raw Stripe (e.g. pricing/fee concerns, needing checkout flows Clerk Billing doesn't support), swap this
step for direct Stripe + a new webhook route — the rest of the plan (steps 2-4) doesn't change either
way, since it only depends on `users.subscriptionStatus`/`planId` being populated by *something* real.

- Configure a Free and a Pro plan in Clerk's dashboard (or Stripe, if going that route).
- Extend `convex/http.ts`'s Clerk webhook handling (or add a Stripe webhook route under `app/api/`) to
  write real `subscriptionId`/`subscriptionStatus`/`currentPeriodStart`/`currentPeriodEnd`/`planId`
  onto the `users` row — the mutation args already exist in `convex/users.ts`, they've just never been
  called with real values.
- Seed the `plans` table for real (`FREE`, `PRO` documents) — currently empty.
- **Default new users to the FREE plan explicitly** on `user.created` (right now they get no `planId`
  at all, which is indistinguishable from "not signed in" as far as `isPro` is concerned — that's fine
  for the gate itself, but explicit is better than implicit for anything that later needs to
  distinguish "no account" from "free account").
- Wire the orphaned `constants/pricing.tsx` into an actual page with working "Get started"/"Upgrade"
  buttons that kick off the real checkout flow.

### 2. The actual editing gate (reuses Phase 2 infrastructure, doesn't rebuild it)

`CanvasStage` already has a `readOnly` prop (built for the anonymous share-link viewer in
[share-via-url-plan.md](share-via-url-plan.md) §3) that disables every mutating interaction — drag,
resize, delete, relationship-creation, note-text-editing — while keeping pan/zoom/selection. Reuse it
verbatim rather than building new gating:

- **`app/(diagram)/d/[id]/page.tsx`**: fetch the signed-in user's plan (a small new Convex query,
  `users.getCurrentUserPlan` or similar, using the existing `isPro` helper from `guards.ts`) and pass
  `readOnly={!isPro}` into `CanvasStage`.
- **`components/diagram-sections/top-navbar/top-navbar.tsx`**: when `!isPro`, hide the same set of
  editing affordances the read-only viewer already hides implicitly by not rendering at all — "My
  Diagrams" create/rename, Export stays available (viewing your own export is reasonable even on
  free), Import should probably be Pro-gated too since it creates editable content. Show a small
  "Upgrade to edit" prompt in place of the hidden actions rather than just disappearing them silently.
- **`components/diagram-sections/toolbar.tsx`** (`TabLauncherBar`): hide Add Table/Note/Area and the
  schema-import dialog trigger when `!isPro`, same pattern.

### 3. Rollout ordering (avoids locking out every current user)

Because `isPro` returns `false` for everyone today, **shipping §2 before §1 is fully live would make
every existing signed-in user permanently read-only** — a severe regression, not a soft rollout. Do not
merge the gate until: real plan data exists for at least the people who should currently have edit
access (either because they've gone through real checkout, or because of a one-time manual/seeded
grandfather-in for existing users while billing stands up). A feature flag or staged deploy for §2 is
worth it even though this app doesn't currently have a flag system — the cost of getting this ordering
wrong (existing users suddenly can't edit their own diagrams) is high enough to warrant it.

### 4. Known related gap (flagging, not in scope here)

The 5-diagram free-tier cap advertised on the pricing page has no enforcement anywhere in
`diagrams.create`. Once §1 makes plans real, that's a natural follow-on (`requirePro` or an explicit
count check in `diagrams.create`) — separate piece of work, not bundled into this plan since it's a
creation-time limit rather than an editing-permission question.

## Hardening note (explicitly deferred, not forgotten)

The client-side `readOnly` gate in §2 is a UX restriction, not a security boundary — it stops the
product from *inviting* free users to edit, it doesn't stop a determined one from doing it via
devtools, because there's no server in the loop for local edits. Real enforcement requires Phase 3
(cloud sync): once `useDiagramAutoSave` writes through a real `diagrams.update` Convex mutation, that
mutation should call `requirePro`/`requireDiagramEditor` from `guards.ts` (already written, unused) to
reject writes server-side. This plan intentionally ships the honest, ship-now version first rather than
blocking on Phase 3.

## Critical files

- `convex/http.ts`, `convex/users.ts` (plan/subscription write path)
- `convex/schema.ts` (seed `plans`, nothing structural to change — fields already exist)
- `convex/guards.ts` (`isPro`, `requirePro` — already written, just needs callers)
- `app/(diagram)/d/[id]/page.tsx`, `components/diagram-sections/canvas/canvas.tsx` (reuses existing
  `readOnly` prop, no new canvas-level work)
- `components/diagram-sections/top-navbar/top-navbar.tsx`, `components/diagram-sections/toolbar.tsx`
- `constants/pricing.tsx` + new pricing/checkout page
- `app/api/activate/route.ts` — either replace with real entitlement issuance or remove once real
  billing exists; leaving the mock "always pro" stub in place alongside a real gate would be a
  contradictory, exploitable no-op.

## Verification

1. New user signs up → Convex `users` row has `planId` pointing at FREE, `subscriptionStatus` unset →
   opening `/d/<id>` renders read-only (no add-table/note/area, no drag/resize/delete, "Upgrade to
   edit" visible).
2. User completes real checkout → webhook updates `subscriptionStatus: "active"`, `planId` → PRO →
   same diagram, same page, now fully editable without re-login.
3. Anonymous visitor still can't reach `/d/[id]` at all (unchanged — Clerk gate stays). A share link to
   the same diagram still opens `/d/view` and renders read-only with no account, exactly as before.
4. Existing pre-launch users are not silently locked out the moment §2 ships (confirms §3's rollout
   ordering held).
