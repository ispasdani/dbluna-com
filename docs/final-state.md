# Final state

Where DBLuna stood when development stopped, 16 Nov 2026. This replaces the running status notes (`feedingTime.md`, `chatControl.md`, `things left to do.md`), which are now in [`archive/`](archive/README.md) and out of date.

Three kinds of "done" are kept apart below: **verified** (exercised by hand or by a test that covers the behaviour end to end), **built, not verified by hand** (the code is complete and unit-tested where that's possible, but nobody clicked through it signed in) and **not built**.

At handover: typecheck clean, production build passing, 26 Vitest files and 326 tests passing (17 Nov 2026). No CI.

## Environment

Everything ran against the **dev** Clerk instance and the **dev** Convex deployment. There has never been a production deployment: no production Clerk Billing (real Stripe), no `plans:seed` on a production Convex, and no Vercel production project recorded in the repo. Paid gating has never handled real money.

Steps to go live, in this order (from `lib/feature-flags.ts`):
1. Create the Clerk Billing plans with the slugs `free` and `pro` on the production instance.
2. `npx convex run plans:seed` on the production deployment.
3. `npx convex run migrations:grandfatherExistingUsersToPro` if there are existing users who should keep editing.
4. Set the Convex and Next.js variables from `.env.example`, and point the Clerk webhook at `<CONVEX_SITE_URL>/clerk`.

`EDITING_GATE_ENABLED` is already `true`.

## What shipped

### Verified

| Area | What |
|---|---|
| Editor | Canvas with tables, relationships, notes and areas; pan, zoom, marquee select, minimap, snap to grid, themes; dock panels for Tables, Relationships, Notes, Areas, Enums, Issues (schema linter), Templates and Code. |
| DBML | One DBML parser and generator for canvas, code tab and docs; two-way sync; JSON and Mermaid views of the code (Mermaid is export only). Round trip covered by tests. |
| Local-first persistence | IndexedDB via a debounced Zustand `persist` layer, migrated from localStorage; "Saved locally" tied to real writes; My Diagrams (rename, duplicate, delete). |
| Share links | `/d/view#…`: the whole diagram compressed with `lz-string` into the URL fragment, never sent to a server, opened read-only without an account. Refused above 32 KB compressed. |
| Import | Live PostgreSQL and SQL Server, CSV, JSON and BACPAC. The BACPAC parser was run against Microsoft's Wide World Importers sample: 48 tables, 98 foreign keys with none unresolved, 111 indexes and unique constraints, 76 other objects. |
| Export | JSON, DBML, SQL (PostgreSQL, MySQL, SQL Server, Oracle via `@dbml/core`), SVG cropped to the diagram, the docs as Markdown, and the Reporting Handoff HTML. |
| DBML Docs | A documentation site inside the app: overview, per-table pages, enums, relationships, mini relationship diagrams, ranked and filtered search (about 6 ms for a qualified name over 1,000 tables and 30,000 columns), schema dependencies, SQL Server views, indexes and other objects. |
| Schemas and large diagrams | Schemas tab, show and hide by schema, DBML TableGroup or foreign-key cluster, dashed stubs for links to hidden tables, a schema graph, auto-arrange, focus mode. Built for a 428-table, 672-relationship customer schema. |
| Billing rules | `lib/subscription-rules.ts`: cancelling keeps Pro until the paid period ends; an old plan's "ended" event can't undo an upgrade; 3-day grace for a late renewal webhook. Each rule has a test. |
| AI credit maths | `lib/ai-credits.ts`: tests assert a Pro subscriber can't cost more than $1.35 a month. |

### Built, not verified by hand

These are wired end to end in code, and the pure logic is tested, but nobody has clicked through them signed in:

- **Cloud sync** (Pro): "Save to cloud" per diagram, background autosave, opening on another device through `/d/cloud/[cloudId]`, "Make local-only", and the server refusing a Free user. Saves carry `expectedUpdatedAt`; a stale save is refused with `CONFLICT` and the editor shows a conflict banner.
- **Collaboration** (Pro): email invites with a 7-day token, up to 5 members, editor or viewer roles, `/d/join`, live presence avatars (a cron removes stale presence every 10 minutes), and collaborators' saves appearing live.
- **Version history** (Pro, cloud only): a snapshot when a diagram is promoted to the cloud, automatic snapshots after 30 minutes without one (the newest 20 kept), named manual versions, and a restore that keeps history.
- **AI assistant** (Pro): Gemini (`gemini-3.1-flash-lite`, pinned) with 9 tools that edit the diagram; a credit reserved before each turn and settled after; a monthly allowance; 10 turns a minute; a global monthly ceiling that switches the feature off for everyone if metering breaks; chat history synced to Convex for cloud diagrams. Needs `GOOGLE_GENERATIVE_AI_API_KEY`, which is not in the current `.env.local`.
- **Free plan**: Free users may edit in the Code tab only, up to 5 diagrams and 10 tables each; the canvas is view-only. Enforced in the browser only, because Free diagrams never reach Convex.
- **BACPAC docs end to end**: signed-in import, cloud save and restore, and a comparison with a live SQL Server catalog. Follow [`testing/bacpac-manual-test-plan.md`](testing/bacpac-manual-test-plan.md).
- **Schemas tab**: the manual checks and the performance measurement on the 428-table schema in a production build (in the archived plan's §7 and §9).

### Not built

- **PDF and PNG export.** Only SVG ships. The pricing page doesn't promise either.
- **Mermaid import.**
- **Member management**: no way to see accepted members, remove them or change their role. After 5 accepted members a diagram can never invite again. The `admin` role exists in the schema and guards but the invite dialog can't grant it.
- **Server-side Free limits**: the 5-diagram and 10-table caps exist in the browser only.
- **Enterprise plan**: marketing copy only.
- **Desktop app**: an Electron "Database Import Workstation" was planned in 5 phases (`archive/desktop-and-local-first/`). Only `app/(desktop)/desktop/page.tsx` and the remote branch `experimenting-with-electron-for-backend-service-app` exist.

## Known issues

- **Fixed 17 Nov 2026: `/api/import-schema` had no auth check.** `proxy.ts` leaves `/api/*` public and the route connects to whatever host it's given, so anyone could use the server to reach hosts on its network (SSRF) or probe credentials. It now requires sign-in and Pro (while `EDITING_GATE_ENABLED` is on, matching the Import menu), validates the port, and in production refuses private, loopback, link-local and metadata addresses, connecting to the exact IP it checked (`lib/network-guard.ts`, with tests). Ported from the never-merged branch `fix/api-auth-and-note-delete`, together with its fix for the Delete key not removing a selected note unless a table was also selected. Consequences: in a production build (`next start` too) you can't import from `localhost`; and the route connects by IP, so a host that needs TLS server-name routing (Neon, Azure SQL) won't work, although neither works today anyway because the route doesn't use TLS.
- The diagram switcher dropdown in `useDockStore` is still mock data ("Diagram A/B/C").
- Lint warnings in `canvas.tsx` ("Cannot access refs during render" and unused imports) were noted and left alone.
- `docs/business/` makes commercial claims that the repository can't support (see the warning in its README).

## Branches

`main` holds everything. Old branches still on GitHub: `feat/schemas-tab-visibility` and `perf/canvas-hover-selection` (merged in pull requests 4 and 5), `free-tier-code-editing` (fully merged), `fix/api-auth-and-note-delete` (its one commit is now ported to `main`, so the branch can go) and `experimenting-with-electron-for-backend-service-app` (1 unmerged commit, 12 Mar 2026: the Electron experiment, the only copy of that code).

## Timeline

| When | What |
|---|---|
| Dec 2025 | Project created; custom shadcn setup. |
| Jan 2026 | Canvas and dock modelled on drawDB (`archive/drawdb-research/`). |
| Mar–Apr 2026 | Electron desktop plans; DBML docs phase 2 plan. |
| Jul 2026 | Cleanup; local-first persistence; share links; DBML Docs integrated; paid editing access and Clerk Billing. |
| Aug 2026 | Collaboration, version history, AI assistant with credit metering, navbar identity, Free tier as code-only editing. |
| Sept 2026 | Panel redesigns, onboarding, marketing pages and blog, AI credit rework, auto-arrange, canvas performance, Schemas tab and visibility. |
| 14–16 Nov 2026 | BACPAC schema documentation and search, Reporting Handoff export with its Graph tab, business planning package. |
