# Things Left To Do

Gaps identified between what's advertised/described for DBLuna and what's actually implemented
and verified in code (checked against `feedingTime.md` and the current codebase as of 2026-08-08).

## Not fully connected / need more work

1. **PNG/SVG/PDF export** — no export code exists anywhere except as marketing copy in
   `constants/pricing.tsx`. Advertised on the pricing page, not built.
2. **5-diagram free-tier cap** — no limit-enforcement logic found in `convex/diagrams.ts`.
   Advertised on the pricing page, not enforced anywhere.
3. **Collaboration (multi-user)** — `diagramMembers` table and role guards exist in Convex, but
   there's no invite UI or real-time presence. Backend scaffolding only, not a working feature.
4. **Version history** — advertised, no code at all.
5. **Mermaid import** — only export works today. There's no importer, despite Mermaid being one
   of the three code-editor modes (DBML/JSON/Mermaid).
6. **Cloud sync** — the code path (save-to-cloud, cross-device pull, server-side Free-user
   rejection) exists and `EDITING_GATE_ENABLED = true` is live, but it has **not yet been
   manually verified end-to-end by a human** — connected in code, unconfirmed in practice.
7. **Production environment** — everything so far has run against the dev Clerk instance and
   dev Convex deployment. No production Stripe/Clerk Billing setup or production `plans:seed`
   run yet, so paid-plan gating isn't proven in a real-money environment.

## Fully connected / working today

- Local-first IndexedDB persistence (debounced Zustand `persist` layer)
- DBML ↔ JSON ↔ Mermaid(export) ↔ canvas two-way sync
- DBML Docs auto-generated documentation
- All four schema import sources: live PostgreSQL, live SQL Server, CSV, BACPAC
- Read-only share links (`/d/view#<fragment>`)
- JSON/DBML file export and import
- Free-view-only / Pro-edit gate — enforced both client-side (local diagrams) and
  server-side (cloud-synced diagrams)
