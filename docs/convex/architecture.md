# Architecture

How data moves through DBLuna. As of 16 Nov 2026.

## Two places a diagram can live

```
                ┌──────────── browser ────────────┐
 canvas / code ─┤ useCanvasStore (Zustand)        │
 / docs panels  │   └─ persist → IndexedDB        │  ← every diagram, every user
                │                                 │
                │ hooks/use-cloud-*               │  ← only diagrams saved to the cloud
                └───────────────┬─────────────────┘
                                │ useQuery / useMutation (Clerk JWT)
                ┌───────────────▼─────────────────┐
                │ Convex: guards → functions → DB │
                │ http /clerk  ← Clerk webhooks   │
                └─────────────────────────────────┘
```

- **Local** (everyone): the diagram is a Zustand store persisted to IndexedDB with a debounced write. It never leaves the browser unless shared or saved to the cloud.
- **Cloud** (Pro, per diagram): `diagrams.create` copies it to Convex. From then on `use-cloud-autosave` debounces `diagrams.update`, and `use-cloud-reconciliation` subscribes to the Convex copy so collaborators' saves appear live. The local copy stays. A save made against an old `updatedAt` is refused with `CONFLICT` and the conflict banner asks what to do.
- **Share link**: no server at all. The diagram is compressed into the URL fragment and opened read-only at `/d/view`.

## Auth and billing

1. Clerk signs the user in. The Convex client sends Clerk's `convex` JWT; `convex/auth.config.ts` trusts `CLERK_JWT_ISSUER_DOMAIN`.
2. Clerk's webhook calls `POST /clerk` on Convex for user and subscription events; `users` gets the plan and billing period.
3. Each function starts with a guard (`convex/guards.ts`) that finds the `users` row from the JWT subject and checks role and Pro.
4. In the browser, `components/diagram-general/capabilities-context.tsx` turns the plan into what the UI shows (which panels, whether the canvas is editable, the Free limits). That only shapes the UI; Convex repeats the checks.

## AI assistant

```
browser ─► /api/ai-chat ─► users.reserveAiCredit (Convex)
                │
                ├─► Gemini, streaming, with 9 diagram tools (lib/ai/tools.ts)
                │       tool calls are applied to the canvas in the browser (lib/ai/tool-executor.ts)
                │
                └─► users.settleAiCredits (Convex) ─► aiChatSpend
```

On cloud diagrams `use-cloud-ai-chat-sync` stores messages in `aiChatMessages`.

## Import

- **PostgreSQL / SQL Server**: `/api/import-schema` (signed in and Pro) connects with `pg` or `mssql` from the server and reads the catalog. In production `lib/network-guard.ts` refuses private and internal addresses.
- **BACPAC**: `/api/import-bacpac` unzips with `jszip` and reads `model.xml` with `sax` (`lib/parser/bacpac-model.ts`). Table data in the archive is never read.
- **CSV, JSON, DBML, SQL**: parsed in the browser.

Every source returns tables and relationships that are laid out with dagre and merged onto the canvas.

## Key files

| File | Role |
|---|---|
| `convex/schema.ts` | Tables and indexes. See [schema.md](schema.md). |
| `convex/guards.ts` | Access checks. See [api.md](api.md). |
| `convex/http.ts` | Clerk webhook. |
| `convex/crons.ts` | Stale presence cleanup, every 10 minutes. |
| `lib/subscription-rules.ts` | Who has paid access, and which webhook event wins. |
| `lib/ai-credits.ts` | Model, prices, allowance, limits. |
| `store/useCanvasStore.tsx` | The diagram in the browser, its persistence and the read-only guard. |
| `lib/diagram-envelope.ts`, `lib/share-link.ts` | The JSON format shared by file export, import and share links. |
