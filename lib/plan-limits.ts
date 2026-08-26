// Single source of truth for the Free-plan numeric caps. Consumed by:
//   - the client-side enforcement points (code-editor table-count guard,
//     "create new diagram" guards) via the capabilities object built in
//     app/(diagram)/d/[id]/page.tsx
//   - convex/plans.ts's seeded Free-plan `features` metadata, so the stored
//     plan row can't drift away from what's actually enforced
//   - constants/pricing.tsx marketing copy
//
// Free diagrams never reach Convex, so there is no server-side enforcement of
// these yet — see free-tier-code-only-editing-plan.md "Non-goals".
export const FREE_MAX_TABLES_PER_DIAGRAM = 10;
export const FREE_MAX_DIAGRAMS = 5;
