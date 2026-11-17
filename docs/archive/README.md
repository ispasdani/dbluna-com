# Archive

Plans and notes written while DBLuna was being built, moved here on 17 Nov 2026. Kept unchanged as a record. For the current picture read [../final-state.md](../final-state.md) and [../decisions.md](../decisions.md).

Relative links inside these files point to where they used to be (the repo root, `release-1-0/`, `artifacts/`), so some are broken.

## release-1-0/ (Jul–Nov 2026): the web app's feature plans

Most have an "As built" or status section; trust that over the plan above it.

| File | Outcome |
|---|---|
| hardening-local-first-persistance.md | Shipped. |
| share-via-url-plan.md | Shipped. |
| paid-editing-access-plan.md | Shipped; later relaxed by `plans/free-tier-code-only-editing-plan.md`. |
| phase1-plan-from-editing-access-plan.md | Shipped (Clerk Billing plan assignment). |
| dbml-docs-integration-plan.md | Shipped. |
| collaboration-plan.md | Built, not verified by hand. |
| version-history-plan.md | Built, not verified by hand. |
| schema-tab-plan.md | Superseded by the Schemas tab plan. |
| schemas-tab-and-visibility-plan.md | Shipped; manual checks and the performance measurement still open. |
| bacpac-schema-documentation-plan.md | Shipped; signed-in end-to-end check still open. |

## plans/ (Aug 2026): plans that lived at the repo root

| File | Outcome |
|---|---|
| ai-chat-implementation-plan.md | Shipped. |
| ai-chat-credits-and-sync-plan.md | Shipped, then reworked in Sept 2026; `lib/ai-credits.ts` is the reference. |
| free-tier-code-only-editing-plan.md | Shipped. |
| member-management-plan.md | Navbar identity shipped; member management not built. |

## status-notes/: snapshots of where things stood

| File | Date | Note |
|---|---|---|
| feedingTime.md | 3 Aug 2026 | Product and technical overview for AI assistants. Its "known gaps" are out of date. |
| chatControl.md | 30 Jul 2026 | Session report on the local-first, sharing and editing gate work. |
| things left to do.md | 11 Aug 2026 | Gap list; replaced by `final-state.md`. |
| roadmap-next-steps.md | Jul 2026 | Early roadmap; most of it was built or dropped. |

## desktop-and-local-first/ (Mar–Jul 2026)

Plans for an Electron "Database Import Workstation" growing into an SSMS-like tool (phases 2 to 5, a local SQL Server setup guide and `implementation_plan.md.resolved`), never built beyond an experiment; a DBML docs phase 2 plan; and `local_first_sharing_plan.md`, the 4-phase local-first roadmap the web app did follow.

## drawdb-research/ (Jan 2026)

Notes on how drawDB renders, styles and edits tables, used as the reference for DBLuna's canvas and Tables tab.
