import { describe, it, expect } from "vitest";
import {
  AI_BUDGET_CEILING_USD,
  AI_CHAT_MONTHLY_CREDITS,
  CACHED_INPUT_WEIGHT,
  MAX_MONTHLY_AI_COST_USD,
  MODEL_PRICE_USD_PER_MTOK,
  OUTPUT_WEIGHT,
  USD_PER_CREDIT,
  creditsForUsage,
  creditsRemainingPercent,
} from "@/lib/ai-credits";

describe("ai credit economics", () => {
  // The guard that matters: raising the allowance, or switching to a pricier
  // model, must fail here rather than quietly eating margin in production.
  it("keeps the worst-case monthly cost inside the budget ceiling", () => {
    expect(MAX_MONTHLY_AI_COST_USD).toBeLessThanOrEqual(AI_BUDGET_CEILING_USD);
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
    expect(MAX_MONTHLY_AI_COST_USD).toBeCloseTo(1.875, 4);
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

describe("creditsRemainingPercent", () => {
  it("reports the share of the monthly allowance left", () => {
    expect(creditsRemainingPercent(500)).toBe(100);
    expect(creditsRemainingPercent(250)).toBe(50);
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
