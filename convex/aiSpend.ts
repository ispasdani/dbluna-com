// Org-wide AI spend tracking — the circuit breaker, not the meter.
//
// Per-user allowances (lib/ai-credits.ts) already bound what ordinary usage
// can cost. This exists for the failure mode those can't catch: metering
// itself breaking. A settle path that silently no-ops, a rate limit that
// doesn't fire, a loop that retries forever — in every one of those the
// per-user numbers look fine while the real bill climbs. This is the number
// that notices.
//
// Helper functions, not registered Convex functions — same pattern as
// convex/guards.ts.

import type { MutationCtx, QueryCtx } from "./_generated/server";
import { ConvexError } from "convex/values";
import {
  DEFAULT_GLOBAL_MONTHLY_CREDIT_CEILING,
  creditsToUsd,
} from "../lib/ai-credits";

/** "YYYY-MM" in UTC. Deliberately not the subscriber's billing period — this
 *  tracks *our* exposure, which is a calendar-month concern. */
export function currentPeriodKey(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 7);
}

/**
 * Overridable without a deploy: during an incident you want to raise or drop
 * this in seconds, not wait on a build. Set
 * AI_CHAT_GLOBAL_MONTHLY_CREDIT_CEILING on the Convex deployment.
 */
export function globalMonthlyCeiling(): number {
  const raw = process.env.AI_CHAT_GLOBAL_MONTHLY_CREDIT_CEILING;
  if (!raw) return DEFAULT_GLOBAL_MONTHLY_CREDIT_CEILING;

  const parsed = Number.parseInt(raw, 10);
  // A typo'd env var must not silently disable the breaker.
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.error(
      `[aiSpend] ignoring unparseable AI_CHAT_GLOBAL_MONTHLY_CREDIT_CEILING: ${raw}`
    );
    return DEFAULT_GLOBAL_MONTHLY_CREDIT_CEILING;
  }
  return parsed;
}

async function currentPeriodRow(ctx: QueryCtx | MutationCtx) {
  const periodKey = currentPeriodKey();
  const row = await ctx.db
    .query("aiChatSpend")
    .withIndex("by_period", (q) => q.eq("periodKey", periodKey))
    .unique();
  return { periodKey, row };
}

/**
 * Throws if this month's org-wide spend has hit the ceiling. Called from
 * `reserveAiCredit`, so it runs inside the same transaction as the per-user
 * check and can't be raced.
 */
export async function assertGlobalCapacity(ctx: MutationCtx) {
  const { row } = await currentPeriodRow(ctx);
  const spent = row?.credits ?? 0;
  const ceiling = globalMonthlyCeiling();

  if (spent >= ceiling) {
    console.error(
      `[aiSpend] global monthly ceiling reached: ${spent}/${ceiling} credits ` +
        `(~$${creditsToUsd(spent).toFixed(2)}) — AI chat is refusing new turns`
    );
    throw new ConvexError({ code: "CAPACITY_REACHED" });
  }
}

/**
 * Adds to this month's running total. Called for both the reserved credit and
 * the settled remainder, so the total tracks what was actually charged to
 * users rather than what we predicted.
 */
export async function recordSpend(ctx: MutationCtx, credits: number) {
  if (!Number.isFinite(credits) || credits <= 0) return;

  const { periodKey, row } = await currentPeriodRow(ctx);
  const now = Date.now();

  if (row) {
    await ctx.db.patch(row._id, { credits: row.credits + credits, updatedAt: now });
    return;
  }

  await ctx.db.insert("aiChatSpend", { periodKey, credits, updatedAt: now });
}
