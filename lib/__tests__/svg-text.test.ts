import { describe, expect, it, beforeAll } from "vitest";

/**
 * The node environment has no <canvas>, so we install a deterministic stub with
 * a fixed 7px advance per character. That lets us assert the truncation logic
 * itself (fit, binary search, ellipsis) independently of real font metrics.
 */
const CHAR_WIDTH = 7;

beforeAll(() => {
  const ctx = { font: "", measureText: (t: string) => ({ width: t.length * CHAR_WIDTH }) };
  (globalThis as unknown as { document: unknown }).document = {
    createElement: () => ({ getContext: () => ctx }),
    body: {},
    fonts: undefined,
  };
  (globalThis as unknown as { getComputedStyle: unknown }).getComputedStyle = () => ({
    fontFamily: "TestSans",
  });
});

const FONT = "13px TestSans";

describe("truncateTextToWidth", () => {
  it("leaves text that already fits untouched", async () => {
    const { truncateTextToWidth } = await import("../svg-text");
    const result = truncateTextToWidth("users", FONT, 200);
    expect(result).toEqual({ text: "users", truncated: false });
  });

  it("truncates long text to within the budget and flags it", async () => {
    const { truncateTextToWidth, measureTextWidth } = await import("../svg-text");
    const long = "extremely_long_table_name_that_overflows_the_card";
    const maxWidth = 126;

    const result = truncateTextToWidth(long, FONT, maxWidth);

    expect(result.truncated).toBe(true);
    expect(result.text.endsWith("…")).toBe(true);
    expect(measureTextWidth(result.text, FONT)).toBeLessThanOrEqual(maxWidth);
  });

  it("keeps the longest prefix that fits", async () => {
    const { truncateTextToWidth, measureTextWidth } = await import("../svg-text");
    const long = "abcdefghijklmnopqrstuvwxyz";
    const maxWidth = 70; // exactly 10 characters wide

    const result = truncateTextToWidth(long, FONT, maxWidth);

    // 9 chars + ellipsis === 10 chars === the full budget.
    expect(result.text).toBe("abcdefghi…");
    expect(measureTextWidth(result.text, FONT)).toBe(maxWidth);
  });

  it("degrades to empty rather than overflowing an impossibly small budget", async () => {
    const { truncateTextToWidth } = await import("../svg-text");
    expect(truncateTextToWidth("anything", FONT, 3)).toEqual({ text: "", truncated: true });
  });

  it("returns cached results for repeated lookups", async () => {
    const { truncateTextToWidth } = await import("../svg-text");
    const first = truncateTextToWidth("some_long_column_name_here", FONT, 90);
    const second = truncateTextToWidth("some_long_column_name_here", FONT, 90);
    expect(second).toBe(first); // identity, not just equality
  });
});
