// Pure decision logic for Clerk Billing webhooks, kept out of convex/http.ts
// so it can be tested. Subscription bugs are close to untestable in place —
// they need a real upgrade, a real cancel, and webhooks arriving in an order
// you can't force — so the rules live here with a test each.
//
// Two real failure modes this exists to prevent, both found in an audit of the
// live handler:
//
//   1. Cancelling revoked Pro instantly. Clerk fires `subscriptionItem.canceled`
//      when the user clicks cancel, while the item stays active until the end
//      of the period they already paid for.
//   2. Upgrading could silently downgrade. Every `subscriptionItem.*` event
//      overwrote the user's plan, whichever item it concerned — so the old
//      Free item's "ended" event, arriving after the new Pro item's "active",
//      put the user back on Free moments after paying.

/** Plan slugs that grant paid access. Mirrored by convex/guards.ts. */
export const PAID_PLAN_SLUGS = ["pro", "enterprise"] as const;

export function isPaidPlanSlug(slug?: string | null): boolean {
  return !!slug && (PAID_PLAN_SLUGS as readonly string[]).includes(slug);
}

/**
 * Clerk's exact casing for status values isn't something we can pin from
 * here — event names are camelCase while status values are typically
 * snake_case — so every comparison in this file goes through normalisation.
 * `past_due`, `pastDue` and `PAST_DUE` must not be three different answers to
 * "does this person still have access".
 */
function normalizeStatus(status?: string | null): string {
  return (status ?? "").toLowerCase().replace(/[^a-z]/g, "");
}

const CANCELED_STATUSES = new Set(["canceled", "cancelled"]);

/**
 * Statuses where the subscription item is losing or has lost access.
 * Cancellation is included here for *staleness* checks — an event about a plan
 * the user already left is noise — but it is not treated as loss of access;
 * see `resolveSubscriptionStatus`.
 */
function isDeactivating(status: string): boolean {
  const s = normalizeStatus(status);
  return CANCELED_STATUSES.has(s) || s === "ended" || s === "abandoned";
}

/**
 * How long past the recorded period end access survives.
 *
 * This covers exactly one situation: the renewal went through but its webhook
 * hasn't reached us yet. Status still reads `active`, so we have no evidence
 * of a failure, and the stored period end is simply stale — locking out
 * someone who has actually paid, because an event is running late, is far
 * worse than carrying them briefly.
 *
 * It is *not* leniency toward failed payments. A failure sets a status that
 * isn't in ACCESS_STATUSES, and that denies access regardless of this window.
 */
export const SUBSCRIPTION_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Statuses that grant access.
 *
 * `past_due` is deliberately absent. Stripe bills at the *start* of a period,
 * so a failed renewal means the period being asked for is the unpaid one —
 * the subscriber has already had everything they paid for. Retries may well
 * succeed, and access returns the moment one does, but service isn't extended
 * on credit in the meantime.
 *
 * Cancellation is handled separately and does still keep access to the end of
 * the paid period — see `resolveSubscriptionStatus`. Cancelling is not the
 * same as not paying.
 */
const ACCESS_STATUSES = new Set(["active"]);

/**
 * Whether a user currently has paid access. This is the gate for every paid
 * feature.
 *
 * Two independent conditions, both required:
 *
 *   1. The status says access is live, so a failed payment denies at once.
 *   2. The period we were actually paid for hasn't elapsed.
 *
 * The second exists because trusting the status alone meant a single missed
 * webhook — a delivery failure, a signature mismatch, downtime at either
 * end — left a lapsed subscriber marked `active` forever, keeping every paid
 * feature and collecting a fresh AI allowance every month without paying.
 * Requiring a live period makes a dropped event self-correcting rather than
 * permanent.
 */
export function hasActivePaidAccess(
  state: ExistingSubscriptionState,
  now: number = Date.now()
): boolean {
  if (!isPaidPlanSlug(state.planSlug)) return false;
  if (!ACCESS_STATUSES.has(normalizeStatus(state.status))) return false;

  // No period recorded at all: trust the status. This is what keeps users
  // grandfathered onto Pro by convex/migrations.ts working — they have a plan
  // and a status but never had a billing period. Once every row carries a
  // period end, this branch could be tightened.
  if (!state.currentPeriodEnd) return true;

  const endsAt = Date.parse(state.currentPeriodEnd);
  // Unparseable dates must not revoke access — bad data is our bug, not the
  // subscriber's.
  if (Number.isNaN(endsAt)) return true;

  return now <= endsAt + SUBSCRIPTION_GRACE_MS;
}

export type IncomingSubscriptionEvent = {
  planSlug?: string | null;
  status: string;
  /** Epoch ms, as Clerk sends it. */
  periodEnd?: number | null;
};

export type ExistingSubscriptionState = {
  planSlug?: string | null;
  status?: string;
  /** ISO string, as stored on the user row. */
  currentPeriodEnd?: string;
};

/**
 * What to write for a subscription item's status.
 *
 * A cancellation with time left on the clock stays `active` and records the
 * intent in `cancelAtPeriodEnd`. The user paid through the end of the period
 * and keeps what they paid for; Clerk sends a separate `ended` event when the
 * period actually elapses, and that one does revoke.
 */
export function resolveSubscriptionStatus(
  event: IncomingSubscriptionEvent,
  now: number = Date.now()
): { status: string; cancelAtPeriodEnd: boolean } {
  if (CANCELED_STATUSES.has(normalizeStatus(event.status))) {
    const stillPaidFor = typeof event.periodEnd === "number" && event.periodEnd > now;
    return { status: stillPaidFor ? "active" : "canceled", cancelAtPeriodEnd: true };
  }

  return { status: event.status, cancelAtPeriodEnd: false };
}

/**
 * Whether an incoming event should be written to the user at all.
 *
 * Clerk emits several events per billing change, for several subscription
 * items, with no ordering guarantee. Blindly applying the last one to arrive
 * is what made upgrades flaky.
 */
export function shouldApplyPlanUpdate(
  existing: ExistingSubscriptionState,
  event: IncomingSubscriptionEvent,
  now: number = Date.now()
): boolean {
  // Nothing to protect yet — any event is an improvement on no state.
  if (!existing.planSlug) return true;

  // An event winding down a plan the user has already moved off is stale.
  // This is the upgrade-downgrade race: the old Free item's ending must not
  // touch a user who is now on Pro.
  if (isDeactivating(event.status) && event.planSlug !== existing.planSlug) {
    return false;
  }

  // A free-plan event must not override paid access that is still running.
  // Clerk moves users onto its default free plan as part of several flows,
  // and that event can land after the paid one. Same predicate as the access
  // gate, so "still paid" means one thing in this codebase.
  if (!isPaidPlanSlug(event.planSlug) && hasActivePaidAccess(existing, now)) {
    return false;
  }

  return true;
}
