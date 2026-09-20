import { describe, it, expect } from "vitest";
import {
  AI_BUDGET_CEILING_USD,
  AI_CHAT_MONTHLY_CREDITS,
  creditPeriodKey,
  effectiveCredits,
  CACHED_INPUT_WEIGHT,
  MAX_CREDITS_PER_TURN,
  MAX_INPUT_TOKENS_PER_REQUEST,
  MAX_MONTHLY_AI_COST_USD,
  MAX_OVERDRAFT_CREDITS,
  MAX_STEPS_PER_TURN,
  minimumCreditsForRequest,
  settlementCharge,
  MODEL_PRICE_USD_PER_MTOK,
  OUTPUT_WEIGHT,
  USD_PER_CREDIT,
  creditsForUsage,
  creditsRemainingPercent,
  creditsToUsd,
  estimateTokens,
} from "@/lib/ai-credits";

describe("ai credit economics", () => {
  // The guard that matters: widening any limit — the allowance, the step
  // count, the input ceiling, the model's price — must fail here rather than
  // quietly eating margin in production.
  it("keeps the worst-case monthly cost inside the budget ceiling", () => {
    // Rounded to cents because that's the unit the ceiling is expressed in;
    // the float lands a hair under 1.35.
    const worstCase = Math.round(MAX_MONTHLY_AI_COST_USD * 100) / 100;
    expect(worstCase).toBeLessThanOrEqual(AI_BUDGET_CEILING_USD);
  });

  // An earlier version of the guard above counted only the allowance and
  // ignored the overdraft, so it defended a number below what a subscriber
  // could actually cost.
  it("counts the overdraft, not just the allowance", () => {
    expect(MAX_MONTHLY_AI_COST_USD).toBeCloseTo(
      creditsToUsd(AI_CHAT_MONTHLY_CREDITS + MAX_OVERDRAFT_CREDITS),
      10
    );
  });

  // The budget stop condition halts the turn at the first step boundary past
  // the balance, so the overshoot is one step — not the whole turn it was
  // before. That difference is what funds the larger allowance.
  it("bounds the overdraft by a single step, not a whole turn", () => {
    expect(MAX_OVERDRAFT_CREDITS).toBeLessThan(MAX_CREDITS_PER_TURN);
    expect(MAX_OVERDRAFT_CREDITS).toBeLessThanOrEqual(
      Math.ceil(MAX_CREDITS_PER_TURN / 4)
    );
  });

  it("spends the tightened overdraft bound on a larger allowance", () => {
    // Regression guard on the payoff: if the overdraft bound ever loosens
    // again, this is the number that quietly shrinks.
    expect(AI_CHAT_MONTHLY_CREDITS).toBeGreaterThan(340);
  });

  it("derives the allowance from the ceiling rather than the reverse", () => {
    // Raising AI_BUDGET_CEILING_USD is the only way to be more generous.
    expect(AI_CHAT_MONTHLY_CREDITS).toBe(
      Math.floor(AI_BUDGET_CEILING_USD / USD_PER_CREDIT) - MAX_OVERDRAFT_CREDITS
    );
    expect(AI_CHAT_MONTHLY_CREDITS).toBeGreaterThan(0);
  });

  it("derives token weights from the published prices", () => {
    expect(OUTPUT_WEIGHT).toBeCloseTo(
      MODEL_PRICE_USD_PER_MTOK.output / MODEL_PRICE_USD_PER_MTOK.input,
      10
    );
    expect(CACHED_INPUT_WEIGHT).toBeCloseTo(
      MODEL_PRICE_USD_PER_MTOK.cachedInput / MODEL_PRICE_USD_PER_MTOK.input,
      10
    );
  });

  it("prices a full credit at the input rate for its weighted units", () => {
    expect(USD_PER_CREDIT).toBeCloseTo(0.00375, 6);
  });
});

