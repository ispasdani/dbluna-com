# Convex functions and guards

Every public function, the check it runs first, and what it does. As of 16 Nov 2026. "Internal" functions can only be called from other Convex functions, the CLI (`npx convex run`) or the dashboard.

## Guards (`convex/guards.ts`)

| Guard | Passes when |
|---|---|
| `requireSignedIn` | There's a Clerk identity with a `users` row. Throws `ERR_AUTH_REQUIRED` otherwise. |
| `requireSignedInPro` | Signed in and `isPro`. |
| `isPro` / `requirePro` | `hasActivePaidAccess` (`lib/subscription-rules.ts`): a paid plan slug (`pro`, `enterprise`), an active status, and a period end not more than 3 days past. |
| `requireDiagramRole(ctx, id, roles)` | The caller is the diagram's owner (`diagrams.ownerId`) or has a `diagramMembers` row with one of `roles`. |
| `requireDiagramViewer` / `Editor` / `OwnerOrAdmin` | `requireDiagramRole` with any role / owner, admin or editor / owner or admin. |
| `requireProDiagramViewer` / `Editor` | The same, plus the caller is Pro. |

## Diagrams (`convex/diagrams.ts`)

| Function | Type | Check | What |
|---|---|---|---|
| `create` | mutation | `requireSignedInPro` | Saves a local diagram to the cloud and records a `promotion` version. |
| `get` | query | Owner or member | The diagram, or `null` (not an error) when the caller has no access, so the page can show its own message. |
| `getMyRole` | query | None (signed-in) | The caller's role or `null`. For wording in the UI only; gates nothing. |
| `list` | query | Signed in | The caller's diagrams. |
| `update` | mutation | `requireProDiagramEditor` | Replaces the diagram's content. Refuses with `CONFLICT` if `expectedUpdatedAt` is stale. May take an `auto` version. |
| `deleteDiagram` | mutation | Owner | Soft delete. |

## Collaboration

| Function | Type | Check | What |
|---|---|---|---|
| `diagramInvites.create` | mutation | Owner or admin, Pro | Invites an email as editor or viewer; 7-day token; at most 5 members. |
| `diagramInvites.revoke` | mutation | Owner or admin | Removes a pending invite. |
| `diagramInvites.listForDiagram` | query | Owner or admin | Pending invites (used ones drop out). |
| `diagramInvites.accept` | mutation | Signed in | Turns a valid token into a `diagramMembers` row. |
| `diagramPresence.heartbeat` | mutation | Viewer | Marks the caller as present. |
| `diagramPresence.listActive` | query | Viewer | Who's here, with name, email and `isSelf`. |
| `diagramPresence.cleanupStale` | internal | | Cron, every 10 minutes. |

## Versions (`convex/diagramVersions.ts`)

| Function | Type | Check | What |
|---|---|---|---|
| `list` | query | `requireProDiagramViewer` | The diagram's versions, newest first. |
| `restore` | mutation | `requireProDiagramEditor` | Writes a version back as the current state. Every existing version is kept. |

`insertVersion`, `maybeAutoSnapshot` and `pruneOldAutoVersions` are helpers called by `diagrams.create` and `update`.

## Users and AI credits (`convex/users.ts`)

| Function | Type | Check | What |
|---|---|---|---|
| `getMe` | query | Signed in | The caller's `users` row. |
| `getCurrentUserPlan` | query | Signed in | The caller's plan and whether they're Pro. |
| `reserveAiCredit` | mutation | `requireSignedInPro` | Before a turn: rate limit, global ceiling, refills the month if needed, takes credits up front and creates a reservation. Errors: `OUT_OF_CREDITS`, `REQUEST_TOO_LARGE_FOR_BALANCE`, `RATE_LIMITED`, `CAPACITY_REACHED`. |
| `settleAiCredits` | mutation | Signed in (deliberately not Pro, so a turn that started before a lapse still settles) | Consumes the reservation and charges the real cost, capped at one turn. |
| `getByClerkIdInternal` | internal | | |
| `createUser`, `updateUser`, `applySubscriptionEvent`, `deleteUser` | internal | | Called by the Clerk webhook. |

## AI chat history (`convex/aiChatMessages.ts`)

| Function | Type | Check | What |
|---|---|---|---|
| `list` | query | `requireProDiagramViewer` | Messages for a cloud diagram. |
| `append` | mutation | `requireProDiagramEditor` | Adds messages; duplicates by `messageId` are ignored. |

`convex/aiSpend.ts` holds helpers (`assertGlobalCapacity`, `recordSpend`), not functions.

## Plans, setup and test tools

| Function | Type | What |
|---|---|---|
| `plans.seed` | internal | Creates the `free` and `pro` rows. Run once per deployment. |
| `plans.getBySlug`, `plans.getByIdInternal` | internal | |
| `migrations.grandfatherExistingUsersToPro` | internal | Moves every existing user to Pro; was used when the editing gate went live. |
| `devBilling.setSubscription` | internal | Sets a subscription preset on a user by email: for testing Pro, lapsed, grace and failed payment states without Clerk. Dev deployments only. |
| `devBilling.setCredits`, `showUser`, `showSpend` | internal | Set a user's credits; show a user or the month's spend. |

## HTTP (`convex/http.ts`)

`POST /clerk`: the Clerk webhook, verified with `svix` and `CLERK_WEBHOOK_SECRET`. Handles `user.created`, `user.updated`, `user.deleted` and the Billing `subscription.*` / `subscriptionItem.*` events. The decisions about which event wins are in `lib/subscription-rules.ts`.

## Next.js API routes (outside Convex)

| Route | Check | What |
|---|---|---|
| `POST /api/ai-chat` | Clerk `auth()`, then `reserveAiCredit` | Streams the Gemini reply with the diagram tools, then settles credits. |
| `POST /api/import-bacpac` | Clerk `auth()` | Parses an uploaded BACPAC. |
| `POST /api/import-schema` | Clerk `auth()`, then Pro via `getCurrentUserPlan` (while `EDITING_GATE_ENABLED`); in production, `resolvePublicHost` | Connects to a PostgreSQL or SQL Server host and reads its schema. In production only public addresses, pinned to the checked IP. |
