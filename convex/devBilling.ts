// Test-only billing controls.
//
// Every paid path in this app is gated on subscription state that normally
// only Clerk can produce, and there is no checkout yet — so without this there
// is no way to exercise Pro locally at all, let alone the states that matter
// (a lapsed period, a failed payment, an exhausted allowance).
//
// These are `internalMutation`s: not reachable from any client, only from the
// CLI or the Convex dashboard by someone who already has deploy access and
// could edit the rows by hand anyway. Run them against a dev deployment.
//
//   npx convex run devBilling:setSubscription '{"email":"you@example.com","preset":"active"}'
//   npx convex run devBilling:setCredits '{"email":"you@example.com","credits":3}'
//   npx convex run devBilling:showUser '{"email":"you@example.com"}'

import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { creditPeriodKey, effectiveCredits } from "../lib/ai-credits";
import { hasActivePaidAccess } from "../lib/subscription-rules";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Subscription states worth testing, each mapping to what Clerk would have
 * written. `lapsed` and `graced` differ only by where the period end falls
 * relative to SUBSCRIPTION_GRACE_MS — that boundary is the whole point of the
 * access gate, so it needs to be reachable on demand.
 */
const PRESETS = {
  /** Paid and current. */
  active: { slug: "pro", status: "active", endsInDays: 30 },
  /** Paid; renewal webhook is late. Should still have access. */
  graced: { slug: "pro", status: "active", endsInDays: -1 },
  /** Period long gone and no renewal event ever arrived. Should be denied. */
  lapsed: { slug: "pro", status: "active", endsInDays: -5 },
  /** Renewal charge failed. Should be denied immediately. */
  past_due: { slug: "pro", status: "past_due", endsInDays: 30 },
  /** Cancelled with time left. Should keep access to the period end. */
  canceling: { slug: "pro", status: "active", endsInDays: 10, cancelAtPeriodEnd: true },
  /** Subscription over. */
  ended: { slug: "pro", status: "ended", endsInDays: -1 },
  /** Enterprise, for checking the paid-slug list isn't Pro-only. */
  enterprise: { slug: "enterprise", status: "active", endsInDays: 30 },
  /** Back to no paid access at all. */
  free: { slug: "free", status: "ended", endsInDays: -1 },
} as const;

export const setSubscription = internalMutation({
  args: {
    email: v.string(),
    preset: v.union(
      ...(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((k) => v.literal(k))
    ),
  },
  handler: async (ctx, { email, preset }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (!user) throw new Error(`No user with email ${email} — sign in once first.`);

    const spec = PRESETS[preset];
    const plan = await ctx.db
      .query("plans")
      .withIndex("by_slug", (q) => q.eq("slug", spec.slug))
      .unique();
    if (!plan) {
      throw new Error(`Plan "${spec.slug}" not seeded — run: npx convex run plans:seed`);
    }

    const now = Date.now();
    const periodEnd = new Date(now + spec.endsInDays * DAY).toISOString();

    await ctx.db.patch(user._id, {
      planId: plan._id,
      subscriptionStatus: spec.status,
      currentPeriodStart: new Date(now - 30 * DAY).toISOString(),
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: "cancelAtPeriodEnd" in spec ? spec.cancelAtPeriodEnd : false,
      updatedAt: now,
    });

    return {
      preset,
      plan: spec.slug,
      status: spec.status,
      currentPeriodEnd: periodEnd,
      hasPaidAccess: hasActivePaidAccess({
        planSlug: plan.slug,
        status: spec.status,
        currentPeriodEnd: periodEnd,
      }),
    };
  },
});

/**
 * Forces a balance. Pass `periodKey` as a past month ("2026-08") to stage the
 * monthly refill, or a negative `credits` to stage a carried overdraft.
 */
export const setCredits = internalMutation({
  args: {
    email: v.string(),
    credits: v.number(),
    periodKey: v.optional(v.string()),
  },
  handler: async (ctx, { email, credits, periodKey }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (!user) throw new Error(`No user with email ${email}`);

    const key = periodKey ?? creditPeriodKey();
    await ctx.db.patch(user._id, {
      credits,
      creditsPeriodKey: key,
      updatedAt: Date.now(),
    });

    return {
      stored: credits,
      storedFor: key,
      readsAsNow: effectiveCredits({ credits, creditsPeriodKey: key }),
    };
  },
});

/** Everything the gates look at, in one place, without the dashboard. */
export const showUser = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (!user) return { found: false as const };

    const plan = user.planId ? await ctx.db.get(user.planId) : null;

    return {
      found: true as const,
      plan: plan?.slug ?? null,
      subscriptionStatus: user.subscriptionStatus ?? null,
      currentPeriodEnd: user.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: user.cancelAtPeriodEnd ?? false,
      hasPaidAccess: hasActivePaidAccess({
        planSlug: plan?.slug,
        status: user.subscriptionStatus,
        currentPeriodEnd: user.currentPeriodEnd,
      }),
      storedCredits: user.credits ?? null,
      creditsPeriodKey: user.creditsPeriodKey ?? null,
      effectiveCredits: effectiveCredits(user),
      aiTurnsInWindow: user.aiTurnsInWindow ?? 0,
    };
  },
});

/** This month's org-wide spend, backing the circuit breaker. */
export const showSpend = internalQuery({
  args: {},
  handler: async (ctx) => {
    const periodKey = creditPeriodKey();
    const row = await ctx.db
      .query("aiChatSpend")
      .withIndex("by_period", (q) => q.eq("periodKey", periodKey))
      .unique();

    return { periodKey, credits: row?.credits ?? 0 };
  },
});
