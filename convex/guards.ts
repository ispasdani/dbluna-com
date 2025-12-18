// convex/guards.ts
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { ConvexError } from "convex/values";

export class AuthRequired extends Error {
  code = "ERR_AUTH_REQUIRED";
  constructor(message = "Sign in to continue.") {
    super(message);
  }
}

export async function getCurrentUserDoc(ctx: MutationCtx | QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();

  return user ?? null;
}

export async function requireSignedIn(ctx: MutationCtx | QueryCtx) {
  const user = await getCurrentUserDoc(ctx);
  if (!user) throw new AuthRequired("Sign in to access your workspace.");
  return user;
}

export function isPro(user: Doc<"users">): boolean {
  return user.subscriptionStatus === "active";
}

export function requirePro(user: Doc<"users">) {
  if (!isPro(user)) {
    throw new ConvexError("Upgrade to Pro to access this feature.");
  }
}

export type DiagramRole = "owner" | "admin" | "editor" | "viewer";

export async function requireDiagramRole(
  ctx: MutationCtx | QueryCtx,
  diagramId: Id<"diagrams">,
  allowedRoles: DiagramRole[]
) {
  const user = await requireSignedIn(ctx);

  const diagram = await ctx.db.get(diagramId);
  if (!diagram) throw new ConvexError("Diagram not found.");

  if (diagram.ownerId === user._id) {
    const role: DiagramRole = "owner";
    if (!allowedRoles.includes(role)) {
      throw new ConvexError("You don't have access to this diagram.");
    }
    return { user, diagram, role, membership: null };
  }

  const membership = await ctx.db
    .query("diagramMembers")
    .withIndex("by_diagram_and_user", (q) =>
      q.eq("diagramId", diagramId).eq("userId", user._id)
    )
    .unique();

  if (!membership)
    throw new ConvexError("You don't have access to this diagram.");

  const role = membership.role as DiagramRole;
  if (!allowedRoles.includes(role)) {
    throw new ConvexError("You don't have access to this diagram.");
  }

  return { user, diagram, role, membership };
}

export async function requireDiagramViewer(
  ctx: MutationCtx | QueryCtx,
  diagramId: Id<"diagrams">
) {
  return requireDiagramRole(ctx, diagramId, [
    "owner",
    "admin",
    "editor",
    "viewer",
  ]);
}

export async function requireDiagramEditor(
  ctx: MutationCtx | QueryCtx,
  diagramId: Id<"diagrams">
) {
  return requireDiagramRole(ctx, diagramId, ["owner", "admin", "editor"]);
}

export async function requireDiagramOwnerOrAdmin(
  ctx: MutationCtx | QueryCtx,
  diagramId: Id<"diagrams">
) {
  return requireDiagramRole(ctx, diagramId, ["owner", "admin"]);
}
