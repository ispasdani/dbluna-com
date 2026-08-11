import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";
import { requireSignedInPro, requireProDiagramEditor } from "./guards";

const generatePublicId = () => Math.random().toString(36).substring(2, 10);

export const create = mutation({
    args: {
        name: v.string(),
        description: v.optional(v.string()), // Not in schema but useful to accept (will just ignore if not in schema)
        // Optional initial state (e.g. from a template)
        tables: v.optional(v.array(v.any())), // We use v.any() for strictly passed inputs to avoid massive arg validation duplication, but we assume they match Schema.schema.diagrams.tables
        // Actually, let's use the strict types for args to be safe? 
        // It's very verbose to repeat the entire strict object structure in args. 
        // standard practice: use strict args or accept a big object. 
        // For now I'll use strict args to match the schema I defined!

        // We'll accept partial initial state
        initialData: v.optional(
            v.object({
                tables: v.array(v.object({
                    id: v.string(),
                    name: v.string(),
                    x: v.number(),
                    y: v.number(),
                    color: v.string(),
                    isLocked: v.optional(v.boolean()),
                    comment: v.optional(v.string()),
                    columns: v.array(
                        v.object({
                            id: v.string(),
                            name: v.string(),
                            type: v.string(),
                            isPrimaryKey: v.boolean(),
                            isNotNull: v.boolean(),
                            isUnique: v.boolean(),
                            isAutoIncrement: v.boolean(),
                        })
                    ),
                })),
                relationships: v.array(v.object({
                    id: v.string(),
                    name: v.string(),
                    sourceTableId: v.string(),
                    sourceColumnId: v.string(),
                    targetTableId: v.string(),
                    targetColumnId: v.string(),
                    cardinality: v.string(),
                    onUpdate: v.string(),
                    onDelete: v.string(),
                })),
                areas: v.optional(v.array(v.object({
                    id: v.string(),
                    x: v.number(),
                    y: v.number(),
                    width: v.number(),
                    height: v.number(),
                    title: v.string(),
                    color: v.string(),
                    isLocked: v.boolean(),
                    zIndex: v.number(),
                }))),
                notes: v.optional(v.array(v.object({
                    id: v.string(),
                    x: v.number(),
                    y: v.number(),
                    width: v.number(),
                    height: v.number(),
                    title: v.string(),
                    content: v.string(),
                    color: v.string(),
                    isLocked: v.boolean(),
                }))),
                enums: v.optional(v.array(v.object({
                    id: v.string(),
                    name: v.string(),
                    note: v.optional(v.string()),
                    values: v.array(v.object({
                        name: v.string(),
                        note: v.optional(v.string()),
                    })),
                }))),
                tableGroups: v.optional(v.array(v.object({
                    id: v.string(),
                    name: v.string(),
                    tableNames: v.array(v.string()),
                }))),
                project: v.optional(v.object({
                    name: v.optional(v.string()),
                    databaseType: v.optional(v.string()),
                    note: v.optional(v.string()),
                })),
                camera: v.optional(v.object({
                    x: v.number(),
                    y: v.number(),
                    zoom: v.number(),
                })),
            })
        ),
    },
    handler: async (ctx, args) => {
        const { user } = await requireSignedInPro(ctx);
        const now = Date.now();

        const diagramId = await ctx.db.insert("diagrams", {
            ownerId: user._id,
            name: args.name,
            createdAt: now,
            updatedAt: now,
            publicId: generatePublicId(),
            tables: args.initialData?.tables ?? [],
            relationships: args.initialData?.relationships ?? [],
            areas: args.initialData?.areas ?? [],
            notes: args.initialData?.notes ?? [],
            enums: args.initialData?.enums ?? [],
            tableGroups: args.initialData?.tableGroups ?? [],
            project: args.initialData?.project,
            camera: args.initialData?.camera ?? { x: 0, y: 0, zoom: 1 },
            isDeleted: false,
        });

        // Add to members
        await ctx.db.insert("diagramMembers", {
            diagramId,
            userId: user._id,
            role: "owner",
            invitedAt: now,
            acceptedAt: now,
            updatedAt: now,
        });

        return { diagramId, updatedAt: now };
    },
});

export const get = query({
    args: { diagramId: v.id("diagrams") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return null; // Or throw

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) return null;

        // Check membership
        const member = await ctx.db
            .query("diagramMembers")
            .withIndex("by_diagram_and_user", (q) =>
                q.eq("diagramId", args.diagramId).eq("userId", user._id)
            )
            .unique();

        if (!member) throw new ConvexError("No access to this diagram");

        return await ctx.db.get(args.diagramId);
    },
});

