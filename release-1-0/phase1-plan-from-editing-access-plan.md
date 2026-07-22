# Phase 1 (code-only) — Real plan assignment via Clerk Billing

## Context

[paid-editing-access-plan.md](../../../../D:/Officials/dbluna-com/release-1-0/paid-editing-access-plan.md)
lays out 4 phases to gate diagram editing behind a paid plan. Phase 1 is the prerequisite: make
`users.subscriptionStatus`/`planId` reflect real Clerk Billing data instead of being permanently
`undefined`. The user has picked **Clerk Billing** and will configure the actual Free/Pro Plans in the
Clerk dashboard tomorrow — that half is out of scope here. This plan covers everything on the code side
that can be built and verified _without_ those dashboard Plans existing yet, so it's ready to go live
the moment they are created.

I verified the current state directly against the installed SDK rather than guessing at webhook shapes:
`node_modules/@clerk/backend/dist/api/resources/JSON.d.ts` and `Webhooks.d.ts` (pinned via
`@clerk/nextjs@^6.36.3`) define the exact Billing webhook event types Clerk will send — used below
instead of assumed payload shapes. Also confirmed: `app/api/activate/route.ts` (the mock "always pro"
stub) has zero callers anywhere in the app (`grep` found only the plan doc referencing it) — safe to
delete outright rather than leave as a contradictory no-op. No `/pricing` page exists yet, even though
`proxy.ts` already reserves it as a public route.

## What ships in this pass

1. **`convex/schema.ts`** — add `slug: v.string()` + `.index("by_slug", ["slug"])` to the `plans` table.
   This is the missing link between Clerk's `plan.slug` (from the webhook payload) and our Convex
   `plans` row; nothing else in the schema needs to change (subscription fields already exist on
   `users`, per the original plan's audit).

2. **`convex/plans.ts`** (new) —
   - `internalQuery getBySlug({ slug })`: looks up a `plans` row by slug.
   - `internalMutation seed`: idempotent upsert of two rows — `{ slug: "free", name: "FREE" }` and
     `{ slug: "pro", name: "PRO" }`, carrying over the feature limits already advertised in
     `constants/pricing.tsx` (diagram cap, tables/diagram, collaborators) into the `features` field for
     future enforcement (§4 of the original plan). Run manually once via `npx convex run plans:seed` —
     not wired to any trigger.
   - **Slug convention**: tomorrow's Clerk Plans should be named so their auto-generated (or explicitly
     set) slugs are exactly `free` and `pro`, matching what `seed` inserts and what the webhook handler
     below looks up. I'll call this out explicitly in my final summary.

3. **`convex/http.ts`** — extend the existing `/clerk` webhook switch:
   - `user.created`: after `createUser`, resolve the `FREE` plan via `internal.plans.getBySlug` and pass
     its `_id` as `planId` (defaults new users to Free explicitly, per the original plan's §1). If the
     plan isn't seeded yet, this is a no-op (`planId` stays unset) — safe, `isPro` still resolves to
     `false`.
   - New case for `subscription.created` / `subscription.updated` / `subscription.active` /
     `subscription.pastDue` (type `BillingSubscriptionWebhookEvent`, data shape
     `BillingSubscriptionWebhookEventJSON`): read `data.payer.user_id` (skip/200 if absent — org-payer
     subscriptions don't apply, this app has no org billing), pick the subscription item to treat as
     "current" (prefer `status === "active"`, else the first item), resolve its `plan.slug` via
     `internal.plans.getBySlug`, and `ctx.runMutation(internal.users.updateUser, { clerkId, planId,
subscriptionId: data.id, subscriptionStatus: item.status, currentPeriodStart, currentPeriodEnd })`
     — converting the item's `period_start`/`period_end` (unix ms numbers per the SDK types) to ISO
     strings to match the existing `v.string()` schema fields.
   - New case for `subscriptionItem.active` / `.updated` / `.canceled` / `.ended` / `.abandoned` /
     `.pastDue` (type `BillingSubscriptionItemWebhookEvent`): same patch logic, sourced from
     `data.payer?.user_id` and `data.plan` directly (skip/200 if `payer` is absent, per the SDK type
     it's optional on this event). Covers item-level transitions that may not always re-fire a
     `subscription.*` event.
   - Both new cases share one small helper (`applyPlanUpdate` in `http.ts`) to avoid duplicating the
     plan-lookup + `updateUser` call.
   - `default:` case is unchanged (still 200-and-ignore for every other event type).

4. **`convex/migrations.ts`** (new) — `internalMutation grandfatherExistingUsersToPro`: one-time,
   manually-triggered mutation that patches every `users` row currently missing `subscriptionStatus` to
   `{ subscriptionStatus: "active", planId: <PRO plan id> }`. Built now per the original plan's §3
   rollout-ordering requirement (don't let existing users get locked out once the editing gate ships),
   but **not run** as part of this pass — it's only useful once the Pro plan is seeded, and running it
   is a deliberate one-time action for the user to trigger when ready, not something to automate.

5. **`app/(marketing)/pricing/page.tsx`** (new) — renders Clerk's `<PricingTable />` component (from
   `@clerk/nextjs`), which auto-lists whatever Plans are marked "Publicly available" in the Clerk
   dashboard and handles the checkout flow itself (no custom Stripe code needed). Matches the
   `(marketing)` route group's existing layout (`app/(marketing)/layout.tsx`). This is the "actual page
   with working checkout" the original plan calls for in §1.

6. **`constants/pricing.tsx`** — change the Pro tier's `ctaLink` from `/sign-up` (a route that doesn't
   currently exist — pre-existing gap, not touched here) to `/pricing`, so the homepage's existing
   pricing section (`components/marketing-sections/pricing.tsx`, already rendered on
   `app/(marketing)/page.tsx`) routes into the new real checkout page instead of a dead link. Free tier
   CTA (`/w`) and Enterprise (`/contact`) are unchanged.

7. **Delete `app/api/activate/route.ts`** — confirmed zero callers in the app. Leaving the "always pro"
   mock in place would be an exploitable contradiction once real billing exists, per the original plan's
   critical-files note.

## Explicitly not in this pass (later phases)

- No changes to `CanvasStage`, `top-navbar.tsx`, or `toolbar.tsx` (the actual editing gate, §2 of the
  original plan) — shipping that now would lock out every current user, since `isPro` is `false` for
  everyone until real Clerk Plans exist and the grandfather migration runs. That's next, after tomorrow's
  dashboard setup.
- No `users.getCurrentUserPlan` query yet — it's only needed by the §2 gate.
- No enforcement of the 5-diagram free cap (§4, explicitly flagged as separate follow-on work).

## Verification

1. `npx convex dev` (or deploy) picks up the schema change and new functions without errors.
2. `npx convex run plans:seed` inserts two `plans` rows (`free`/FREE, `pro`/PRO); running it again is a
   no-op patch, not a duplicate insert.
3. Visit `/pricing` — page renders (will show "no plans configured" or similar from Clerk until
   tomorrow's dashboard setup adds real Plans; confirms the route and component wiring work today).
4. Homepage → Pricing section → Pro tier "Get started" now links to `/pricing` instead of `/sign-up`.
5. `curl`/Convex logs confirm `/clerk` webhook route still 200s on existing `user.created`/`updated`/
   `deleted` events (regression check — untouched cases).
6. `app/api/activate` returns 404 (route removed); confirm no other route or client code referenced it
   (already verified via grep).
7. End-to-end billing flow (subscription webhook actually firing, plan showing up on a real user) can
   only be verified tomorrow once Clerk Plans exist — noted as a follow-up, not blocking this pass.
