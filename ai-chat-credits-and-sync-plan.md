# AI Chat: credit metering + Convex-synced history

## Context

[ai-chat-implementation-plan.md](ai-chat-implementation-plan.md) shipped in three phases: the chat
panel + streaming API route (Phase 1), client-side tool-calling so the model can edit the diagram
(Phase 2), and local IndexedDB-persisted chat history (Phase 3). That plan explicitly called out two
things as out of scope for v1 and deferred them here:

- **Usage/cost control** — `users.credits` exists in the Convex schema and is earmarked for this, but
  nothing consumes it.
- **Convex-synced chat history** — local-only was correct for v1; cross-device sync for Pro users
  (matching the diagram cloud-sync pattern) was flagged as "a reasonable phase 2."

This plan covers both. They're bundled together because both changes touch the same request path
(`app/api/ai-chat/route.ts`) and the same panel component, and both depend on the same billing state
now being real (see below).

## Current state (verified, not assumed)

I audited the actual billing/credit wiring before writing this, since the last time this was audited
([release-1-0/paid-editing-access-plan.md](release-1-0/paid-editing-access-plan.md), 2026-07-21) it was
mostly stubs. That's since changed:

- **Billing is real now.** `convex/http.ts`'s Clerk webhook handles `subscription.created/updated/active/
  pastDue` and `subscriptionItem.*` events, resolves the Clerk plan slug to a Convex `plans` row, and
  patches `subscriptionStatus`/`planId`/period fields onto the user — this is live, not a stub.
  `EDITING_GATE_ENABLED = true` in [lib/feature-flags.ts](lib/feature-flags.ts) confirms the gate is
  flipped on in production.
- **New users get `credits: 0` explicitly** on `user.created` (`convex/http.ts` line 56) — so the field
  is initialized, but:
- **Nothing ever increments `credits`, and nothing decrements it.** I grepped every reference to
  `credits` in the codebase (`convex/schema.ts`, `convex/http.ts`, `convex/users.ts`) — it's read/written
  as a passthrough field and never touched by any business logic. Every user, Free or Pro, sits at 0
  forever. **If we gate AI chat on `credits > 0` today with no grant mechanism, nobody could ever use
  it** — that gap has to be closed as part of this plan, not left for later.
- **The Free-vs-Pro gate for AI chat is already correct.** `app/(diagram)/d/[id]/page.tsx` computes
  `editingReadOnly = EDITING_GATE_ENABLED && !isPro` and threads it into `DockPanel` →
  `AiChatPanel({ readOnly })`, which swaps the composer for an upsell affordance when `readOnly`. The
  server route independently re-checks via `fetchQuery(api.users.getCurrentUserPlan)` before streaming.
  Both layers already block free users — this plan doesn't need to touch that, just verify it (see
  Verification §1).
- **`constants/pricing.tsx` already advertises "AI credits purchase"** as Pro/Enterprise-only, with no
  specific amount and Enterprise getting "Volume discount" — i.e. credits are marketed as a purchasable
  add-on, not an unlimited Pro perk. No checkout flow for that purchase exists anywhere. Building that
  checkout is explicitly **not** in this plan (see "Explicitly out of scope" below) — this plan only
  makes the *metering* real (grant a starter allotment + enforce + display), the same way the paid-
  editing plan separated "make plans real" from "build the checkout UI."
- **Diagram cloud sync is a heavy, conflict-aware system** (`hooks/use-cloud-autosave.ts` +
  `hooks/use-cloud-reconciliation.ts`): debounced push, stale-push rejection via `expectedUpdatedAt`,
  a blocking `ConflictBanner` on genuine conflicts, last-write-wins semantics. It's opt-in per diagram
  (`diagrams[id].storage === "cloud"`, flipped by a UI action in `my-diagrams-dialog.tsx`). I'm
  deliberately **not** reusing this machinery for chat — see below.

## Recommended approach

### A. Credit metering

**Unit of metering: 1 credit = 1 user turn.** One `POST /api/ai-chat` call consumes exactly 1 credit,
regardless of how many of the up-to-8 tool-call steps (`stepCountIs(8)`) happen inside it. Simple,
predictable, and lets the UI say "N questions/requests left" without needing to explain step-counting.
Per-tool-call or token-based metering is more accurate to actual Gemini cost but adds real complexity
for a v1 — flagging as a future refinement, not doing it now.

**Enforcement is server-side and atomic — the only place this can be enforced, same as every other
paid-gate lesson from `paid-editing-access-plan.md`.** Add a new Convex mutation:

```ts
// convex/users.ts
export const consumeAiCredit = mutation({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireSignedInPro(ctx); // reuses guards.ts, unchanged
    const remaining = user.credits ?? 0;
    if (remaining <= 0) {
      throw new ConvexError({ code: "OUT_OF_CREDITS" });
    }
    await ctx.db.patch(user._id, { credits: remaining - 1 });
    return { remaining: remaining - 1 };
  },
});
```

Being a single Convex mutation, the read-then-patch is transactional — two concurrent requests from the
same user (e.g. two tabs) can't both read `credits: 1` and both succeed. This is why it must be one
mutation call from the route, not a separate query-then-mutation from the client.

`app/api/ai-chat/route.ts` calls this **after** the existing Pro check and **before** `streamText`:

```ts
try {
  await fetchMutation(api.users.consumeAiCredit, {}, { token });
} catch {
  return NextResponse.json(
    { success: false, error: "Out of AI credits." },
    { status: 402 } // Payment Required — distinct from the 403 Pro-gate response
  );
}
```

Credit is spent up front, not refunded if the model call itself errors after that — same "ship the
honest, ship-now version" posture the paid-editing plan took; a refund-on-failure path is a reasonable
fast-follow, not a blocker.

**Closing the "nobody ever has credits" gap.** Grant a starter allotment on a genuine Free→Pro
transition, inside `convex/http.ts`'s `applyPlanUpdate` (the shared handler for `subscription.*` /
`subscriptionItem.*` events):

```ts
// inside applyPlanUpdate, before the existing updateUser patch
const wasActive = existingUser?.subscriptionStatus === "active";
const becomingActivePro = args.status === "active" && plan?.slug === "pro";
const creditGrant = !wasActive && becomingActivePro ? AI_CHAT_STARTER_CREDITS : undefined;
```

then include `credits: (existingUser?.credits ?? 0) + creditGrant` in the patch only when
`creditGrant` is set. The `!wasActive` check matters: `subscription.updated` and the `subscriptionItem.*`
events can all fire for the same underlying subscription (renewal, metadata changes, etc.) — without
gating on the *transition*, a user would get re-granted credits on every incidental webhook, not just
once on upgrade.

**Open question for you, not something I'm deciding unilaterally:** the exact starter amount
(`AI_CHAT_STARTER_CREDITS`) and whether it should reset every billing period (`currentPeriodStart`
changing) or just be a one-time grant. I'm recommending **one-time grant on first upgrade, no
auto-reset** for v1 — resetting-on-renewal is a real feature (has to distinguish "renewal" from "any
other subscription.updated") that I'd rather scope separately once the one-time version is proven out.
Buying *more* credits (the pricing page's "AI credits purchase" line) needs a real checkout item and is
out of scope here entirely.

**Client UX.** Extend `getCurrentUserPlan`'s return shape to include `credits`:

```ts
// convex/users.ts — getCurrentUserPlan handler, extend the return
return { isPro: isPro(user, plan), credits: user.credits ?? 0 };
```

`AiChatPanel` subscribes via `useQuery(api.users.getCurrentUserPlan)` (same query the page already
calls) for a live "N credits left" indicator in the header, and adds a second gated state alongside the
existing `readOnly` one: when Pro but `credits <= 0`, swap the composer for a distinct "Out of AI
credits" message (not the "Upgrade to Pro" copy — the user's already Pro, that copy would be wrong).

### B. Convex-synced chat history

**Deliberately much simpler than diagram sync, because the data shape is different.** A diagram is one
mutable document multiple people can edit concurrently, so it needs last-write-wins + conflict
detection. Chat messages are **append-only** — once sent, a message never changes — so there's no
conflict to detect. Reusing `use-cloud-autosave.ts`'s debounce/retry/conflict-banner machinery here
would be solving a problem this feature doesn't have.

**New table, one row per message** (not one row per diagram with an embedded array, unlike `diagrams`):

```ts
// convex/schema.ts
aiChatMessages: defineTable({
  diagramId: v.id("diagrams"),
  messageId: v.string(), // matches the client's UIMessage.id — see idempotency below
  role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
  parts: v.any(), // UIMessagePart[] — polymorphic (text/tool-call/tool-result/...), not worth
                   // encoding exactly; mirrors plans.features' existing v.any() precedent
  createdBy: v.id("users"),
  createdAt: v.number(),
})
  .index("by_diagram", ["diagramId"])
  .index("by_diagram_and_created", ["diagramId", "createdAt"]),
