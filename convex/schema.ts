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

    // AI chat rate limiting (lib/ai-credits.ts). A fixed window per user,
    // stored on the user row so the check rides along inside the same
    // transaction that reserves the credit — no second round trip, and no way
    // for concurrent turns to both pass the check.
    aiTurnWindowStart: v.optional(v.number()),
    aiTurnsInWindow: v.optional(v.number()),

    // Calendar month ("YYYY-MM", UTC) that `credits` belongs to. A key from a
    // past month means the allowance has refilled — see `effectiveCredits` in
    // lib/ai-credits.ts. Unset on existing rows, which reads as "refill on
    // next use", so no migration is needed.
    creditsPeriodKey: v.optional(v.string()),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"]),

  // One row per started AI turn, created by `reserveAiCredit` and consumed by
  // `settleAiCredits`.
  //
  // This is a trust boundary, not bookkeeping. Both of those are *public*
  // mutations — the Convex URL and function names ship in the browser bundle,
  // so anything reachable from the client is reachable from a console. Before
  // this table, settlement took a client-supplied number straight into the
  // org-wide spend counter, which meant one call from any free account could
  // trip the circuit breaker and disable AI chat for every user.
  //
  // Requiring a reservation makes settlement provable: it can only follow a
  // turn that actually passed the Pro gate and the rate limit, it can only
  // happen once, and it can never charge more than one turn's cap.
  aiChatReservations: defineTable({
    userId: v.id("users"),
    /** Credits already taken up front, to be deducted from the final charge. */
    credits: v.number(),
    createdAt: v.number(),
    consumedAt: v.optional(v.number()),
  }).index("by_user_and_created", ["userId", "createdAt"]),

  // Org-wide AI spend per calendar month, one row per period. Backs the
  // circuit breaker in convex/aiSpend.ts: per-user allowances cap ordinary
  // usage, this catches the case where metering itself is broken.
  aiChatSpend: defineTable({
    periodKey: v.string(), // "YYYY-MM", UTC
    credits: v.number(),
    updatedAt: v.number(),
  }).index("by_period", ["periodKey"]),

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

    // 5) Documentation schema metadata (authored via the DBML code editor)
    enums: v.optional(
      v.array(
        v.object({
          id: v.string(),
          name: v.string(),
          note: v.optional(v.string()),
          values: v.array(
            v.object({
              name: v.string(),
              note: v.optional(v.string()),
            })
          ),
        })
      )
    ),
    tableGroups: v.optional(
      v.array(
        v.object({
          id: v.string(),
          name: v.string(),
          tableNames: v.array(v.string()),
        })
      )
    ),
    project: v.optional(
      v.object({
        name: v.optional(v.string()),
        databaseType: v.optional(v.string()),
        note: v.optional(v.string()),
      })
    ),

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

  diagramInvites: defineTable({
    diagramId: v.id("diagrams"),
    token: v.string(),
    invitedEmail: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("editor"),
      v.literal("viewer")
    ),
    createdBy: v.id("users"),
    createdAt: v.number(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_diagram", ["diagramId"]),

  diagramVersions: defineTable({
    diagramId: v.id("diagrams"),
    createdAt: v.number(),
    createdBy: v.id("users"),
    kind: v.union(v.literal("promotion"), v.literal("auto"), v.literal("manual")),
    label: v.optional(v.string()), // only set for kind: "manual"

    // Full snapshot — mirrors diagrams' own content fields.
    name: v.string(),
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
    relationships: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        sourceTableId: v.string(),
        sourceColumnId: v.string(),
        targetTableId: v.string(),
        targetColumnId: v.string(),
        cardinality: v.string(),
        onUpdate: v.string(),
        onDelete: v.string(),
      })
    ),
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
    enums: v.optional(
      v.array(
        v.object({
          id: v.string(),
          name: v.string(),
          note: v.optional(v.string()),
          values: v.array(
            v.object({
              name: v.string(),
              note: v.optional(v.string()),
            })
          ),
        })
      )
    ),
    tableGroups: v.optional(
      v.array(
        v.object({
          id: v.string(),
          name: v.string(),
          tableNames: v.array(v.string()),
        })
      )
    ),
    project: v.optional(
      v.object({
        name: v.optional(v.string()),
        databaseType: v.optional(v.string()),
        note: v.optional(v.string()),
      })
    ),
  })
    .index("by_diagram", ["diagramId"])
    .index("by_diagram_and_created", ["diagramId", "createdAt"]),

  diagramPresence: defineTable({
    diagramId: v.id("diagrams"),
    userId: v.id("users"),
    lastSeenAt: v.number(),
  })
    .index("by_diagram", ["diagramId"])
    .index("by_diagram_and_user", ["diagramId", "userId"]),

  // AI chat history sync (ai-chat-credits-and-sync-plan.md, Phase 2). One row
  // per message, not one row per diagram with an embedded array like
  // `diagrams` — messages are append-only, so there's no last-write-wins
  // conflict to design around the way diagram edits need.
  aiChatMessages: defineTable({
    diagramId: v.id("diagrams"),
    messageId: v.string(), // matches the client's UIMessage.id — idempotency key
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    parts: v.any(), // UIMessagePart[] — polymorphic (text/tool-call/tool-result/...),
                     // not worth encoding exactly; mirrors plans.features' v.any() precedent
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_diagram", ["diagramId"])
    .index("by_diagram_and_created", ["diagramId", "createdAt"]),

  userPreferences: defineTable({
    userId: v.id("users"),
    theme: v.optional(v.string()),
    defaultView: v.optional(v.string()),
    snapToGrid: v.optional(v.boolean()),
    showGrid: v.optional(v.boolean()),
  }).index("by_user", ["userId"]),

  plans: defineTable({
    name: v.string(), // 'FREE' | 'PRO'
    slug: v.string(), // Clerk Billing plan slug (e.g. "free" / "pro") — links this row to the Clerk-side Plan
    features: v.optional(v.any()),
    createdAt: v.number(),
  }).index("by_slug", ["slug"]),
});
