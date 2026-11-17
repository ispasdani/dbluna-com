# Convex schema

Defined in `convex/schema.ts`, which is the source of truth; this is a map of it. 11 tables, as of 16 Nov 2026.

| Table | One row per | Indexes |
|---|---|---|
| `users` | Clerk user | `by_clerk_id`, `by_email` |
| `plans` | Billing plan (`free`, `pro`) | `by_slug` |
| `diagrams` | Cloud-synced diagram | `by_owner`, `by_publicId` |
| `diagramMembers` | Person with access to a diagram | `by_diagram`, `by_user`, `by_diagram_and_user` |
| `diagramInvites` | Pending or used email invite | `by_token`, `by_diagram` |
| `diagramPresence` | Person currently viewing a diagram | `by_diagram`, `by_diagram_and_user` |
| `diagramVersions` | Saved version of a diagram | `by_diagram`, `by_diagram_and_created` |
| `aiChatMessages` | Chat message on a cloud diagram | `by_diagram`, `by_diagram_and_created` |
| `aiChatReservations` | Started AI turn | `by_user_and_created` |
| `aiChatSpend` | Calendar month of org-wide AI spend | `by_period` |
| `userPreferences` | User's editor settings | `by_user` |

Local diagrams don't appear here at all: they exist only in the browser's IndexedDB until someone saves them to the cloud.

## `users`

Written by the Clerk webhook (`createUser`, `updateUser`, `applySubscriptionEvent`, `deleteUser`) and by the AI credit mutations.

| Field | Notes |
|---|---|
| `clerkId`, `email`, `firstName`, `lastName?`, `imageUrl?` | From Clerk. `firstName` falls back to "User". |
| `createdAt`, `updatedAt?` | |
| `planId?` | → `plans`. New users get the `free` plan if it's seeded; unset reads as Free. |
| `subscriptionId?`, `subscriptionStatus?`, `currentPeriodStart?`, `currentPeriodEnd?`, `cancelAtPeriodEnd?` | From Clerk Billing events. Read only through `hasActivePaidAccess`. |
| `credits?`, `creditsPeriodKey?` | This month's AI allowance and the `"YYYY-MM"` it belongs to. A past month means it has refilled. |
| `aiTurnWindowStart?`, `aiTurnsInWindow?` | AI rate limit, a fixed one-minute window. Kept on the user row so the check is in the same transaction as the reservation. |

## `plans`

`name` (`FREE` / `PRO`), `slug` (must match the Clerk Billing plan slug), `features?` (metadata, kept in line with `lib/plan-limits.ts` by `plans:seed`), `createdAt`.

## `diagrams`

| Field | Notes |
|---|---|
| `ownerId`, `name`, `createdAt`, `updatedAt` | `updatedAt` is also the conflict check: `update` needs the caller's `expectedUpdatedAt` to match. |
| `publicId?` | Indexed; not used by share links, which never touch Convex. |
| `tables[]` | `id, name, x, y, color, isLocked?, comment?, description?, primaryKey?, sqlServerIndexes?, columns[]`. A column is `id, name, type, isPrimaryKey, isNotNull, isUnique, isAutoIncrement, defaultExpression?, computedExpression?, description?`. |
| `relationships[]` | `sourceTableId/ColumnId`, `targetTableId/ColumnId`, optional multi-column `sourceColumnIds`/`targetColumnIds`, `cardinality`, `onUpdate`, `onDelete`. |
| `areas[]`, `notes[]` | Position, size, title, colour, lock; areas have `zIndex`, notes have `content`. |
| `camera` | `x, y, zoom`. |
| `enums?`, `tableGroups?` | From DBML. |
| `project?` | `name?`, `databaseType?`, `note?`, and from BACPAC import `sqlServerViews?` and `sqlServerObjects?` (types, procedures, functions, triggers, sequences, synonyms), each with `definition?`, `description?` and `dependencies[]`. |
| `isDeleted?` | Soft delete. |

## `diagramMembers`

`diagramId`, `userId`, `role` (`owner` / `admin` / `editor` / `viewer`), `invitedAt`, `acceptedAt?`, `updatedAt?`. The owner is also recognised from `diagrams.ownerId`. `admin` can't be granted from the UI.

## `diagramInvites`

`diagramId`, `token`, `invitedEmail`, `role` (`admin` / `editor` / `viewer`), `createdBy`, `createdAt`, `expiresAt` (7 days), `usedAt?`. No `userId`: the invitee may not have an account yet.

## `diagramPresence`

`diagramId`, `userId`, `lastSeenAt`. Refreshed by `heartbeat`; rows are removed by a cron every 10 minutes once stale.

## `diagramVersions`

`diagramId`, `createdAt`, `createdBy`, `kind` (`promotion` when first saved to the cloud, `auto`, `manual`), `label?` (manual only), then a full copy of the diagram's content fields (same shapes as `diagrams`). Only the newest 20 `auto` versions are kept.

## `aiChatMessages`

`diagramId`, `messageId` (the client's message id, used to ignore duplicates), `role`, `parts` (`v.any()`: AI SDK message parts), `createdBy`, `createdAt`. One row per message because messages are only ever appended.

## `aiChatReservations`

`userId`, `credits` (taken up front), `createdAt`, `consumedAt?`. Settlement must consume one unused reservation, so a client can't report spend for a turn that never passed the Pro gate and rate limit, or report it twice.

## `aiChatSpend`

`periodKey` (`"YYYY-MM"`, UTC), `credits`, `updatedAt`. Checked against the global monthly ceiling before every turn.

## `userPreferences`

`userId`, `theme?`, `defaultView?`, `snapToGrid?`, `showGrid?`. Unused: no function reads or writes it. The editor keeps these settings in local stores.