// Non-throwing membership lookup for UI copy only (release-1-0/collaboration-plan.md
// Phase A §5) — lets the read-only upgrade prompt say "you were invited" for a
// collaborator instead of the owner-framed default, without gating anything.
export const getMyRole = query({
    args: { diagramId: v.id("diagrams") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return null;

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();
        if (!user) return null;

        const diagram = await ctx.db.get(args.diagramId);
        if (!diagram) return null;
        if (diagram.ownerId === user._id) return "owner" as const;

        const member = await ctx.db
            .query("diagramMembers")
            .withIndex("by_diagram_and_user", (q) =>
                q.eq("diagramId", args.diagramId).eq("userId", user._id)
            )
            .unique();

        return member?.role ?? null;
    },
});

export const list = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return [];

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) return [];

        const memberships = await ctx.db
            .query("diagramMembers")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .collect();

        const diagrams = await Promise.all(
            memberships.map((m) => ctx.db.get(m.diagramId))
        );

        // Filter out nulls or deleted
        return diagrams.filter((d) => d && !d.isDeleted);
    },
});

// Full update of the canvas state
export const update = mutation({
    args: {
        diagramId: v.id("diagrams"),
        // We accept partial updates or full updates. For now assuming full state dump for simplicity of schema compliance
        // But ideally we separate "metadata update" from "canvas update"
        // Let's support canvas update fields:
        tables: v.optional(v.array(v.object({
            id: v.string(),
            name: v.string(),
            x: v.number(),
            y: v.number(),
            color: v.string(),
            isLocked: v.optional(v.boolean()),
            comment: v.optional(v.string()),
            columns: v.array(
                v.object({
                    id: v.string(),
                    name: v.string(),
                    type: v.string(),
                    isPrimaryKey: v.boolean(),
                    isNotNull: v.boolean(),
                    isUnique: v.boolean(),
                    isAutoIncrement: v.boolean(),
                })
            ),
        }))),
        relationships: v.optional(v.array(v.object({
            id: v.string(),
            name: v.string(),
            sourceTableId: v.string(),
            sourceColumnId: v.string(),
            targetTableId: v.string(),
            targetColumnId: v.string(),
            cardinality: v.string(),
            onUpdate: v.string(),
            onDelete: v.string(),
        }))),
        areas: v.optional(v.array(v.object({
            id: v.string(),
            x: v.number(),
            y: v.number(),
            width: v.number(),
            height: v.number(),
            title: v.string(),
            color: v.string(),
            isLocked: v.boolean(),
            zIndex: v.number(),
        }))),
        notes: v.optional(v.array(v.object({
            id: v.string(),
            x: v.number(),
            y: v.number(),
            width: v.number(),
            height: v.number(),
            title: v.string(),
            content: v.string(),
            color: v.string(),
            isLocked: v.boolean(),
        }))),
        camera: v.optional(v.object({
            x: v.number(),
            y: v.number(),
            zoom: v.number(),
        })),
        enums: v.optional(v.array(v.object({
            id: v.string(),
            name: v.string(),
            note: v.optional(v.string()),
            values: v.array(v.object({
                name: v.string(),
                note: v.optional(v.string()),
            })),
        }))),
        tableGroups: v.optional(v.array(v.object({
            id: v.string(),
            name: v.string(),
            tableNames: v.array(v.string()),
        }))),
        project: v.optional(v.object({
            name: v.optional(v.string()),
            databaseType: v.optional(v.string()),
            note: v.optional(v.string()),
        })),
        name: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await requireProDiagramEditor(ctx, args.diagramId);

        // Construct patch
        const patch: any = { updatedAt: Date.now() };
        if (args.name) patch.name = args.name;
        if (args.tables) patch.tables = args.tables;
        if (args.relationships) patch.relationships = args.relationships;
        if (args.areas) patch.areas = args.areas;
        if (args.notes) patch.notes = args.notes;
        if (args.camera) patch.camera = args.camera;
        if (args.enums) patch.enums = args.enums;
        if (args.tableGroups) patch.tableGroups = args.tableGroups;
        if (args.project) patch.project = args.project;

        await ctx.db.patch(args.diagramId, patch);
        return { updatedAt: patch.updatedAt as number };
    },
});

export const deleteDiagram = mutation({
    args: { diagramId: v.id("diagrams") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new ConvexError("Unauthorized");

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) throw new ConvexError("User not found");

        const member = await ctx.db
            .query("diagramMembers")
            .withIndex("by_diagram_and_user", (q) => q.eq("diagramId", args.diagramId).eq("userId", user._id))
            .unique();

        if (!member || member.role !== "owner") throw new ConvexError("Only owner can delete");

        // Shared by "delete for real" (My Diagrams) and "make local-only"
        // (useCloudSync) — both sever this Convex row, so both must be
        // blocked while other members exist, or a collaborator's access gets
        // silently cut off with no warning to anyone (release-1-0/collaboration-plan.md
        // Phase A §6).
        const allMembers = await ctx.db
            .query("diagramMembers")
            .withIndex("by_diagram", (q) => q.eq("diagramId", args.diagramId))
            .collect();
        if (allMembers.length > 1) {
            throw new ConvexError(
                "Remove all collaborators before deleting or disconnecting this diagram from the cloud."
            );
        }

        await ctx.db.patch(args.diagramId, { isDeleted: true });
    },
});
