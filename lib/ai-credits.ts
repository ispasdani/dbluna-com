// Single source of truth for AI chat unit economics. Everything here is
// derived from two inputs — the model's published price and the AI budget we
// allow ourselves out of the $10 Pro price — so the two can't drift apart the
// way they did before (ai-chat-credits-and-sync-plan.md costed 500 credits
// against Gemini 2.5 Flash-Lite's $0.10/$0.40 while the route actually called
// the floating `gemini-flash-lite-latest` alias, which had already moved to a
// tier with 6x the output price).
//
// The budget is the input and the allowance is the output, not the other way
// round. That ordering is what makes "a subscriber cannot cost us more than
// $1.35 in a month" a property of the code rather than a claim about it.
//
// Consumed by:
//   - app/api/ai-chat/route.ts        (model id, size guard, post-turn metering)
//   - convex/users.ts                 (reserving, settling, monthly refill)
//   - components/diagram-general/ai-chat-panel.tsx (the % remaining UI)
//
// lib/__tests__/ai-credits.test.ts asserts the derived worst case still fits
// the budget, so widening any limit fails CI instead of quietly eating margin.

/**
 * Pinned model, matching app/api/ai-chat/route.ts. Never a `-latest` alias:
 * Google hot-swaps those with two weeks' notice, which silently re-prices
 * every number below.
 */
export const AI_CHAT_MODEL_ID = "gemini-3.1-flash-lite";

/**
 * USD per 1M tokens, paid tier, text/image/video. Verified against
 * https://ai.google.dev/gemini-api/docs/pricing on 2026-09-20.
 * Changing the model means changing these three numbers — everything below
 * follows automatically.
 */
export const MODEL_PRICE_USD_PER_MTOK = {
  input: 0.25,
  cachedInput: 0.025,
  output: 1.5,
} as const;

// Every token type is normalised to "one uncached input token" so a credit can
// represent cost rather than message count. Derived from the prices above
// rather than hardcoded, so a price change can't leave the weights stale.
export const OUTPUT_WEIGHT =
  MODEL_PRICE_USD_PER_MTOK.output / MODEL_PRICE_USD_PER_MTOK.input; // 6
export const CACHED_INPUT_WEIGHT =
  MODEL_PRICE_USD_PER_MTOK.cachedInput / MODEL_PRICE_USD_PER_MTOK.input; // 0.1

/**
 * Size of one credit. Chosen so an ordinary turn on a small/medium diagram
 * (~12K input + a few hundred output tokens) costs exactly 1 credit, while a
 * 300-table 8-step refactor costs what it actually costs.
 */
export const WEIGHTED_UNITS_PER_CREDIT = 15_000;

/** Cost to us of one fully-consumed credit. */
export const USD_PER_CREDIT =
  (WEIGHTED_UNITS_PER_CREDIT / 1_000_000) * MODEL_PRICE_USD_PER_MTOK.input;

/** Dollar value of a credit figure, for logging and dashboards. */
export function creditsToUsd(credits: number): number {
  return credits * USD_PER_CREDIT;
}

// --- Per-turn limits ---

/** Tool-calling steps one turn may take. Mirrors `stopWhen` in the route. */
export const MAX_STEPS_PER_TURN = 8;

/**
 * Largest prompt we'll send. A turn is *refused*, never truncated — silently
 * dropping tables would make the model answer confidently about a schema the
 * user isn't looking at, which is worse than saying no.
 *
 * 100K tokens is roughly an 800-table diagram plus history, so this only ever
 * fires on genuinely extreme schemas. Its real job is bounding cost: this
 * number times the step count is what makes MAX_CREDITS_PER_TURN provable
 * rather than a guess.
 */
export const MAX_INPUT_TOKENS_PER_REQUEST = 100_000;

/**
 * Chars per token assumed by `estimateTokens`. Deliberately below the usual 4:
 * DBML is identifier- and punctuation-heavy and tokenises worse than prose,
 * and for a spend guard over-estimating is the safe direction.
 */
export const CHARS_PER_TOKEN = 3.5;

/**
 * Hard cap on the request body, checked before the JSON is parsed.
 *
 * The token ceiling above can only be applied *after* parsing, which means a
 * huge body is turned into an object graph before being rejected. This bounds
 * what we're willing to buffer at all. Derived from the token ceiling with a
 * 3x allowance for JSON structure — message ids, roles, `parts` arrays and
 * tool-call payloads all cost bytes that aren't prompt text.
 */
export const MAX_REQUEST_BODY_BYTES = Math.ceil(
  MAX_INPUT_TOKENS_PER_REQUEST * CHARS_PER_TOKEN * 3
);

