import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const getBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    return await ctx.db
      .query("plans")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
  },
});

/**
 * Idempotent upsert of the FREE/PRO plan rows. Run manually once via
 * `npx convex run plans:seed` — not wired to any trigger. Slugs must match
 * the slugs configured for the corresponding Plans in the Clerk dashboard.
 */
export const seed = internalMutation({
  args: {},
  handler: async (ctx) => {
    const defs = [
      {
        slug: "free",
        name: "FREE",
        features: {
          diagramLimit: 5,
          tablesPerDiagram: 20,
          collaborators: 0,
        },
      },
      {
        slug: "pro",
        name: "PRO",
        features: {
          diagramLimit: null,
          tablesPerDiagram: null,
          collaborators: 5,
        },
      },
    ];

    for (const def of defs) {
      const existing = await ctx.db
        .query("plans")
        .withIndex("by_slug", (q) => q.eq("slug", def.slug))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          name: def.name,
          features: def.features,
        });
      } else {
        await ctx.db.insert("plans", {
          slug: def.slug,
          name: def.name,
          features: def.features,
          createdAt: Date.now(),
        });
      }
    }
  },
});
