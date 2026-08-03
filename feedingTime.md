# DBLuna — Product & Technical Overview

This document is a snapshot description of the DBLuna app, written to give any AI assistant
full context before working on this codebase. It describes what the product is, what's actually
implemented (vs. aspirational/roadmap), the architecture, and current known gaps.

## What it is

DBLuna is a web-based database diagramming and documentation tool — think dbdiagram.io / dbdocs.io.
Users visually design database schemas (tables, columns, relationships, notes, areas) on an infinite
canvas, with two-way sync to a DBML code editor, auto-generated documentation, schema import from
live databases, and shareable read-only links. It's built as a Next.js 16 app with Convex as the
backend and Clerk for auth/billing.

## Core diagram editor

**Canvas** (`components/diagram-sections/canvas/`) — the main editing surface: pan/zoom, marquee
select, drag tables/notes/areas, draw foreign-key connections by dragging between columns, a
minimap for navigation, and a keyboard-shortcuts cheat sheet. Tables render with a header, column
list, PK icons, per-table color, lock toggle, and a context menu. "Areas" are dashed rectangles used
to visually group tables; "Notes" are sticky-note-style free text blocks.

**Dock panels** (`components/diagram-general/`) — a drag-and-drop-reorderable tabbed panel system
(via `@dnd-kit`) with these tabs:
- **Tables** — tree view of tables/columns; add/rename/delete, toggle PK/unique/not-null/auto-increment, set column type.
- **Relationships** — list/edit/delete all foreign-key relationships and their cardinality.
- **Notes** / **Areas** — list views mirroring the canvas equivalents.
- **Code** — a CodeMirror-based editor with live two-way sync to the canvas, switchable between
  **DBML**, **JSON**, and **Mermaid** (Mermaid is export-only — there is no Mermaid *importer* yet).
  Includes a custom DBML lint gutter, copy-to-clipboard, and download.
- **Issues** — a client-side schema linter: flags duplicate table names, reserved-SQL-keyword names,
  orphaned (unconnected) tables, FK type mismatches, with severity levels.
- **Templates** — one-click starter-schema gallery; regenerates fresh IDs and centers on the current viewport.
- **Schema** — the DBML Docs view (see below), embedded as a dock tab as well as a full workspace mode.

**Toolbar** (`toolbar.tsx`) — add table/note/area, background style (grid/dots), snap-to-grid, the
Import Schema launcher, zoom controls, and a palette/theme switcher (Default, Blue, Cyberpunk,
Contrast, Tokyo Night, Dracula).

**Top navbar** — diagram name/switcher, My Diagrams manager, Export menu, Import, Share, and the
combined local+cloud save-status indicator.

## DBML Docs (auto-generated documentation)

A separate, read-only rendering pipeline from the canvas — converts canvas state → DBML →
parses it → renders a dbdocs.io-style documentation site in-app: a searchable sidebar, a project
overview page (stat cards, table index, rendered project notes as Markdown), per-table doc pages
(columns, constraints, notes-as-Markdown), a relationships view, and small dagre-laid-out
relationship mini-diagrams. Supports a "Download" button that exports the generated docs as a
standalone Markdown file. Deep-linkable via a `?table=` query param.

## Import Schema — real multi-source import

Not just a text-paste feature. Four tabbed import sources in `ImportSchemaDialog`:
1. **Live PostgreSQL connection** (host/port/user/password/database) — server-side query via `pg`.
2. **Live SQL Server connection** — same flow via `mssql`.
3. **CSV** upload/paste — generates a single table's columns.
4. **BACPAC** file upload — a zipped SQL Server data-tier package; unzipped with `jszip`, its
   embedded `model.xml` schema parsed with `sax`.

All paths return a normalized `{tables, relationships}` shape, auto-laid-out with `@dagrejs/dagre`,
then merged onto the canvas.

## Export / Import (file-based)

- **Export**: JSON (full-fidelity round-trip envelope) and DBML. That's it today — **PNG/SVG/PDF
  export do not exist in code yet**, despite being listed in the pricing page's marketing copy (see
  "Known gaps" below).
- **Import**: JSON file import (via the same shared envelope validator used by share links).

## Sharing

A genuine no-account, read-only viewing path: the Share dialog compresses the full diagram into a
URL fragment (`lz-string`, never sent to any server) and produces a `/d/view#<fragment>` link. The
viewer page decodes it client-side, stages it under a throwaway diagram id so it renders through the
same canvas component as the real editor (with every mutation path actually disabled, not just
visually), and cleans that throwaway entry up on unmount/tab-close. Above a hard size threshold
(32KB compressed), sharing is disabled outright rather than producing a broken link.

## Persistence architecture — local-first, cloud sync is opt-in

**Local-first by default.** Every diagram lives in the browser's IndexedDB (via a debounced Zustand
`persist` layer), with an honest "Saved locally" indicator tied to real writes, not a fake timer.
This is true for every user regardless of plan — editing never required an account historically.

