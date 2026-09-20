import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import {
  getCurrentUserDoc,
  isPro,
  requireSignedIn,
  requireSignedInPro,
} from "./guards";
import { assertGlobalCapacity, recordSpend } from "./aiSpend";
import {
  AI_CHAT_MONTHLY_CREDITS,
  AI_RATE_LIMIT_WINDOW_MS,
  AI_TURNS_PER_MINUTE,
  creditPeriodKey,
  effectiveCredits,
} from "../lib/ai-credits";

// Helpers
const now = () => Date.now();
const cleanPatch = <T extends Record<string, unknown>>(obj: T) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

// `getUserByClerkId` used to live here: a public query taking any clerkId and
// returning that user's whole row — email, subscription id, billing status,
// credits — with no auth check at all. Convex queries are reachable by anyone
// holding the deployment URL, which ships in the browser bundle, and Clerk
// user ids are not secrets. It had no callers, so it is gone rather than
// guarded. `getMe` is the authenticated equivalent.

// Non-throwing counterpart for internal callers that need to check "does
// this user exist yet, and what's their current state" without treating
// "not found" as exceptional — used by http.ts's webhook handler, where a
// billing event can legitimately arrive before the user.created webhook has
// been processed.
export const getByClerkIdInternal = internalQuery({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();
  },
});

/**
 * Preferred in-app query:
 * - requires auth (Clerk)
 * - returns the Convex user record for the current session
 */
export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const clerkId = identity.subject;
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();

    if (!user) throw new ConvexError("User not found");
    return user;
  },
});

/**
 * Non-throwing plan check for UI gating (release-1-0/paid-editing-access-plan.md
 * §2) — signed-out or not-yet-synced users just resolve to `{ isPro: false }`
 * instead of an error state, since "not pro" is the correct read-only default
 * for both cases.
 */
export const getCurrentUserPlan = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserDoc(ctx);
    if (!user) return { isPro: false, credits: 0 };
    const plan = user.planId ? await ctx.db.get(user.planId) : null;

    // Reports the refilled balance rather than last month's leftovers. A
    // query can't write, so the reset is only persisted on the next spend —
    // but the panel must show the new month's allowance immediately, not 0%
    // until the user sends a message into what looks like an empty account.
    return {
      isPro: isPro(user, plan),
      credits: effectiveCredits(user),
      allowance: AI_CHAT_MONTHLY_CREDITS,
    };
  },
});

/**
 * Reserves one AI chat credit before a turn starts. A credit is no longer a
 * flat "one message" — it's a unit of cost (see lib/ai-credits.ts) — but the
 * true cost isn't known until the turn finishes, so the route reserves the
 * minimum here and settles the remainder via `settleAiCredits` afterwards.
 *
 * Read-then-patch inside a single Convex mutation is transactional, so two
 * concurrent requests from the same user (e.g. two tabs) can't both read
 * `credits: 1` and both succeed — this must stay one mutation call from the
 * route, never a separate query-then-mutation from the client.
 */
export const reserveAiCredit = mutation({
  // Floor cost of the prompt the route is about to send, from
  // `minimumCreditsForRequest`. Reserving it (rather than a flat 1) stops a
  // large request being started on a balance that plainly can't cover it, and
  // shrinks the overdraft the settlement can leave behind.
  args: { minimumCredits: v.optional(v.number()) },
  handler: async (ctx, { minimumCredits }) => {
    const { user } = await requireSignedInPro(ctx);

    // Order matters. The org-wide breaker runs first: when it's tripped,
    // something is wrong with metering itself, and we want to stop before
    // touching any user's balance. Then the per-user rate limit, then the
    // balance — cheapest, most-likely-to-reject checks after the one that
    // protects us most.
    await assertGlobalCapacity(ctx);

    const now = Date.now();
    const windowStart = user.aiTurnWindowStart ?? 0;
    const withinWindow = now - windowStart < AI_RATE_LIMIT_WINDOW_MS;
    const turnsSoFar = withinWindow ? (user.aiTurnsInWindow ?? 0) : 0;

    if (turnsSoFar >= AI_TURNS_PER_MINUTE) {
      throw new ConvexError({ code: "RATE_LIMITED" });
    }

    // Refills lazily: a balance stored against a past month reads as a full
    // allowance, and this write commits it. No webhook, no cron, nobody
    // missed. See `effectiveCredits`.
    const periodKey = creditPeriodKey(now);
    const remaining = effectiveCredits(user, periodKey);

    // Strictly positive: a balance already overdrawn by the previous turn's
    // settlement must not start another one.
    if (remaining <= 0) {
      throw new ConvexError({ code: "OUT_OF_CREDITS" });
    }

    const reserved = Math.max(
      1,
      Math.ceil(Number.isFinite(minimumCredits ?? 1) ? (minimumCredits ?? 1) : 1)
    );

    // Distinct from OUT_OF_CREDITS: they have allowance left, just not enough
    // for a request this size. The client says so rather than letting them
    // describe a large refactor and only then discover it can't run.
    if (reserved > remaining) {
      throw new ConvexError({ code: "REQUEST_TOO_LARGE_FOR_BALANCE" });
    }

    await ctx.db.patch(user._id, {
      credits: remaining - reserved,
      creditsPeriodKey: periodKey,
      aiTurnWindowStart: withinWindow ? windowStart : now,
      aiTurnsInWindow: turnsSoFar + 1,
    });
    await recordSpend(ctx, reserved);

    return { remaining: remaining - reserved, reserved };
  },
});

