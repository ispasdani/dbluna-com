# Decisions

The decisions that shaped DBLuna, collected from the plans in [`archive/`](archive/README.md). Each one says what was decided, why, and where the detail is. Where a plan and this file disagree, this file wins; where this file and the code disagree, the code wins.

## 1. Local-first, cloud as an opt-in upgrade

Every diagram lives in the browser's IndexedDB, keyed by a client-made id in `/d/[id]`. The cloud is a per-diagram opt-in ("Save to cloud"), and the local copy is always kept, never replaced.

**Why:** the product had to work with no account and no server, like drawDB, and a Convex outage should never block editing. Cloud sync then becomes something people pay for, not something they depend on.

Detail: `archive/desktop-and-local-first/local_first_sharing_plan.md`, `archive/release-1-0/hardening-local-first-persistance.md`.

## 2. Share links carry the diagram in the URL fragment

`/d/view#<lz-string data>`. The fragment never reaches a server, so sharing needs no account, no storage and no cleanup. Above 32 KB compressed the Share dialog refuses rather than produce a link that breaks in some browsers or chat apps. The viewer loads the diagram into the real canvas under a throwaway id with every edit path blocked in the store, instead of a separate read-only renderer, because the canvas is too tied to its store to drive from props.

Detail: `archive/release-1-0/share-via-url-plan.md`.

## 3. Pay to build: Free edits in code only, Pro gets everything

First decided on 21 Jul 2026 as "Free can only view". On 26 Aug it was relaxed: Free users can edit in the Code tab, up to 5 diagrams of 10 tables, with the canvas view-only. Pro gets the canvas, import, export, cloud sync, collaboration, versions and the AI assistant. Enterprise is copy only.

The limits live in `lib/plan-limits.ts` and are enforced in the browser. That is not a security boundary, and it was accepted as one: Free diagrams never reach the server, so there is nothing to protect there. Anything that does reach Convex checks Pro on the server.

Detail: `archive/release-1-0/paid-editing-access-plan.md`, `archive/plans/free-tier-code-only-editing-plan.md`.

## 4. Billing through Clerk Billing; one rule for "is Pro"

Clerk handles sign-in and subscriptions; its webhook (`convex/http.ts`, verified with `svix`) writes the plan and period onto the `users` row. "Has paid access" is one function, `hasActivePaidAccess` in `lib/subscription-rules.ts`, used by both the webhook and the guards. It was written after an audit of the live handler found two bugs: cancelling removed Pro at once instead of at period end, and an old Free item's late "ended" event downgraded someone who had just upgraded. Each rule has a test, since these cases can't be produced on demand against Clerk.

A 3-day grace past the recorded period end covers a renewal whose webhook is late; a failed payment still cuts access at once.

## 5. Every server check happens in Convex

Guards in `convex/guards.ts` run at the top of every function that touches a diagram. Membership is the owner on the `diagrams` row or a row in `diagramMembers`. `proxy.ts` only redirects signed-out visitors and is never the thing protecting data.

## 6. Collaboration: cloud diagrams only, Pro only, last write refused

Invites are by email with a 7-day token, at most 5 members, editor or viewer. A save carries the `updatedAt` it started from; if someone else saved since, Convex refuses it with `CONFLICT` and the editor shows a banner, rather than merging. Other people's saves show up live through a Convex subscription. Merging edits was deferred as polish until conflicts proved common.

Detail: `archive/release-1-0/collaboration-plan.md`, `archive/plans/member-management-plan.md` (the roster and role changes that were never built).

## 7. Version history: snapshots, not diffs

Each version is a full copy of the diagram (`diagramVersions`). Automatic snapshots come at most every 30 minutes and only the newest 20 are kept; manual versions are kept for good. Restoring writes the old version as a new state, so nothing is lost. No per-version diff in v1.

Detail: `archive/release-1-0/version-history-plan.md`.

## 8. AI assistant: the budget sets the allowance

A Pro subscriber must never cost more than $1.35 a month in model spend (about 14% of the $9.40 net from $10). The monthly allowance is worked out from that figure and the model's price, not picked first. The model id is pinned (`gemini-3.1-flash-lite`), never a `-latest` alias, after an alias silently moved to a tier with 6 times the output price.

Credits are reserved in Convex before a turn and settled after, against a reservation that can be used once. This exists because both mutations are public: before it, any account could send a made-up spend figure and trip the global breaker for everyone. The global monthly ceiling (`AI_CHAT_GLOBAL_MONTHLY_CREDIT_CEILING`) turns AI off for everyone if metering itself is broken.

Detail: `lib/ai-credits.ts` (the comments are the reference), `archive/plans/ai-chat-implementation-plan.md`, `archive/plans/ai-chat-credits-and-sync-plan.md`.

## 9. One DBML pipeline

Canvas, code editor and docs all go through the same parser (`lib/parser/dsl-parser.ts`) and generator (`lib/generator/dbml-generator.ts`). The docs used to have their own Monaco editor and parser; that second copy was removed. Enums, TableGroups and notes became part of the canvas model so nothing is lost in a round trip.

Detail: `archive/release-1-0/dbml-docs-integration-plan.md`.

## 10. BACPAC docs without an LLM or the data

BACPAC import reads only `model.xml` (the schema), never the table data in the archive. Extraction, search, diagrams and the docs export are deterministic code. SQL Server specifics (indexes, views, procedures, functions, defaults, computed columns, descriptions) are kept on the diagram so docs and the canvas come from the same saved diagram.

Detail: `archive/release-1-0/bacpac-schema-documentation-plan.md`.

## 11. Large schemas: hide by group, show stubs

Driven by a real 428-table SQL Server schema. Visibility is per group, where a group is a schema, a DBML TableGroup or a foreign-key cluster. A link to a hidden table shows as a dashed stub with a label, not a ghost card at the edge of the view, because stubs are cheap to draw.

Detail: `archive/release-1-0/schemas-tab-and-visibility-plan.md`.

## 12. The desktop app was set aside

An Electron app for importing and browsing SQL Server databases (SSMS-like) was planned in five phases in March 2026. Only an experiment was built, and the web app went ahead without it.

Detail: `archive/desktop-and-local-first/`.
