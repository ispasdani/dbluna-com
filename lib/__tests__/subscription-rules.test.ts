import { describe, it, expect } from "vitest";
import {
  SUBSCRIPTION_GRACE_MS,
  hasActivePaidAccess,
  isPaidPlanSlug,
  resolveSubscriptionStatus,
  shouldApplyPlanUpdate,
} from "@/lib/subscription-rules";

const NOW = Date.parse("2026-09-20T12:00:00.000Z");
const IN_A_WEEK = NOW + 7 * 24 * 60 * 60 * 1000;
const A_WEEK_AGO = NOW - 7 * 24 * 60 * 60 * 1000;
const iso = (ms: number) => new Date(ms).toISOString();

describe("resolveSubscriptionStatus", () => {
  it("keeps access alive when a cancellation still has time on the clock", () => {
    // The bug: Clerk fires `canceled` the moment the user clicks cancel, and
    // writing that through revoked Pro from someone who had paid for another
    // three weeks.
    expect(
      resolveSubscriptionStatus(
        { planSlug: "pro", status: "canceled", periodEnd: IN_A_WEEK },
        NOW
      )
    ).toEqual({ status: "active", cancelAtPeriodEnd: true });
  });

  it("revokes once the cancelled period has actually elapsed", () => {
    expect(
      resolveSubscriptionStatus(
        { planSlug: "pro", status: "canceled", periodEnd: A_WEEK_AGO },
        NOW
      )
    ).toEqual({ status: "canceled", cancelAtPeriodEnd: true });
  });

  it("revokes a cancellation with no period end at all", () => {
    expect(
      resolveSubscriptionStatus({ planSlug: "pro", status: "canceled" }, NOW)
    ).toEqual({ status: "canceled", cancelAtPeriodEnd: true });
  });

  it("passes other statuses through untouched", () => {
    expect(
      resolveSubscriptionStatus({ planSlug: "pro", status: "active" }, NOW)
    ).toEqual({ status: "active", cancelAtPeriodEnd: false });
    expect(
      resolveSubscriptionStatus({ planSlug: "pro", status: "ended" }, NOW)
    ).toEqual({ status: "ended", cancelAtPeriodEnd: false });
  });
});

describe("shouldApplyPlanUpdate", () => {
  const onPro = {
    planSlug: "pro",
    status: "active",
    currentPeriodEnd: iso(IN_A_WEEK),
  };

  it("applies anything to a user with no plan yet", () => {
    expect(
      shouldApplyPlanUpdate({}, { planSlug: "pro", status: "active" }, NOW)
    ).toBe(true);
  });

  it("ignores the old Free item ending after an upgrade", () => {
    // The upgrade-downgrade race: these two events arrive together and in
    // either order. Applying the Free one put the user back on Free seconds
    // after they paid.
    expect(
      shouldApplyPlanUpdate({}, { planSlug: "pro", status: "active" }, NOW)
    ).toBe(true);
    expect(
      shouldApplyPlanUpdate(onPro, { planSlug: "free", status: "ended" }, NOW)
    ).toBe(false);
  });

  it("ignores a Free item going active while paid access is still running", () => {
    expect(
      shouldApplyPlanUpdate(onPro, { planSlug: "free", status: "active" }, NOW)
    ).toBe(false);
  });

  it("applies a cancellation of the plan the user is actually on", () => {
    expect(
      shouldApplyPlanUpdate(
        onPro,
        { planSlug: "pro", status: "canceled", periodEnd: IN_A_WEEK },
        NOW
      )
    ).toBe(true);
  });

  it("applies the real expiry when the paid period has elapsed", () => {
    const lapsed = { ...onPro, currentPeriodEnd: iso(A_WEEK_AGO) };
    expect(
      shouldApplyPlanUpdate(lapsed, { planSlug: "free", status: "active" }, NOW)
    ).toBe(true);
  });

  it("lets an upgrade from Pro to Enterprise through", () => {
    expect(
      shouldApplyPlanUpdate(onPro, { planSlug: "enterprise", status: "active" }, NOW)
    ).toBe(true);
  });

  it("does not revoke access on an unparseable stored period end", () => {
    const corrupt = { ...onPro, currentPeriodEnd: "not a date" };
    expect(
      shouldApplyPlanUpdate(corrupt, { planSlug: "free", status: "active" }, NOW)
    ).toBe(false);
  });
});