describe("creditsForUsage", () => {
  it("charges 1 credit for an ordinary turn on a small diagram", () => {
    // ~6K prompt tokens over a single step, a few hundred out.
    expect(creditsForUsage({ inputTokens: 6_000, outputTokens: 400 })).toBe(1);
  });

  it("still charges 1 credit at the top of the ordinary band", () => {
    // 12K in + 500 out = 12,000 + 3,000 = 15,000 weighted units exactly.
    expect(creditsForUsage({ inputTokens: 12_000, outputTokens: 500 })).toBe(1);
  });

  it("scales with a large multi-step refactor instead of under-charging", () => {
    // 300-table diagram, 8 steps: the turn that would otherwise cost ~27x an
    // ordinary message while drawing down the same single credit.
    expect(
      creditsForUsage({ inputTokens: 384_000, outputTokens: 3_000 })
    ).toBe(27);
  });

  it("charges less when tokens are served from cache", () => {
    const uncached = creditsForUsage({ inputTokens: 100_000, outputTokens: 1_000 });
    const cached = creditsForUsage({
      inputTokens: 100_000,
      cachedInputTokens: 80_000,
      outputTokens: 1_000,
    });

    expect(cached).toBeLessThan(uncached);
    // 20,000 + 0.1*80,000 + 6*1,000 = 34,000 units -> 3 credits.
    expect(cached).toBe(3);
  });

  it("never charges less than one credit, even for a trivial turn", () => {
    expect(creditsForUsage({ inputTokens: 0, outputTokens: 0 })).toBe(1);
  });

  it("treats cached tokens as a subset of input, not an addition", () => {
    // Google reports promptTokenCount inclusive of cached tokens; a cached
    // count larger than the total must not produce negative uncached input.
    expect(
      creditsForUsage({
        inputTokens: 10_000,
        cachedInputTokens: 50_000,
        outputTokens: 0,
      })
    ).toBe(1);
  });
});

describe("monthly refill", () => {
  const THIS_MONTH = creditPeriodKey(Date.parse("2026-09-20T12:00:00Z"));
  const LAST_MONTH = creditPeriodKey(Date.parse("2026-08-20T12:00:00Z"));

  it("formats the period as a UTC calendar month", () => {
    expect(THIS_MONTH).toBe("2026-09");
    expect(LAST_MONTH).toBe("2026-08");
  });

  it("keeps the stored balance within the same month", () => {
    expect(
      effectiveCredits({ credits: 143, creditsPeriodKey: THIS_MONTH }, THIS_MONTH)
    ).toBe(143);
  });

  it("refills once the month rolls over", () => {
    expect(
      effectiveCredits({ credits: 143, creditsPeriodKey: LAST_MONTH }, THIS_MONTH)
    ).toBe(AI_CHAT_MONTHLY_CREDITS);
  });

  it("does not roll unused credits over", () => {
    expect(
      effectiveCredits({ credits: 490, creditsPeriodKey: LAST_MONTH }, THIS_MONTH)
    ).toBe(AI_CHAT_MONTHLY_CREDITS);
  });

  it("refills users who have never had a period key", () => {
    // Every existing row, plus anyone granted Pro by the grandfathering
    // migration — the webhook grant reached none of them.
    expect(effectiveCredits({ credits: 0 }, THIS_MONTH)).toBe(
      AI_CHAT_MONTHLY_CREDITS
    );
    expect(effectiveCredits({}, THIS_MONTH)).toBe(AI_CHAT_MONTHLY_CREDITS);
  });

  it("carries an overdraft into the new month rather than writing it off", () => {
    // The turn that overdrew was real spend. Recovering it is what keeps
    // MAX_MONTHLY_AI_COST_USD honest across consecutive months.
    expect(
      effectiveCredits({ credits: -12, creditsPeriodKey: LAST_MONTH }, THIS_MONTH)
    ).toBe(AI_CHAT_MONTHLY_CREDITS - 12);
  });

  it("keeps an overdraft inside the month that caused it", () => {
    expect(
      effectiveCredits({ credits: -12, creditsPeriodKey: THIS_MONTH }, THIS_MONTH)
    ).toBe(-12);
  });
});

describe("per-turn ceiling", () => {
  // The point of the input guard: MAX_CREDITS_PER_TURN should be a provable
  // consequence of it, not an independent magic number that drifts away from
  // what a turn can actually cost.
  it("covers the worst turn the input guard still admits", () => {
    const worstCase = creditsForUsage({
      inputTokens: MAX_STEPS_PER_TURN * MAX_INPUT_TOKENS_PER_REQUEST,
      outputTokens: 16_000,
    });

    expect(worstCase).toBeLessThanOrEqual(MAX_CREDITS_PER_TURN);
  });

  it("costs well under a cent per credit, so the cap stays cheap", () => {
    expect(creditsToUsd(MAX_CREDITS_PER_TURN)).toBeLessThan(0.3);
  });
});

