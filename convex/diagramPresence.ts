import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireDiagramViewer } from "./guards";

const STALE_AFTER_MS = 30 * 1000;
const CLEANUP_AFTER_MS = 10 * 60 * 1000;

export const heartbeat = mutation({
  args: { diagramId: v.id("diagrams") },
  handler: async (ctx, args) => {
    const { user } = await requireDiagramViewer(ctx, args.diagramId);

    const existing = await ctx.db
      .query("diagramPresence")
      .withIndex("by_diagram_and_user", (q) =>
        q.eq("diagramId", args.diagramId).eq("userId", user._id)
      )
      .unique();

    const lastSeenAt = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { lastSeenAt });
    } else {
      await ctx.db.insert("diagramPresence", {
        diagramId: args.diagramId,
        userId: user._id,
        lastSeenAt,
      });
    }
  },
});

export const listActive = query({
  args: { diagramId: v.id("diagrams") },
  handler: async (ctx, args) => {
    const { user: caller } = await requireDiagramViewer(ctx, args.diagramId);

    const rows = await ctx.db
      .query("diagramPresence")
      .withIndex("by_diagram", (q) => q.eq("diagramId", args.diagramId))
      .collect();

    const cutoff = Date.now() - STALE_AFTER_MS;
    const active = rows.filter((r) => r.lastSeenAt >= cutoff);

    const users = await Promise.all(active.map((r) => ctx.db.get(r.userId)));
    return active
      .map((r, i) => {
        const u = users[i];
        if (!u) return null;
        return {
          userId: r.userId,
          firstName: u.firstName,
          lastName: u.lastName,
          imageUrl: u.imageUrl,
          // Everyone here already passed requireDiagramViewer, so they're a
          // member of this diagram — and members are invited by email in the
          // first place (see diagramInvites). Surfacing it is what makes two
          // people with the same first name tellable apart on hover.
          email: u.email,
          // The heartbeat writes a row for the caller too; the UI drops it
          // rather than the server, so a future "N people here" count can
          // still include you.
          isSelf: r.userId === caller._id,
        };
      })
      .filter((u): u is NonNullable<typeof u> => u !== null);
  },
});

// Hygiene only, not load-bearing for correctness — listActive's STALE_AFTER_MS
// filter already hides stale rows from the UI. This just keeps the table from
// growing unbounded (release-1-0/collaboration-plan.md Phase B §4).
export const cleanupStale = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - CLEANUP_AFTER_MS;
    const stale = await ctx.db
      .query("diagramPresence")
      .filter((q) => q.lt(q.field("lastSeenAt"), cutoff))
      .collect();
    await Promise.all(stale.map((r) => ctx.db.delete(r._id)));
  },
});
