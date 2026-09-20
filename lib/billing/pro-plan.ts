import { cache } from "react";

// Resolves the Clerk plan id for checkout.
//
// Clerk's `<CheckoutButton>` takes a `cplan_…` id, while everything else in
// this codebase identifies the plan by its slug — convex/plans.ts seeds it,
// the billing webhook resolves incoming events by it, guards.ts gates on it.
// Looking the id up from the slug keeps that single identifier, instead of
// adding a second one in an environment variable that can silently go stale
// or be forgotten (a missing one leaves the Pro button linking to the page
// it's on, which looks exactly like a broken button).

/** Must match the slug seeded by convex/plans.ts and configured in Clerk. */
export const PRO_PLAN_SLUG = "pro";

const PLANS_ENDPOINT = "https://api.clerk.com/v1/billing/plans";

/** Re-read hourly, so a plan edited in the Clerk dashboard lands without a deploy. */
const REVALIDATE_SECONDS = 3600;

/**
 * The Clerk plan id for Pro, or null if it can't be resolved.
 *
 * Deliberately a plain `fetch` rather than `clerkClient()`. The SDK client
 * reads `headers()` to pick up request context, which throws during static
 * generation — and because this function swallows errors, that turned into
 * pages built with no plan id at all, i.e. the dead button again, in
 * production only. A direct call to the Backend API depends on nothing but
 * the secret key, so these pages stay static and Next can cache the result.
 *
 * `cache()` dedupes per render pass; `revalidate` caches across requests.
 * Never throws: Billing being disabled or the API being down degrades the CTA
 * to a link rather than taking down the marketing site.
 */
export const getProPlanId = cache(async (): Promise<string | null> => {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    console.error(
      "[billing] CLERK_SECRET_KEY is not set — the Pro CTA cannot open checkout. " +
        "Note this is read at build time too: a build without it ships a non-functional button."
    );
    return null;
  }

  try {
    const res = await fetch(PLANS_ENDPOINT, {
      headers: { Authorization: `Bearer ${secretKey}` },
      next: { revalidate: REVALIDATE_SECONDS },
    });

    if (!res.ok) {
      console.error(
        `[billing] Clerk returned ${res.status} listing plans — is Billing enabled on this instance?`
      );
      return null;
    }

    const body: unknown = await res.json();
    const plans = (Array.isArray(body) ? body : ((body as { data?: unknown })?.data ?? [])) as {
      id?: unknown;
      slug?: unknown;
    }[];

    const plan = plans.find((p) => p.slug === PRO_PLAN_SLUG);
    if (typeof plan?.id !== "string") {
      console.error(
        `[billing] no Clerk plan with slug "${PRO_PLAN_SLUG}". It must match the slug seeded ` +
          `by convex/plans.ts, or checkout and the billing webhook disagree about which plan Pro is.`
      );
      return null;
    }

    return plan.id;
  } catch (err) {
    console.error("[billing] could not resolve the Pro plan id from Clerk", err);
    return null;
  }
});
