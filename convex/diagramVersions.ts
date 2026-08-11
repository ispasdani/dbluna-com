import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireProDiagramViewer, requireProDiagramEditor } from "./guards";

// release-1-0/version-history-plan.md — decisions: 30 min auto-snapshot gap
// (resets on any save, auto or manual), 20-version cap on auto snapshots
// only (manual/promotion snapshots are never pruned).
const AUTO_SNAPSHOT_GAP_MS = 30 * 60 * 1000;
const MAX_AUTO_VERSIONS = 20;

// Plain functions, not Convex mutations — called from inside diagrams.ts's
// own mutation handlers so snapshotting stays in the same transaction as the
// update/create/restore it's attached to. Exported for that reuse.

export async function insertVersion(
  ctx: MutationCtx,
  diagram: Doc<"diagrams">,
  createdBy: Id<"users">,
  kind: "promotion" | "auto" | "manual",
  label?: string
) {
  await ctx.db.insert("diagramVersions", {
    diagramId: diagram._id,
    createdAt: Date.now(),
    createdBy,
    kind,
    label,
    name: diagram.name,
    tables: diagram.tables,
    relationships: diagram.relationships,
    areas: diagram.areas,
    notes: diagram.notes,
    camera: diagram.camera,
    enums: diagram.enums,
    tableGroups: diagram.tableGroups,
    project: diagram.project,
  });
}

export async function pruneOldAutoVersions(ctx: MutationCtx, diagramId: Id<"diagrams">) {
  const autoVersions = await ctx.db
    .query("diagramVersions")
    .withIndex("by_diagram_and_created", (q) => q.eq("diagramId", diagramId))
    .filter((q) => q.eq(q.field("kind"), "auto"))
    .order("desc")
    .collect();

  const toDelete = autoVersions.slice(MAX_AUTO_VERSIONS);
  await Promise.all(toDelete.map((v) => ctx.db.delete(v._id)));
}

// Called before diagrams.update applies its patch, with the pre-patch doc —
// snapshots the state about to be overwritten, but only on the first push
// after a gap (checked against the newest version row of ANY kind, so a
// manual save resets this clock too, not just another auto one).
export async function maybeAutoSnapshot(
  ctx: MutationCtx,
  diagram: Doc<"diagrams">,
  createdBy: Id<"users">
) {
  const newest = await ctx.db
    .query("diagramVersions")
    .withIndex("by_diagram_and_created", (q) => q.eq("diagramId", diagram._id))
    .order("desc")
    .first();

  if (newest && Date.now() - newest.createdAt < AUTO_SNAPSHOT_GAP_MS) return;

  await insertVersion(ctx, diagram, createdBy, "auto");
  await pruneOldAutoVersions(ctx, diagram._id);
}

export const list = query({
  args: { diagramId: v.id("diagrams") },
  handler: async (ctx, args) => {
    await requireProDiagramViewer(ctx, args.diagramId);

    const versions = await ctx.db
      .query("diagramVersions")
      .withIndex("by_diagram_and_created", (q) => q.eq("diagramId", args.diagramId))
      .order("desc")
      .collect();

    const creatorIds = Array.from(new Set(versions.map((ver) => ver.createdBy)));
    const creators = await Promise.all(creatorIds.map((id) => ctx.db.get(id)));
    const nameById = new Map(
      creators
        .filter((c): c is NonNullable<typeof c> => c !== null)
        .map((c) => [c._id, [c.firstName, c.lastName].filter(Boolean).join(" ")])
    );

    return versions.map((ver) => ({
      _id: ver._id,
      createdAt: ver.createdAt,
      kind: ver.kind,
      label: ver.label,
      createdByName: nameById.get(ver.createdBy) ?? "Someone",
    }));
  },
});

// Any editor can restore (release-1-0/version-history-plan.md decisions) —
// restoring can't destroy any existing version row (see below), so it's no
// more dangerous than a normal edit and needs no stricter guard than one.
export const restore = mutation({
  args: { diagramId: v.id("diagrams"), versionId: v.id("diagramVersions") },
  handler: async (ctx, args) => {
    const { user, diagram } = await requireProDiagramEditor(ctx, args.diagramId);

    const version = await ctx.db.get(args.versionId);
    if (!version || version.diagramId !== args.diagramId) {
      throw new ConvexError("Version not found.");
    }

    // Non-destructive: snapshot current state before overwriting it, so
    // restoring is itself always reversible. This never deletes the version
    // being restored to, or anything in between — the only deletion in this
    // whole feature is pruneOldAutoVersions trimming the single oldest auto
    // row past the cap, unrelated to which version was just restored.
    await insertVersion(ctx, diagram, user._id, "auto");
    await pruneOldAutoVersions(ctx, args.diagramId);

    const now = Date.now();
    await ctx.db.patch(args.diagramId, {
      name: version.name,
      tables: version.tables,
      relationships: version.relationships,
      areas: version.areas,
      notes: version.notes,
      camera: version.camera,
      enums: version.enums,
      tableGroups: version.tableGroups,
      project: version.project,
      updatedAt: now,
    });

    return { updatedAt: now };
  },
});
