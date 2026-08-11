import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  requireDiagramOwnerOrAdmin,
  requireSignedIn,
  requirePro,
} from "./guards";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_MEMBERS = 5;

const generateToken = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;

export const create = mutation({
  args: {
    diagramId: v.id("diagrams"),
    invitedEmail: v.string(),
    role: v.union(v.literal("admin"), v.literal("editor"), v.literal("viewer")),
  },
  handler: async (ctx, args) => {
    const { user, diagram } = await requireDiagramOwnerOrAdmin(ctx, args.diagramId);

    const plan = user.planId ? await ctx.db.get(user.planId) : null;
    requirePro(user, plan);

    const [members, pendingInvites] = await Promise.all([
      ctx.db
        .query("diagramMembers")
        .withIndex("by_diagram", (q) => q.eq("diagramId", args.diagramId))
        .collect(),
      ctx.db
        .query("diagramInvites")
        .withIndex("by_diagram", (q) => q.eq("diagramId", args.diagramId))
        .collect(),
    ]);
    const now = Date.now();
    const activePendingCount = pendingInvites.filter(
      (i) => !i.usedAt && i.expiresAt > now
    ).length;
    if (members.length + activePendingCount >= MAX_MEMBERS) {
      throw new ConvexError(
        `This diagram already has ${MAX_MEMBERS} members or pending invites — remove one before inviting another.`
      );
    }

    const token = generateToken();
    const inviteId = await ctx.db.insert("diagramInvites", {
      diagramId: args.diagramId,
      token,
      invitedEmail: args.invitedEmail.trim().toLowerCase(),
      role: args.role,
      createdBy: user._id,
      createdAt: now,
      expiresAt: now + INVITE_TTL_MS,
    });

    return { inviteId, token, diagramName: diagram.name };
  },
});

export const revoke = mutation({
  args: { inviteId: v.id("diagramInvites") },
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.inviteId);
    if (!invite) throw new ConvexError("Invite not found.");

    await requireDiagramOwnerOrAdmin(ctx, invite.diagramId);
    await ctx.db.delete(args.inviteId);
  },
});

export const listForDiagram = query({
  args: { diagramId: v.id("diagrams") },
  handler: async (ctx, args) => {
    await requireDiagramOwnerOrAdmin(ctx, args.diagramId);

    const invites = await ctx.db
      .query("diagramInvites")
      .withIndex("by_diagram", (q) => q.eq("diagramId", args.diagramId))
      .collect();

    const now = Date.now();
    return invites
      .filter((i) => !i.usedAt)
      .map((i) => ({
        _id: i._id,
        token: i.token,
        invitedEmail: i.invitedEmail,
        role: i.role,
        createdAt: i.createdAt,
        expiresAt: i.expiresAt,
        isExpired: i.expiresAt <= now,
      }));
  },
});

export const accept = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const user = await requireSignedIn(ctx);

    const invite = await ctx.db
      .query("diagramInvites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();

    if (!invite) throw new ConvexError("This invite link is invalid.");
    if (invite.usedAt) throw new ConvexError("This invite has already been used.");
    if (invite.expiresAt <= Date.now()) {
      throw new ConvexError("This invite has expired.");
    }
    if (user.email.trim().toLowerCase() !== invite.invitedEmail) {
      throw new ConvexError(
        "This invite was sent to a different email address than the one you're signed in with."
      );
    }

    const existingMembership = await ctx.db
      .query("diagramMembers")
      .withIndex("by_diagram_and_user", (q) =>
        q.eq("diagramId", invite.diagramId).eq("userId", user._id)
      )
      .unique();

    const now = Date.now();
    if (!existingMembership) {
      await ctx.db.insert("diagramMembers", {
        diagramId: invite.diagramId,
        userId: user._id,
        role: invite.role,
        invitedAt: invite.createdAt,
        acceptedAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.patch(invite._id, { usedAt: now });

    return { diagramId: invite.diagramId };
  },
});
