import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const now = () => Date.now();

/**
 * Public: creates or updates a sandbox session by visitorId.
 * Call this once when sandbox loads.
 */
export const touchSession = mutation({
  args: {
    visitorId: v.string(),
    userAgent: v.optional(v.string()),
    firstPath: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("sandboxSessions")
      .withIndex("by_visitorId", (q) => q.eq("visitorId", args.visitorId))
      .unique();

    if (!existing) {
      const id = await ctx.db.insert("sandboxSessions", {
        visitorId: args.visitorId,
        createdAt: now(),
        lastSeenAt: now(),
        userAgent: args.userAgent,
        firstPath: args.firstPath,
      });
      return { created: true, id };
    }

    await ctx.db.patch(existing._id, {
      lastSeenAt: now(),
      // don't overwrite firstPath/userAgent unless missing
      userAgent: existing.userAgent ?? args.userAgent,
      firstPath: existing.firstPath ?? args.firstPath,
    });

    return { created: false, id: existing._id };
  },
});

/**
 * Public: track a sandbox event (optional).
 * Keep this sparse so you don’t spam your DB.
 */
export const trackEvent = mutation({
  args: {
    visitorId: v.string(),
    type: v.string(), // e.g. "open", "add_table", "move_table"
    meta: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("sandboxEvents", {
      visitorId: args.visitorId,
      type: args.type,
      ts: now(),
      meta: args.meta,
    });
  },
});

/**
 * Minimal stats for your own dashboard later.
 * (Not meant for heavy analytics; keep it simple.)
 */
export const stats = query({
  args: {},
  handler: async (ctx) => {
    const sessions = await ctx.db.query("sandboxSessions").collect();
    const events = await ctx.db.query("sandboxEvents").collect();

    return {
      totalSessions: sessions.length,
      totalEvents: events.length,
      // rough “active in last 24h”
      activeLast24h: sessions.filter(
        (s) => s.lastSeenAt > now() - 24 * 60 * 60 * 1000
      ).length,
    };
  },
});
