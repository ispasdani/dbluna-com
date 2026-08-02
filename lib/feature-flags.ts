// Off by default. Flip to true once Clerk Billing Plans (slugs "free"/"pro")
// exist, `npx convex run plans:seed` has been run, and
// `npx convex run migrations:grandfatherExistingUsersToPro` has been run —
// in that order. Flipping this before all three are done would make every
// existing user read-only, since isPro() would resolve to false for
// everyone. See release-1-0/paid-editing-access-plan.md §2-3.
export const EDITING_GATE_ENABLED = true;
