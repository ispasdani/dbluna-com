// Single source of truth for AI chat unit economics. Everything here is
// derived from two inputs — the model's published price and the AI budget we
// allow ourselves out of the $10 Pro price — so the two can't drift apart the
// way they did before (ai-chat-credits-and-sync-plan.md costed 500 credits
// against Gemini 2.5 Flash-Lite's $0.10/$0.40 while the route actually called
// the floating `gemini-flash-lite-latest` alias, which had already moved to a
// tier with 6x the output price).
//
// Consumed by:
//   - app/api/ai-chat/route.ts        (model id + post-turn metering)
//   - convex/users.ts                 (spending credits)
//   - convex/http.ts                  (monthly allowance)
//   - components/diagram-general/ai-chat-panel.tsx (the % remaining UI)
//
// lib/__tests__/ai-credits.test.ts asserts the derived ceiling still fits the
// budget, so raising the allowance fails CI instead of quietly eating margin.

/**
 * Pinned model, matching app/api/ai-chat/route.ts. Never a `-latest` alias:
 * Google hot-swaps those with two weeks' notice, which silently re-prices
 * every number below.
 */
export const AI_CHAT_MODEL_ID = "gemini-3.1-flash-lite";

/**
 * USD per 1M tokens, paid tier, text/image/video. Verified against
 * https://ai.google.dev/gemini-api/docs/pricing on 2026-09-20.
 * Changing the model means changing these three numbers — the weights and
 * costs below follow automatically.
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
 * (~12K input + a few hundred output tokens) costs exactly 1 credit — i.e.
 * "1 message = 1 credit" stays true for the large majority of turns, while a
 * 300-table 8-step refactor costs what it actually costs.
 */
export const WEIGHTED_UNITS_PER_CREDIT = 15_000;

/** Monthly allowance for an active Pro subscriber. Does not roll over. */
export const AI_CHAT_MONTHLY_CREDITS = 500;

/**
 * Backstop on what a single turn can charge. Because credits settle *after*
 * the turn, a runaway (a prompt-injection loop, a tool that feeds its own
 * output back, a bad `stopWhen`) would otherwise drain a whole balance in one
 * request. 50 credits is ~$0.19 — far above any legitimate turn, including an
 * 8-step refactor on a 300-table diagram (~27). Exceeding it means something
 * is wrong, so the route logs rather than silently absorbing it.
 *
 * This is a backstop, not the real guard: refusing oversized requests up front
 * is the proper fix and belongs with the per-turn input ceiling.
 */
export const MAX_CREDITS_PER_TURN = 50;

// --- Budget envelope (the numbers the allowance above is sized against) ---

/** Pro list price. constants/pricing.tsx renders the same number. */
export const PRO_PRICE_USD = 10;

/** After ~6% combined Stripe + Clerk Billing fees. */
export const PRO_NET_REVENUE_USD = 9.4;

/**
 * The most AI spend we allow a single Pro subscriber to generate in a month:
 * 20% of net revenue. This is the binding constraint — the allowance is
 * whatever number of credits fits underneath it, not the other way round.
 */
export const AI_BUDGET_CEILING_USD = 1.88;

// --- Derived ---

/** Cost to us of one fully-consumed credit. */
export const USD_PER_CREDIT =
  (WEIGHTED_UNITS_PER_CREDIT / 1_000_000) * MODEL_PRICE_USD_PER_MTOK.input;

/**
 * Worst case: a subscriber who burns every credit on maximum-size turns.
 * Typical users land far below this — most turns cost 1 credit but consume
 * well under a full credit's worth of tokens.
 */
export const MAX_MONTHLY_AI_COST_USD = USD_PER_CREDIT * AI_CHAT_MONTHLY_CREDITS;

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