/**
 * Output cap per step, passed to `streamText` as `maxOutputTokens`.
 *
 * Enforced rather than assumed, because the overdraft bound below is only as
 * provable as the most expensive single step. Without a cap, one step's output
 * is unbounded and so is the overdraft.
 */
export const MAX_OUTPUT_TOKENS_PER_STEP = 4_000;

/** Worst case across a full turn. */
const MAX_OUTPUT_TOKENS_PER_TURN = MAX_STEPS_PER_TURN * MAX_OUTPUT_TOKENS_PER_STEP;

/**
 * The most a single turn can charge. Derived, not chosen: it's exactly what
 * the input ceiling and step limit above permit.
 */
export const MAX_CREDITS_PER_TURN = Math.ceil(
  (MAX_STEPS_PER_TURN * MAX_INPUT_TOKENS_PER_REQUEST +
    OUTPUT_WEIGHT * MAX_OUTPUT_TOKENS_PER_TURN) /
    WEIGHTED_UNITS_PER_CREDIT
);

/**
 * Largest prompt a *later* step can carry. Input grows as the turn runs: each
 * step replays the assistant's own output and the tool results so far, so the
 * initial-request ceiling isn't the bound for step 8.
 */
const MAX_STEP_INPUT_TOKENS =
  MAX_INPUT_TOKENS_PER_REQUEST + MAX_OUTPUT_TOKENS_PER_TURN;

/**
 * How far below zero a balance can go.
 *
 * The turn stops at the first step boundary where accumulated cost reaches the
 * balance (see the budget stop condition in the route), so the overshoot is at
 * most the cost of the step that crossed the line — never a whole turn. It can
 * also only happen once, because `reserveAiCredit` refuses to start a turn on
 * a non-positive balance.
 *
 * This bound is what funds the allowance: every credit reserved against a
 * possible overdraft is a credit not given to users, so tightening it from a
 * whole turn to a single step hands ~50 credits a month back to every
 * subscriber at no extra cost to us.
 */
export const MAX_OVERDRAFT_CREDITS = Math.ceil(
  (MAX_STEP_INPUT_TOKENS + OUTPUT_WEIGHT * MAX_OUTPUT_TOKENS_PER_STEP) /
    WEIGHTED_UNITS_PER_CREDIT
);

// --- Budget envelope ---

/** Pro list price. constants/pricing.tsx renders the same number. */
export const PRO_PRICE_USD = 10;

/** After ~6% combined Stripe + Clerk Billing fees. */
export const PRO_NET_REVENUE_USD = 9.4;

/**
 * The hard ceiling on what one Pro subscriber can cost us in AI in a calendar
 * month — allowance *and* overdraft, everything included. ~14% of net revenue.
 * This is the input the allowance is derived from; raising it is the only
 * knob that makes the feature more generous.
 */
export const AI_BUDGET_CEILING_USD = 1.35;

/**
 * Monthly allowance for an active Pro subscriber. Does not roll over.
 *
 * Derived so that allowance + worst-case overdraft lands exactly on the
 * ceiling. It is deliberately not a round number: the UI shows a percentage
 * and never a count, so this figure is free to be whatever the budget permits
 * rather than a marketing-friendly 500.
 */
export const AI_CHAT_MONTHLY_CREDITS =
  Math.floor(AI_BUDGET_CEILING_USD / USD_PER_CREDIT) - MAX_OVERDRAFT_CREDITS;

/** The number the ceiling actually has to cover. */
export const MAX_MONTHLY_AI_COST_USD = creditsToUsd(
  AI_CHAT_MONTHLY_CREDITS + MAX_OVERDRAFT_CREDITS
);

// --- Abuse limits ---

/**
 * Turns one user may start per minute. Comfortably above human pace (a turn
 * takes seconds), low enough that a script can't drain a balance in a burst.
 */
export const AI_TURNS_PER_MINUTE = 10;
export const AI_RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * Org-wide monthly credit ceiling — the circuit breaker for a *bug*, not for
 * ordinary usage. Per-user allowances already cap normal spend; this catches
 * the case where metering itself is broken, which is what actually produces
 * runaway bills.
 *
 * Size it at roughly `expected Pro subscribers x AI_CHAT_MONTHLY_CREDITS x 1.5`.
 * Override without a deploy via the AI_CHAT_GLOBAL_MONTHLY_CREDIT_CEILING
 * environment variable on the Convex deployment — during an incident you want
 * this changeable in seconds.
 */
export const DEFAULT_GLOBAL_MONTHLY_CREDIT_CEILING = 100_000;

// --- Metering ---

