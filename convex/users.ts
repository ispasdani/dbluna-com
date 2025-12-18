import { ConvexError, v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

// Helpers
const now = () => Date.now();
const cleanPatch = <T extends Record<string, unknown>>(obj: T) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

export const getUserByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) throw new ConvexError("User not found");
    return user;
  },
});

/**
 * Preferred in-app query:
 * - requires auth (Clerk)
 * - returns the Convex user record for the current session
 */
export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const clerkId = identity.subject;
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();

    if (!user) throw new ConvexError("User not found");
    return user;
  },
});

/**
 * Create a user. Idempotent:
 * - If the user already exists, we patch any newly-provided fields and return the id.
 * - If not, insert.
 *
 * Call this from your Clerk webhook or your "ensure user" flow.
 */
export const createUser = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    firstName: v.string(),
    lastName: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    credits: v.optional(v.number()),

    // Subscription fields (all optional)
    subscriptionId: v.optional(v.string()),
    subscriptionStatus: v.optional(v.string()),
    currentPeriodStart: v.optional(v.string()),
    currentPeriodEnd: v.optional(v.string()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    planId: v.optional(v.id("plans")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!existing) {
      const id = await ctx.db.insert("users", {
        clerkId: args.clerkId,
        email: args.email,
        firstName: args.firstName,
        lastName: args.lastName,
        imageUrl: args.imageUrl,
        credits: args.credits,
        createdAt: now(),

        subscriptionId: args.subscriptionId,
        subscriptionStatus: args.subscriptionStatus,
        currentPeriodStart: args.currentPeriodStart,
        currentPeriodEnd: args.currentPeriodEnd,
        cancelAtPeriodEnd: args.cancelAtPeriodEnd,
        planId: args.planId,
      });
      return id;
    }

    // Idempotent: patch anything that changed / is newly provided
    const patch = cleanPatch({
      email: args.email,
      firstName: args.firstName,
      lastName: args.lastName,
      imageUrl: args.imageUrl,
      credits: args.credits,

      subscriptionId: args.subscriptionId,
      subscriptionStatus: args.subscriptionStatus,
      currentPeriodStart: args.currentPeriodStart,
      currentPeriodEnd: args.currentPeriodEnd,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
      planId: args.planId,

      updatedAt: now(),
    });

    // If only updatedAt would be written, skip
    if (Object.keys(patch).length > 1) {
      await ctx.db.patch(existing._id, patch);
    }

    return existing._id;
  },
});

/**
 * Update a user by clerkId. Only provided fields are patched.
 * Automatically sets updatedAt.
 */
export const updateUser = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    credits: v.optional(v.number()),

    subscriptionId: v.optional(v.string()),
    subscriptionStatus: v.optional(v.string()),
    currentPeriodStart: v.optional(v.string()),
    currentPeriodEnd: v.optional(v.string()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    planId: v.optional(v.id("plans")),
  },
  async handler(ctx, args) {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) throw new ConvexError("User not found");

    const patch = cleanPatch({
      email: args.email,
      firstName: args.firstName,
      lastName: args.lastName,
      imageUrl: args.imageUrl,
      credits: args.credits,

      subscriptionId: args.subscriptionId,
      subscriptionStatus: args.subscriptionStatus,
      currentPeriodStart: args.currentPeriodStart,
      currentPeriodEnd: args.currentPeriodEnd,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
      planId: args.planId,

      updatedAt: now(),
    });

    if (Object.keys(patch).length === 1 && "updatedAt" in patch) return;

    await ctx.db.patch(user._id, patch);
  },
});

export const deleteUser = internalMutation({
  args: { clerkId: v.string() },
  async handler(ctx, args) {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) throw new ConvexError("User not found");

    await ctx.db.delete(user._id);
  },
});
