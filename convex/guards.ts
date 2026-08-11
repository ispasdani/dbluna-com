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

export function isPro(user: Doc<"users">, plan: Doc<"plans"> | null): boolean {
  return user.subscriptionStatus === "active" && plan?.slug === "pro";
}

export function requirePro(user: Doc<"users">, plan: Doc<"plans"> | null) {
  if (!isPro(user, plan)) {
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

// Composed guards for the cloud-sync mutations (release-1-0's Phase 3): signed
// in isn't enough, the caller's plan must actually resolve to Pro.
export async function requireSignedInPro(ctx: MutationCtx | QueryCtx) {
  const user = await requireSignedIn(ctx);
  const plan = user.planId ? await ctx.db.get(user.planId) : null;
  requirePro(user, plan);
  return { user, plan };
}

// Version history's viewer gate (release-1-0/version-history-plan.md §5):
// unlike requireDiagramViewer, this checks the *requesting* user's own plan,
// not the diagram owner's — a Free-tier collaborator on someone else's Pro
// diagram gets no history access at all, only ever the diagram's latest
// state via the ordinary requireDiagramViewer path.
export async function requireProDiagramViewer(
  ctx: MutationCtx | QueryCtx,
  diagramId: Id<"diagrams">
) {
  const result = await requireDiagramViewer(ctx, diagramId);
  const plan = result.user.planId ? await ctx.db.get(result.user.planId) : null;
  requirePro(result.user, plan);
  return { ...result, plan };
}

export async function requireProDiagramEditor(
  ctx: MutationCtx | QueryCtx,
  diagramId: Id<"diagrams">
) {
  const result = await requireDiagramEditor(ctx, diagramId);
  const plan = result.user.planId ? await ctx.db.get(result.user.planId) : null;
  requirePro(result.user, plan);
  return { ...result, plan };
}