export type AiChatUsage = {
  /**
   * Total prompt tokens for the turn, summed across every step. Google's
   * `usageMetadata.promptTokenCount` *includes* cached tokens, so
   * `cachedInputTokens` is subtracted below rather than added — getting this
   * backwards would misprice every cached turn.
   */
  inputTokens: number;
  /** Subset of `inputTokens` served from context cache, if any. */
  cachedInputTokens?: number;
  /** Total completion tokens across every step, including thinking tokens. */
  outputTokens: number;
};

/**
 * Credits a finished turn costs. Always at least 1, so every message draws
 * something down, and rounded up, so we never under-bill ourselves.
 */
export function creditsForUsage({
  inputTokens,
  cachedInputTokens = 0,
  outputTokens,
}: AiChatUsage): number {
  const cached = Math.min(Math.max(cachedInputTokens, 0), Math.max(inputTokens, 0));
  const uncached = Math.max(inputTokens, 0) - cached;

  const weighted =
    uncached + CACHED_INPUT_WEIGHT * cached + OUTPUT_WEIGHT * Math.max(outputTokens, 0);

  return Math.max(1, Math.ceil(weighted / WEIGHTED_UNITS_PER_CREDIT));
}

/**
 * Credits a turn will cost *at minimum*, from the prompt we're about to send.
 *
 * Reserved up front so a large request can't be started on a balance that
 * obviously can't cover it. It's a floor, not a prediction: the model may take
 * several more steps and settle higher. Assumes a single step and a small
 * reply, which is the cheapest a turn can possibly be.
 */
export function minimumCreditsForRequest(estimatedInputTokens: number): number {
  return creditsForUsage({
    inputTokens: Math.max(estimatedInputTokens, 0),
    outputTokens: 0,
  });
}

/**
 * Conservative token estimate from raw text — see CHARS_PER_TOKEN. Used only
 * for the size guard and the reservation floor, never for billing, which
 * always uses the provider's reported counts.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

// --- Monthly allowance ---

/** Calendar month key, "YYYY-MM" in UTC. The allowance period. */
export function creditPeriodKey(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 7);
}

export type CreditBalance = {
  credits?: number;
  /** The period the stored `credits` figure belongs to. */
  creditsPeriodKey?: string;
};

/**
 * The balance a Pro user actually has right now.
 *
 * The allowance refills lazily: rather than granting credits from a webhook,
 * a stored balance from a previous month simply *reads* as a full allowance,
 * and the next spend writes that down. This is deliberate — the webhook grant
 * it replaces had four separate failure modes. It fired on a transition that
 * Clerk's own default free subscription made unreachable, it could fire more
 * than once for one upgrade because the read and the write straddled an
 * action boundary, it never fired for Enterprise subscribers, and it never
 * fired for users migrated to Pro by hand. Deriving the balance from the
 * calendar has none of those: it needs no event, it can't double-grant, and
 * it can't miss anyone.
 *
 * Unused credits do not roll over. An overdraft *does* carry, so the cost of
 * the turn that caused it is recovered rather than written off — at a few
 * credits out of the monthly allowance it is invisible to the user, and it is
 * what keeps the monthly ceiling honest.
 */
export function effectiveCredits(
  user: CreditBalance,
  periodKey: string = creditPeriodKey(),
  allowance: number = AI_CHAT_MONTHLY_CREDITS
): number {
  if (user.creditsPeriodKey === periodKey) return user.credits ?? 0;

  // New period: full allowance, less any overdraft carried in.
  return allowance + Math.min(0, user.credits ?? 0);
}

/**
 * What the panel shows instead of a raw count (0-100). Rounded so a balance
 * that is non-zero never displays as 0% — "0%" next to a working composer
 * reads as broken.
 */
export function creditsRemainingPercent(
  remaining: number,
  allowance: number = AI_CHAT_MONTHLY_CREDITS
): number {
  if (allowance <= 0) return 0;
  if (remaining <= 0) return 0;
  return Math.max(1, Math.min(100, Math.round((remaining / allowance) * 100)));
}

/**
 * Attached to assistant messages as they stream, so the gauge moves *during*
 * generation rather than only when the turn settles. A long refactor visibly
 * drawing the allowance down is the honest representation of what it's doing.
 */
export type AiChatStreamMetadata = {
  /** Share of the monthly allowance left, after everything spent so far. */
  creditsPercent?: number;
  /** True when the turn was halted at a step boundary by the budget. */
  stoppedForBudget?: boolean;
};

/**
 * When the allowance next refills, as a date. Shown instead of a credit count
 * so the empty state still tells the user something actionable.
 */
export function nextRefillDate(now: number = Date.now()): Date {
  const d = new Date(now);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}