**Cloud sync (Convex) is opt-in, per diagram, and Pro-only in practice.** A user can click "Save to
cloud" on any diagram to push it to Convex; from then on it debounce-autosaves to the cloud in the
background (in addition to, never instead of, the local copy) and can be pulled up to date on
another device via a `/d/cloud/<id>` bootstrap link. "Make local-only" reverses it. This is newly
built (not yet manually verified end-to-end by a human as of this writing) — see "Current state"
below.

**Diagrams are per-browser by identity**, keyed by a client-generated id used directly in the
`/d/[id]` URL — cloud sync adds a separate Convex id mapped alongside it, it doesn't replace the
local id scheme.

## Auth & billing model

- **Clerk** handles sign-in/sign-up and Billing (Free/Pro plans, webhook-synced into Convex's
  `users` table: `planId`, `subscriptionStatus`, etc).
- **Business rule, current and deliberate: Free users can only view — they cannot create, edit,
  export, share, or manage diagrams at all.** Every build-adjacent affordance (Add Table/Note/Area,
  DBML editing, Export, Share, My Diagrams' rename/duplicate/delete, diagram creation) is hidden
  outright for Free users, not just disabled — matching a "pay to build" model. The one no-account
  viewing path is the read-only share link above.
- This gate is enforced **client-side** for local (unsynced) diagrams — there's no server round-trip
  for pure-local edits, so it's a strong UX deterrent, not a security boundary, for those. It **is**
  enforced **server-side** (a real `ConvexError` rejection) for any diagram that's been opted into
  cloud sync, since those go through real Convex mutations that check the caller's plan.
- A feature flag (`EDITING_GATE_ENABLED` in `lib/feature-flags.ts`) gates whether this rule is live at
  all — currently `true` in the working tree (enabled for testing).

**Pricing tiers** (marketing copy in `constants/pricing.tsx`):
- **Free**: up to 5 diagrams, up to 20 tables/diagram, public diagrams only, basic templates,
  community support. *(The 5-diagram cap is advertised but not yet enforced anywhere in code.)*
- **Pro** ($10/mo): unlimited diagrams/tables/workspaces, private diagrams, collaboration (up to 5
  members — **not built yet**, planning doc only), version history (**not built**), areas & sticky
  notes, full template library, priority support.
- **Enterprise**: adds RBAC, SSO, API access, audit logs, dedicated support — entirely aspirational,
  no code.

## Tech stack

Next.js 16 (App Router, Turbopack), React, TypeScript, Tailwind v4, Zustand (state + local persist),
Convex (backend/db), Clerk (auth + billing), CodeMirror (`@uiw/react-codemirror`) for the code
editor, `@dbml/core` for DBML parsing, `@dagrejs/dagre` for auto-layout, `@dnd-kit` for panel
drag-and-drop, `lz-string` for share-link compression, `idb-keyval` for IndexedDB persistence,
`pg`/`mssql` for live database import, `jszip`/`sax` for BACPAC import, `react-markdown` for
rendered notes/docs, `svix` for verified Clerk webhooks.

## A separate, parallel initiative: Electron desktop app

Distinct from the web diagram editor described above — a set of planning docs (`artifacts/
implementation_plan.md.resolved`, `phase2_viewer_plan.md`, `phase3_ssms_plan.md`, `phase4_plan.md`,
`phase5_plan.md`, `local_sql_setup_guide.md`) describe an **offline Electron desktop app** ("Database
Import Workstation") that evolves into an SSMS/Azure-Data-Studio-style tool: object explorer, T-SQL
query editor, BACPAC import/export, connection management — positioned as a local database
management tool, not a diagramming tool. Worth knowing this exists so it isn't confused with the web
app's own DB-import feature (which only *imports* schema into a diagram, it doesn't browse live data
or run queries).

## Current state / known gaps (accurate as of this writing)

- ✅ Local-first persistence, DBML/JSON/Mermaid(export) round-trip, DBML Docs, multi-source schema
  import, read-only share links, Free/Pro billing with real Clerk↔Convex sync, the "Free = view
  only" gate (client + server-side for cloud diagrams), and opt-in Convex cloud sync — all built.
- ⚠️ **Cloud sync just landed this session, not yet manually verified end-to-end** by a human
  clicking through Save-to-cloud / cross-device open / the server-side Free-user bypass test.
- ❌ PNG/SVG/PDF export — advertised on the pricing page, not implemented.
- ❌ 5-diagram free-tier cap — advertised, not enforced anywhere in `convex/diagrams.ts`.
- ❌ Collaboration (multi-user roles/invites) — `diagramMembers` table and role guards exist in
  Convex, but there's no invite UI or real-time presence; explicitly sequenced as a later phase.
- ❌ Version history — advertised, not built.
- ❌ Mermaid import — export-only today.
- ❌ Production Clerk/Convex environment — everything verified so far has been against the
  **development** Clerk instance and **dev** Convex deployment; a production deploy needs its own
  Clerk Billing setup (real Stripe, not the dev-mode gateway) and its own `plans:seed` run against a
  production Convex deployment before `EDITING_GATE_ENABLED` should be considered "live for real
  users."

## Nothing here is committed-and-pushed by default

This repo's working convention: changes get committed locally in logical chunks but are **not**
pushed to any remote without the project owner explicitly doing so themselves.
