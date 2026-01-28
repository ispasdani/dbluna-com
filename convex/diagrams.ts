import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";

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
                // We can add notes/areas later if needed for templates
            })
        ),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new ConvexError("Unauthorized");

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) throw new ConvexError("User not found");

        const diagramId = await ctx.db.insert("diagrams", {
            ownerId: user._id,
            name: args.name,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            publicId: generatePublicId(),
            tables: args.initialData?.tables ?? [],
            relationships: args.initialData?.relationships ?? [],
            areas: [],
            notes: [],
            camera: { x: 0, y: 0, zoom: 1 },
            isDeleted: false,
        });

        // Add to members
        await ctx.db.insert("diagramMembers", {
            diagramId,
            userId: user._id,
            role: "owner",
            invitedAt: Date.now(),
            acceptedAt: Date.now(),
            updatedAt: Date.now(),
        });

        return diagramId;
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
        name: v.optional(v.string()),
    },
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
            .withIndex("by_diagram_and_user", (q) =>
                q.eq("diagramId", args.diagramId).eq("userId", user._id)
            )
            .unique();

        if (!member || member.role === "viewer") throw new ConvexError("No write access");

        // Construct patch
        const patch: any = { updatedAt: Date.now() };
        if (args.name) patch.name = args.name;
        if (args.tables) patch.tables = args.tables;
        if (args.relationships) patch.relationships = args.relationships;
        if (args.areas) patch.areas = args.areas;
        if (args.notes) patch.notes = args.notes;
        if (args.camera) patch.camera = args.camera;

        await ctx.db.patch(args.diagramId, patch);
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

        await ctx.db.patch(args.diagramId, { isDeleted: true });
    },
});
