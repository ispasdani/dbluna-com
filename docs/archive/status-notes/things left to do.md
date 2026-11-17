# Things Left To Do

Gaps identified between what's advertised/described for DBLuna and what's actually implemented
and verified in code (checked against `feedingTime.md` and the current codebase as of 2026-08-08).

## Not fully connected / need more work

1. **PDF export** — still not built (deferred: needs an SVG-to-PDF library). PNG and SVG export
   now ship (see below), plus a new SQL export (Postgres/MySQL/SQL Server/Oracle) via `@dbml/core`.
2. **Collaboration (multi-user)** — `diagramMembers` table and role guards exist in Convex, but
   there's no invite UI or real-time presence. Backend scaffolding only, not a working feature.
3. **Version history** — ~~advertised, no code at all~~ **built, not yet manually verified.** Full
   implementation shipped: `diagramVersions` table, auto snapshots (30 min gap since the last save of
   any kind, capped to the 20 most recent auto snapshots) plus manual "Save version" checkpoints and
   non-destructive restore, all Pro-gated and cloud-only — same pattern as collaboration (see
   `release-1-0/version-history-plan.md`). History button + dialog are wired into `TopNavbar`. Same
   caveat as item 5's cloud sync: connected in code, **not yet manually clicked through end-to-end by a
   human**. One deliberate v1 gap: no diff summary per version (plain timestamp + author list only).
4. **Mermaid import** — only export works today. There's no importer, despite Mermaid being one
   of the three code-editor modes (DBML/JSON/Mermaid).
5. **Cloud sync** — the code path (save-to-cloud, cross-device pull, server-side Free-user
   rejection) exists and `EDITING_GATE_ENABLED = true` is live, but it has **not yet been
   manually verified end-to-end by a human** — connected in code, unconfirmed in practice.
6. **Production environment** — everything so far has run against the dev Clerk instance and
   dev Convex deployment. No production Stripe/Clerk Billing setup or production `plans:seed`
   run yet, so paid-plan gating isn't proven in a real-money environment.
7. ✅ ~~5-diagram free-tier cap~~ — **resolved.** Free tier is view-only (cannot create diagrams
   at all, enforced server-side in `convex/diagrams.ts` and client-side via
   `EDITING_GATE_ENABLED`), so a numeric diagram cap never applied. The pricing comparison table
   in `constants/pricing.tsx` previously advertised "5" for Free, which was misleading; fixed to
   read "View only."

## Fully connected / working today

- Local-first IndexedDB persistence (debounced Zustand `persist` layer)
- DBML ↔ JSON ↔ Mermaid(export) ↔ canvas two-way sync
- DBML Docs auto-generated documentation
- All four schema import sources: live PostgreSQL, live SQL Server, CSV, BACPAC
- Read-only share links (`/d/view#<fragment>`)
- JSON/DBML file export and import
- PNG/SVG image export (crops to diagram content, ignores current viewport) and SQL export
  (dialect picker: Postgres/MySQL/SQL Server/Oracle) — all gated to Pro like the other exports
- Free-view-only / Pro-edit gate — enforced both client-side (local diagrams) and
  server-side (cloud-synced diagrams)