describe("minimumCreditsForRequest", () => {
  it("charges at least one credit for any request", () => {
    expect(minimumCreditsForRequest(0)).toBe(1);
    expect(minimumCreditsForRequest(-5)).toBe(1);
  });

  it("scales with prompt size, so a huge diagram reserves more up front", () => {
    // ~300-table diagram: can't be started on a nearly-empty balance.
    expect(minimumCreditsForRequest(45_000)).toBe(3);
    expect(minimumCreditsForRequest(MAX_INPUT_TOKENS_PER_REQUEST)).toBe(7);
  });

  it("never reserves more than the per-turn cap", () => {
    expect(minimumCreditsForRequest(MAX_INPUT_TOKENS_PER_REQUEST)).toBeLessThanOrEqual(
      MAX_CREDITS_PER_TURN
    );
  });
});

describe("settlementCharge", () => {
  it("charges only what the reservation didn't already cover", () => {
    expect(settlementCharge(3, 12)).toBe(9);
    expect(settlementCharge(1, 1)).toBe(0);
  });

  it("never refunds when a turn came in under its reservation", () => {
    // A big diagram reserves several credits up front; a one-step answer can
    // cost less. That's not a refund path — it must simply charge nothing.
    expect(settlementCharge(7, 2)).toBe(0);
  });

  // The security property. `settleAiCredits` is a public mutation, so this
  // number arrives from the client, and it feeds the org-wide spend counter
  // behind the circuit breaker. Unclamped, one call from any signed-in
  // account could trip that breaker and disable AI chat for every user.
  it("caps a forged total at one turn's maximum", () => {
    expect(settlementCharge(1, 1e9)).toBe(MAX_CREDITS_PER_TURN - 1);
    expect(settlementCharge(0, Number.MAX_SAFE_INTEGER)).toBe(MAX_CREDITS_PER_TURN);
  });

  it("ignores hostile or malformed numbers rather than trusting them", () => {
    // NaN and Infinity aren't clamped to the cap, they're discarded outright:
    // a malformed total is evidence of a bug or an attack, not of a turn that
    // happened to be expensive.
    expect(settlementCharge(1, Number.NaN)).toBe(0);
    expect(settlementCharge(1, Number.POSITIVE_INFINITY)).toBe(0);
    expect(settlementCharge(1, -500)).toBe(0);
  });

  it("cannot be made to credit an account by understating the reservation", () => {
    // Negative reservations would otherwise inflate the charge; negative
    // results would hand out free credits. Neither is reachable.
    expect(settlementCharge(-50, 5)).toBe(5);
    expect(settlementCharge(10, 0)).toBe(0);
  });
});

describe("estimateTokens", () => {
  it("errs high, since it gates spending rather than billing", () => {
    const text = "x".repeat(1_000);
    // A naive 4-chars-per-token estimate would say 250.
    expect(estimateTokens(text)).toBeGreaterThan(text.length / 4);
  });

  it("handles an empty prompt", () => {
    expect(estimateTokens("")).toBe(0);
  });
});

describe("creditsRemainingPercent", () => {
  it("reports the share of the monthly allowance left", () => {
    expect(creditsRemainingPercent(AI_CHAT_MONTHLY_CREDITS)).toBe(100);
    expect(creditsRemainingPercent(AI_CHAT_MONTHLY_CREDITS / 2)).toBe(50);
    expect(creditsRemainingPercent(AI_CHAT_MONTHLY_CREDITS / 4)).toBe(25);
  });

  it("never rounds a non-empty balance down to 0%", () => {
    expect(creditsRemainingPercent(1)).toBe(1);
  });

  it("reports 0% only when the balance is actually empty", () => {
    expect(creditsRemainingPercent(0)).toBe(0);
  });

  it("clamps a topped-up balance above the allowance to 100%", () => {
    expect(creditsRemainingPercent(AI_CHAT_MONTHLY_CREDITS * 2)).toBe(100);
  });
});