/**
 * Charges whatever the finished turn cost beyond the credit already reserved.
 *
 * The balance is allowed to go negative: the alternative is refusing to bill a
 * turn we've already paid Google for. The overdraft is bounded by one turn
 * (MAX_CREDITS_PER_TURN), and `reserveAiCredit` blocks the next turn until the
 * balance is positive again.
 *
 * Deliberately `requireSignedIn`, not `requireSignedInPro`: if a subscription
 * lapses between the start and end of a turn, we still want to record what it
 * cost rather than throw and lose the charge.
 */
export const settleAiCredits = mutation({
  args: { additionalCredits: v.number() },
  handler: async (ctx, { additionalCredits }) => {
    const user = await requireSignedIn(ctx);

    // Non-finite or negative values would corrupt the balance — a refund path
    // would need to be deliberate, not an accident of a bad usage report.
    if (!Number.isFinite(additionalCredits) || additionalCredits <= 0) {
      return { remaining: user.credits ?? 0 };
    }

    const charged = Math.ceil(additionalCredits);
    const remaining = (user.credits ?? 0) - charged;

    await ctx.db.patch(user._id, { credits: remaining });
    await recordSpend(ctx, charged);

    return { remaining };
  },
});

/**
 * Create a user. Idempotent:
 * - If the user already exists, we patch any newly-provided fields and return the id.
 * - If not, insert.
 *
 * Call this from your Clerk webhook or your "ensure user" flow.
 */
export const createUser = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    firstName: v.string(),
    lastName: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    credits: v.optional(v.number()),

    // Subscription fields (all optional)
    subscriptionId: v.optional(v.string()),
    subscriptionStatus: v.optional(v.string()),
    currentPeriodStart: v.optional(v.string()),
    currentPeriodEnd: v.optional(v.string()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    planId: v.optional(v.id("plans")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!existing) {
      const id = await ctx.db.insert("users", {
        clerkId: args.clerkId,
        email: args.email,
        firstName: args.firstName,
        lastName: args.lastName,
        imageUrl: args.imageUrl,
        credits: args.credits,
        createdAt: now(),

        subscriptionId: args.subscriptionId,
        subscriptionStatus: args.subscriptionStatus,
        currentPeriodStart: args.currentPeriodStart,
        currentPeriodEnd: args.currentPeriodEnd,
        cancelAtPeriodEnd: args.cancelAtPeriodEnd,
        planId: args.planId,
      });
      return id;
    }

    // Idempotent: patch anything that changed / is newly provided
    const patch = cleanPatch({
      email: args.email,
      firstName: args.firstName,
      lastName: args.lastName,
      imageUrl: args.imageUrl,
      credits: args.credits,

      subscriptionId: args.subscriptionId,
      subscriptionStatus: args.subscriptionStatus,
      currentPeriodStart: args.currentPeriodStart,
      currentPeriodEnd: args.currentPeriodEnd,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
      planId: args.planId,

      updatedAt: now(),
    });

    // If only updatedAt would be written, skip
    if (Object.keys(patch).length > 1) {
      await ctx.db.patch(existing._id, patch);
    }

    return existing._id;
  },
});

/**
 * Update a user by clerkId. Only provided fields are patched.
 * Automatically sets updatedAt.
 */
export const updateUser = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    credits: v.optional(v.number()),

    subscriptionId: v.optional(v.string()),
    subscriptionStatus: v.optional(v.string()),
    currentPeriodStart: v.optional(v.string()),
    currentPeriodEnd: v.optional(v.string()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    planId: v.optional(v.id("plans")),
  },
  async handler(ctx, args) {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) throw new ConvexError("User not found");

    const patch = cleanPatch({
      email: args.email,
      firstName: args.firstName,
      lastName: args.lastName,
      imageUrl: args.imageUrl,
      credits: args.credits,

      subscriptionId: args.subscriptionId,
      subscriptionStatus: args.subscriptionStatus,
      currentPeriodStart: args.currentPeriodStart,
      currentPeriodEnd: args.currentPeriodEnd,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
      planId: args.planId,

      updatedAt: now(),
    });

    if (Object.keys(patch).length === 1 && "updatedAt" in patch) return;

    await ctx.db.patch(user._id, patch);
  },
});

export const deleteUser = internalMutation({
  args: { clerkId: v.string() },
  async handler(ctx, args) {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) throw new ConvexError("User not found");

    await ctx.db.delete(user._id);
  },
});