describe("hasActivePaidAccess", () => {
  const live = {
    planSlug: "pro",
    status: "active",
    currentPeriodEnd: iso(IN_A_WEEK),
  };

  it("grants access inside the paid period", () => {
    expect(hasActivePaidAccess(live, NOW)).toBe(true);
  });

  // The gap this function exists to close: `subscriptionStatus` is only as
  // trustworthy as the last webhook that set it. One dropped event used to
  // mean a lapsed subscriber kept Pro — and a fresh AI allowance every
  // month — indefinitely.
  it("revokes once the paid period and grace have elapsed", () => {
    const lapsed = { ...live, currentPeriodEnd: iso(A_WEEK_AGO) };
    expect(hasActivePaidAccess(lapsed, NOW)).toBe(false);
  });

  it("carries a late renewal through the grace window", () => {
    // A renewal webhook arriving hours late must not lock out someone who
    // has actually paid.
    const justEnded = { ...live, currentPeriodEnd: iso(NOW - 60 * 60 * 1000) };
    expect(hasActivePaidAccess(justEnded, NOW)).toBe(true);

    const wellPast = {
      ...live,
      currentPeriodEnd: iso(NOW - SUBSCRIPTION_GRACE_MS - 1000),
    };
    expect(hasActivePaidAccess(wellPast, NOW)).toBe(false);
  });

  it("denies access as soon as a payment fails", () => {
    // Stripe bills at the start of a period, so past_due means the period
    // being asked for is the unpaid one — the subscriber has already had
    // everything they paid for. Service isn't extended on credit.
    for (const status of ["past_due", "pastDue", "PAST_DUE"]) {
      expect(hasActivePaidAccess({ ...live, status }, NOW)).toBe(false);
    }
  });

  it("does not let the grace window cover a failed payment", () => {
    // The grace exists for a late webhook on a *successful* renewal. A
    // failure must not borrow it.
    const justFailed = { ...live, status: "past_due", currentPeriodEnd: iso(NOW) };
    expect(hasActivePaidAccess(justFailed, NOW)).toBe(false);
  });

  it("reads status regardless of how the provider cases it", () => {
    // Clerk's casing for status values isn't something we can pin from here,
    // and a bare string compare that guessed wrong would fail open.
    for (const status of ["active", "ACTIVE", "Active"]) {
      expect(hasActivePaidAccess({ ...live, status }, NOW)).toBe(true);
    }
  });

  it("denies terminal statuses even inside the period", () => {
    for (const status of ["ended", "canceled", "abandoned", "incomplete"]) {
      expect(hasActivePaidAccess({ ...live, status }, NOW)).toBe(false);
    }
  });

  it("still honours a cancellation through to the end of the paid period", () => {
    // Cancelling is not the same as not paying. `resolveSubscriptionStatus`
    // stores a cancellation with time left as `active` + cancelAtPeriodEnd,
    // so the gate sees paid access — which is correct, they paid for it.
    const { status } = resolveSubscriptionStatus(
      { planSlug: "pro", status: "canceled", periodEnd: IN_A_WEEK },
      NOW
    );
    expect(hasActivePaidAccess({ ...live, status }, NOW)).toBe(true);
  });

  it("denies free plans and unknown plans", () => {
    expect(hasActivePaidAccess({ ...live, planSlug: "free" }, NOW)).toBe(false);
    expect(hasActivePaidAccess({ ...live, planSlug: undefined }, NOW)).toBe(false);
  });

  it("grants Enterprise the same way as Pro", () => {
    expect(hasActivePaidAccess({ ...live, planSlug: "enterprise" }, NOW)).toBe(true);
  });

  it("trusts the status when no period was ever recorded", () => {
    // Users grandfathered onto Pro by convex/migrations.ts have a plan and a
    // status but never had a billing period — they must not be locked out.
    expect(
      hasActivePaidAccess({ planSlug: "pro", status: "active" }, NOW)
    ).toBe(true);
  });

  it("does not revoke on an unparseable period end", () => {
    expect(
      hasActivePaidAccess({ ...live, currentPeriodEnd: "not a date" }, NOW)
    ).toBe(true);
  });
});

describe("isPaidPlanSlug", () => {
  it("recognises the paid slugs and nothing else", () => {
    expect(isPaidPlanSlug("pro")).toBe(true);
    expect(isPaidPlanSlug("enterprise")).toBe(true);
    expect(isPaidPlanSlug("free")).toBe(false);
    expect(isPaidPlanSlug(undefined)).toBe(false);
    expect(isPaidPlanSlug(null)).toBe(false);
  });
});
