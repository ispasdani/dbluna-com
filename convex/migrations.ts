import { internalMutation } from "./_generated/server";

/**
 * One-time, manually-triggered mutation: grandfathers every existing user
 * with no subscriptionStatus onto Pro, so nobody who could already edit
 * their diagrams gets locked out the moment the editing gate ships (see
 * release-1-0/paid-editing-access-plan.md §3).
 *
 * Run once via `npx convex run migrations:grandfatherExistingUsersToPro`
 * after the PRO plan has been seeded (convex/plans.ts:seed) — not wired to
 * any trigger, and safe to re-run since it only touches users still missing
 * subscriptionStatus.
 */
export const grandfatherExistingUsersToPro = internalMutation({
  args: {},
  handler: async (ctx) => {
    const proPlan = await ctx.db
      .query("plans")
      .withIndex("by_slug", (q) => q.eq("slug", "pro"))
      .unique();

    if (!proPlan) {
      throw new Error(
        "PRO plan not seeded yet — run plans:seed first (see convex/plans.ts)."
      );
    }

    const users = await ctx.db.query("users").collect();
    let patched = 0;

    for (const user of users) {
      if (user.subscriptionStatus !== undefined) continue;

      await ctx.db.patch(user._id, {
        subscriptionStatus: "active",
        planId: proPlan._id,
        updatedAt: Date.now(),
      });
      patched++;
    }

    return { total: users.length, patched };
  },
});