```

**`convex/aiChatMessages.ts`** — reuses `guards.ts`'s existing diagram-role guards verbatim, nothing new
needed there:

```ts
export const list = query({
  args: { diagramId: v.id("diagrams") },
  handler: async (ctx, args) => {
    await requireProDiagramViewer(ctx, args.diagramId); // already written, unused elsewhere until now
    return ctx.db
      .query("aiChatMessages")
      .withIndex("by_diagram_and_created", (q) => q.eq("diagramId", args.diagramId))
      .order("asc")
      .collect();
  },
});

export const append = mutation({
  args: {
    diagramId: v.id("diagrams"),
    messageId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    parts: v.any(),
  },
  handler: async (ctx, args) => {
    const { user } = await requireProDiagramEditor(ctx, args.diagramId);

    // Idempotent on messageId — a retried push after a flaky connection
    // must not duplicate the row.
    const existing = await ctx.db
      .query("aiChatMessages")
      .withIndex("by_diagram", (q) => q.eq("diagramId", args.diagramId))
      .filter((q) => q.eq(q.field("messageId"), args.messageId))
      .first();
    if (existing) return existing._id;

    return ctx.db.insert("aiChatMessages", {
      diagramId: args.diagramId,
      messageId: args.messageId,
      role: args.role,
      parts: args.parts,
      createdBy: user._id,
      createdAt: Date.now(),
    });
  },
});
```

**Trigger condition — reuses the existing opt-in, no new UI.** Sync only runs when the *diagram itself*
is already cloud-synced (`useCanvasStore.getState().diagrams[id]?.storage === "cloud"`) — the same
condition `useCloudAutoSave` checks. A diagram that hasn't opted into cloud sync gets AI chat exactly as
Phase 3 left it: local IndexedDB only, zero Convex calls. This means no new "sync my chat" toggle to
design or explain — it inherits the diagram's existing cloud status.

**Client wiring, new `hooks/use-cloud-ai-chat-sync.ts`** (kept out of `ai-chat-panel.tsx` itself so the
panel doesn't need to know whether it's local or cloud-backed, mirroring how `CanvasStage` doesn't know
either):

- **Pull:** `useQuery(api.aiChatMessages.list, needsSync ? { diagramId: cloudId } : "skip")`. On first
  resolution, merge into `useAiChatStore` for that diagram (same store Phase 3 built — cloud becomes an
  additional source that merges in, IndexedDB stays the offline-first cache, exactly the relationship
  `useCloudReconciliation` has with `useCanvasStore`).
- **Push:** call `append` once per *completed* message, not per token. `useChat`'s `onFinish` callback
  (fires once when an assistant turn finishes streaming) is the hook point — push the user message that
  started the turn and the finished assistant message together at that point. Streaming partial content
  to Convex mid-turn would be both wasteful and pointless (nobody needs to see a remote collaborator's
  chat mid-token).
- **No debounce, no conflict banner, no retry-on-stale needed** — appends can't conflict, and a missed
  push just means that message shows up locally-only until the next successful one; nothing to reconcile
  against.

**Why this is safe to build as genuinely simpler than diagram sync, not just "simpler for now":**
multiple devices/collaborators watching the same diagram's chat see new messages arrive live through the
reactive `useQuery` (same mechanism `diagramPresence` already uses elsewhere in the app for live
collaborator state) — full real-time sync, at a fraction of the diagram-sync code.

## Explicitly out of scope (naming it, not glossing over it)

- **Credit purchase / top-up checkout.** The pricing page already advertises this; building it means a
  Clerk Billing (or Stripe) one-off purchase item + a webhook to apply the top-up. Separate project,
  same way `paid-editing-access-plan.md` split "make plans real" from "build the checkout UI."
- **Monthly credit reset/replenishment.** Flagged above as an open question — v1 ships one-time grant
  only.
- **Refund-on-failure for spent credits** when the model call errors after the credit's already
  deducted.
- **Per-tool-call or token-based metering** instead of flat per-turn.
- **Chat sync for non-cloud diagrams.** Not applicable — there's nothing to sync to.

## Files to add / change

- `convex/schema.ts` — new `aiChatMessages` table.
- `convex/aiChatMessages.ts` — new: `list`, `append`.
- `convex/users.ts` — new `consumeAiCredit` mutation; extend `getCurrentUserPlan` to also return
  `credits`.
- `convex/http.ts` — `applyPlanUpdate`: grant `AI_CHAT_STARTER_CREDITS` once on a genuine Free→Pro
  transition (needs the pre-patch user doc to check `wasActive`, so this also needs to fetch the
  existing user row before patching, which it doesn't do today).
- `lib/ai/credits.ts` (new, small) — the `AI_CHAT_STARTER_CREDITS` constant, isolated so the number is
  easy to find and tune without hunting through `http.ts`.
- `app/api/ai-chat/route.ts` — call `consumeAiCredit` after the Pro check, before `streamText`; return
  402 on failure.
- `components/diagram-general/ai-chat-panel.tsx` — live credit counter in the header via
  `useQuery(api.users.getCurrentUserPlan)`; new "out of credits" composer state distinct from
  `readOnly`; wire the pull/merge side of cloud sync when applicable.
- `hooks/use-cloud-ai-chat-sync.ts` (new) — pull (`useQuery` + merge into `useAiChatStore`) and push
  (`append` on `onFinish`) for cloud-synced diagrams only.

## Verification

1. Free user (readOnly already true today) — composer stays hidden as it already is; confirm
   `POST /api/ai-chat` still independently 403s without a Pro session (this is Phase 1's existing
   check, just re-confirming it still holds).
2. Fresh Pro user (just granted `AI_CHAT_STARTER_CREDITS` via the webhook transition) — composer works,
   credit counter visible and decrements by 1 per turn, matches server-side balance without a page
   reload.
3. Drive a Pro user's credits to 0 (either by chatting or manually in the Convex dashboard) — composer
   swaps to "Out of AI credits," and `POST /api/ai-chat` returns 402 when called directly.
4. Simulate `subscription.active` firing twice in a row for the same user (webhook resend/retry) —
   confirm credits are granted once, not twice.
5. Two browser sessions signed in as the same user, same cloud-synced diagram, both with AI Chat open —
   a message sent in one appears in the other without a manual refresh.
6. A diagram not opted into cloud sync — AI chat still works exactly as Phase 3 (local-only), and
   network tab shows zero `aiChatMessages` calls.
