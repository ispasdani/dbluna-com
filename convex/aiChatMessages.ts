import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireProDiagramEditor, requireProDiagramViewer } from "./guards";

// ai-chat-credits-and-sync-plan.md, Phase 2. Append-only by design — reuses
// guards.ts's existing diagram-role guards verbatim, nothing new needed there.

export const list = query({
  args: { diagramId: v.id("diagrams") },
  handler: async (ctx, args) => {
    await requireProDiagramViewer(ctx, args.diagramId);

    return ctx.db
      .query("aiChatMessages")
      .withIndex("by_diagram_and_created", (q) => q.eq("diagramId", args.diagramId))
      .order("asc")
      .collect();
  },
});

export const append = mutation({
  args: {
    diagramId: v.id("diagrams"),
    messageId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    parts: v.any(),
  },
  handler: async (ctx, args) => {
    const { user } = await requireProDiagramEditor(ctx, args.diagramId);

    // Idempotent on messageId — a retried push after a flaky connection (or
    // a client re-scanning its full message list, see
    // hooks/use-cloud-ai-chat-sync.ts) must not duplicate the row.
    const existing = await ctx.db
      .query("aiChatMessages")
      .withIndex("by_diagram", (q) => q.eq("diagramId", args.diagramId))
      .filter((q) => q.eq(q.field("messageId"), args.messageId))
      .first();
    if (existing) return existing._id;

    return ctx.db.insert("aiChatMessages", {
      diagramId: args.diagramId,
      messageId: args.messageId,
      role: args.role,
      parts: args.parts,
      createdBy: user._id,
      createdAt: Date.now(),
    });
  },
});
