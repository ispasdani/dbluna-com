import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    imageUrl: v.optional(v.string()),
    clerkId: v.string(),
    firstName: v.string(),
    lastName: v.optional(v.string()),
    credits: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),

    // Subscription fields
    subscriptionId: v.optional(v.string()),
    subscriptionStatus: v.optional(v.string()),
    currentPeriodStart: v.optional(v.string()),
    currentPeriodEnd: v.optional(v.string()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    planId: v.optional(v.id("plans")),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"]),

  // 🔹 Diagrams (real app only: created by logged-in users)
  // 🔹 Diagrams (real app only: created by logged-in users)
  diagrams: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),

    publicId: v.optional(v.string()),

    // 1) Tables & Columns
    tables: v.array(
      v.object({
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
      })
    ),

    // 2) Relationships
    relationships: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        sourceTableId: v.string(),
        sourceColumnId: v.string(),
        targetTableId: v.string(),
        targetColumnId: v.string(),
        cardinality: v.string(), // "One to one" | "One to many" | ...
        onUpdate: v.string(),
        onDelete: v.string(),
      })
    ),

    // 3) Areas
    areas: v.array(
      v.object({
        id: v.string(),
        x: v.number(),
        y: v.number(),
        width: v.number(),
        height: v.number(),
        title: v.string(),
        color: v.string(),
        isLocked: v.boolean(),
        zIndex: v.number(),
      })
    ),

    // 4) Notes
    notes: v.array(
      v.object({
        id: v.string(),
        x: v.number(),
        y: v.number(),
        width: v.number(),
        height: v.number(),
        title: v.string(),
        content: v.string(),
        color: v.string(),
        isLocked: v.boolean(),
      })
    ),

    camera: v.object({
      x: v.number(),
      y: v.number(),
      zoom: v.number(),
    }),

    isDeleted: v.optional(v.boolean()),
  })
    .index("by_owner", ["ownerId"])
    .index("by_publicId", ["publicId"]),

  diagramMembers: defineTable({
    diagramId: v.id("diagrams"),
    userId: v.id("users"),
    role: v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("editor"),
      v.literal("viewer")
    ),
    invitedAt: v.number(),
    acceptedAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_diagram", ["diagramId"])
    .index("by_user", ["userId"])
    .index("by_diagram_and_user", ["diagramId", "userId"]),

  userPreferences: defineTable({
    userId: v.id("users"),
    theme: v.optional(v.string()),
    defaultView: v.optional(v.string()),
    snapToGrid: v.optional(v.boolean()),
    showGrid: v.optional(v.boolean()),
  }).index("by_user", ["userId"]),

  plans: defineTable({
    name: v.string(), // 'FREE' | 'PRO'
    features: v.optional(v.any()),
    createdAt: v.number(),
  }),

  // ✅ Sandbox tracking (public, cookie-based)
  sandboxSessions: defineTable({
    visitorId: v.string(), // from middleware cookie
    createdAt: v.number(),
    lastSeenAt: v.number(),
    userAgent: v.optional(v.string()),
    firstPath: v.optional(v.string()),
  }).index("by_visitorId", ["visitorId"]),

  sandboxEvents: defineTable({
    visitorId: v.string(),
    type: v.string(), // e.g. 'open', 'add_table', 'move_table'
    ts: v.number(),
    meta: v.optional(v.any()),
  }).index("by_visitorId", ["visitorId"]),
});
