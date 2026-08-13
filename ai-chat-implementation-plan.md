# AI Chat: schema-aware assistant that can edit the diagram

## Context

DBLuna's diagram editing (canvas, Tables/Relationships dock tabs, DBML/JSON/Mermaid code
editor) is already unified behind a single reactive Zustand store, `useCanvasStore`. Every
surface subscribes to it directly, so *any* code path that calls the store's mutation
functions (`setTables`, `addRelationship`, etc.) already propagates everywhere for free —
this is the property that makes an "AI that edits your diagram" tractable without inventing
a new sync mechanism.

The ask: an AI chat panel that (a) has knowledge of the current diagram, (b) can answer
questions about it, and (c) can perform actions ("add a table related to this area", "connect
it to another table") that show up immediately in the canvas, Tables tab, and Code tab. Model
choice already decided: **Gemini 2.5 Flash-Lite**, chosen over Gemma specifically because this
feature needs reliable structured tool-calling (a hallucinated/malformed call would corrupt a
user's schema), not just chat quality.

This is a genuinely new subsystem — no AI SDK is installed, no chat UI exists, and neither
existing Next.js API route (`import-schema`, `import-bacpac`) has an auth check, so this plan
also has to establish those conventions rather than copy them.

## Key architectural decision: where does tool execution happen?

The canonical diagram state for most diagrams lives **only in the browser** (Zustand +
IndexedDB, local-first by default; Convex cloud sync is opt-in/Pro-only). So the server
**cannot** execute "add a table" itself — there's no server-side row to mutate for a
local-only diagram. Tool execution must happen **client-side**, dispatched against
`useCanvasStore.getState()`, exactly like every other mutation in this app.

This matches the Vercel AI SDK's "client-side tools" pattern (a tool declared with no
`execute` on the server is surfaced to the client to run and report a result back), so that's
the vehicle recommended below instead of hand-rolling an SSE/tool-loop protocol from scratch.

## Recommended architecture

**New dependencies**: `ai`, `@ai-sdk/google`, `@ai-sdk/react` (Vercel AI SDK — streaming,
multi-step tool loop, and the client-side-tool pattern are exactly what this needs; hand-rolling
that protocol would be strictly more code for no benefit).

**Flow:**
1. User opens the new "AI Chat" dock tab and sends a message.
2. Client (`ai-chat-panel.tsx`) calls the AI SDK's `useChat`, which POSTs to
   `app/api/ai-chat/route.ts` with the message history plus a fresh DBML snapshot of the
   diagram as context.
3. Server route: Clerk auth check (currently missing from every API route — add it here),
   Pro-plan check (reuse `convex/guards.ts`'s pattern / `getCurrentUserPlan`), then
   `streamText({ model: google('gemini-2.5-flash-lite-...'), messages, tools, stopWhen: stepCountIs(N) })`
   with tool *declarations* only (no `execute`) — the model's tool calls stream to the client
   as events, not executed on the server.
4. Client's `useChat` surfaces each tool call; a dispatch table
   (`lib/ai/tool-executor.ts`) runs it against `useCanvasStore`, and the result (or error) is
   sent back to continue the conversation — this is what lets the model say "done, I added
   `orders` with 4 columns and linked it to `users`" instead of going silent after the call.
5. Because execution goes through the same store actions/patterns the rest of the app uses,
   the canvas, Tables/Relationships panels, and the DBML/JSON/Mermaid code tab all update with
   zero extra wiring (confirmed: they're all subscribed to `useCanvasStore` already).

**Diagram context**: reuse the existing `generateDbmlFromCanvas(tables, relationships, meta)`
from [lib/generator/dbml-generator.ts](lib/generator/dbml-generator.ts) — it's already the
compact canonical text form used for the Code tab, no new serializer needed. Regenerate fresh
per request (cheap, avoids staleness).

**Tool schema — reference by name, not id.** The model never sees internal UUIDs, so tools
take `tableName`/`columnName` args; the executor resolves name → id against the live store
right before mutating. This avoids an entire class of hallucinated-id failures.

Tool set (in `lib/ai/tools.ts`, shared between the AI SDK tool declarations and the executor
so they can't drift):
- `add_table(name, columns[], areaTitle?)`
- `update_table(tableName, updates)`
- `delete_table(tableName)`
- `add_column(tableName, column)` / `update_column` / `delete_column`
- `add_relationship(sourceTable, sourceColumn, targetTable, targetColumn, cardinality?)`
- `add_note(title?, content)`
- `add_area(title, tableNames?)`

**Placement**: `addTable()` on the store takes no args and drops a hardcoded default table —
not usable directly for AI-authored content. Instead, construct a full `Table` object
(`crypto.randomUUID()` for the id, same shape as [store/useCanvasStore.tsx](store/useCanvasStore.tsx))
and merge it in via `setTables([...tables, newTable])`, mirroring how
[components/diagram-sections/import-schema-dialog.tsx](components/diagram-sections/import-schema-dialog.tsx)'s
`layoutAndImport` already does bulk merges. That function's dagre layout only avoids overlap
*within* the newly-added batch, not against pre-existing tables — write a small
`findFreePosition(existingTables, existingAreas)` heuristic in `lib/ai/placement.ts` that scans
current table/area bounding boxes and places new tables in the nearest free grid slot (near a
related table if the request implies a connection, near an area's bounds if `areaTitle` is
given).

**Gating**: no new flag needed — thread the same `readOnly` prop already passed into
`DockPanel` → down to the new panel (mirrors `CodeEditor`'s pattern exactly). When `readOnly`,
show the same upsell affordance other gated panels use
(`useUpgradeToastStore` / "Upgrade to edit" link) instead of a composer. This automatically
gives Free = view-only for the AI feature with zero new gating logic.
Server-side, add a real Pro check in the route (defense in depth, since the route is
independently reachable) — reuse the `requirePro`/`getCurrentUserPlan` pattern from
[convex/guards.ts](convex/guards.ts) rather than inventing a new one.

**Usage/cost control**: out of scope for v1 beyond the Pro gate above. `users.credits` exists
in the Convex schema and is clearly earmarked for this (pricing page already advertises "AI
credits purchase" for Pro), but nothing consumes it today and building a metering/grant system
is a separate project. Note it as an explicit fast-follow, don't block this feature on it.

**Chat history persistence**: local-only for v1, consistent with the rest of the app's
local-first philosophy — a new small Zustand store (`store/useAiChatStore.tsx`) keyed by
diagram id, persisted via the existing `createDebouncedStorage` IndexedDB adapter
([store/debounced-storage.ts](store/debounced-storage.ts)), same shape as
`useEditorStore`/`useCanvasStore`. No new Convex table for v1 (there's no chat table today);
Convex-synced chat history (matching the opt-in cloud-sync-diagram pattern) is a reasonable
phase 2, not needed to ship the core feature.

## Files to add / change

- `app/api/ai-chat/route.ts` — new. `POST` handler: Clerk `auth()` check → Pro-plan check →
  `streamText(...)` with tool declarations, streamed response. Follow the existing
  `{success, ...}` / error-envelope spirit of `import-schema/route.ts` for non-streaming error
  cases (e.g. 401/403 before streaming starts).
- `lib/ai/tools.ts` — new. Tool JSON-schema declarations, shared by server and client.
- `lib/ai/tool-executor.ts` — new. `applyToolCall(name, args)`: name→id resolution, calls
  `useCanvasStore.getState()` mutations, returns a result/error string for the model.
- `lib/ai/placement.ts` — new. `findFreePosition` overlap-avoidance heuristic.
- `store/useAiChatStore.tsx` — new. Local, diagram-scoped, IndexedDB-persisted chat history.
- `components/diagram-general/ai-chat-panel.tsx` — new. Message list + composer, `useChat`
  wired to `applyToolCall`, `readOnly` gating identical to `code-editor.tsx`'s pattern.
- `store/useDockStore.tsx` — add `"ai-chat"` to the `TabId` union and a `{id, label, icon}`
  entry in `TABS`.
- `components/diagram-general/dock-panel.tsx` — add
  `activeTab === "ai-chat" ? <AiChatPanel readOnly={readOnly} /> :` to the existing chain
  (line ~80 in the current file).
- `.env.local` — add the Gemini API key (server-only, unprefixed, matching
  `CLERK_SECRET_KEY`'s convention). Confirm exact env var name expected by `@ai-sdk/google` at
  implementation time (typically `GOOGLE_GENERATIVE_AI_API_KEY`).
- `package.json` — add `ai`, `@ai-sdk/google`, `@ai-sdk/react`.

## Verification

1. `npm run dev`, open a diagram with a couple of existing tables.
2. Open the new "AI Chat" tab, ask: *"add a table called orders with id, user_id, and total
   columns, and connect user_id to the users table"* — confirm: new table renders on canvas
   without overlapping existing tables, appears in the Tables dock tab, appears in the
   generated DBML in the Code tab, and the relationship line/edge is drawn on canvas.
3. Ask a pure question ("what tables reference `users`?") — confirm it answers from context
   without making any tool call (no spurious mutation).
4. Simulate a Free-tier user (`readOnly` true) — confirm the panel shows the upsell affordance
   instead of a composer, and that `POST /api/ai-chat` independently rejects with 403 when
   called directly (e.g. via curl) without a Pro session.
5. Ask for something referencing a nonexistent table — confirm the executor returns a
   graceful error string that the model relays in chat, rather than throwing/crashing the
   panel.
6. Reload the page — confirm chat history for that diagram persists (IndexedDB), matching the
   "Saved locally" behavior of the rest of the app.
