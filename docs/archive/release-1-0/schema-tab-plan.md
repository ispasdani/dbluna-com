# Schema Tab — Implementation Plan

## Context

The `schema` dock tab has been registered since the dock was built
([`store/useDockStore.tsx:14`](../store/useDockStore.tsx)) but has **never been implemented**. It is
open by default in the left dock (`leftTabs` initializes to every tab id), it drags, docks, closes
and reopens like a real tab, and selecting it renders the generic fallback in
[`dock-panel.tsx`](../components/diagram-general/dock-panel.tsx):

> *"Schema Panel — Content for schema will appear here."*

There is no `schema-panel.tsx`; every other tab has one. Nothing in git history or `to-be-deleted/`
suggests one ever existed.

### The gap it should fill

`enums`, `tableGroups` and `project` are first-class fields on the canvas model
([`useCanvasStore.tsx:121-123`](../store/useCanvasStore.tsx)), persist per-diagram via `CanvasFields`,
round-trip through DBML, sync to Convex, and are **rendered read-only in Docs mode**
([`project-overview.tsx`](../components/documentation/project-overview.tsx),
[`docs-sidebar.tsx`](../components/documentation/docs-sidebar.tsx)). But the only way to *author* any
of them is hand-writing DBML in the Code tab. The store says so:

> "These have no visual representation on the canvas yet; they are authored via the DBML code editor
> and surfaced in the read-only Docs reflection." — [`useCanvasStore.tsx:44`](../store/useCanvasStore.tsx)

The same is true of **schema namespaces**: `dbo.Users` exists only because someone typed a dot into a
table name, which `splitSchema()` ([`dbml-generator.ts:16`](../lib/generator/dbml-generator.ts)) picks
apart downstream to drive Docs grouping. Completely undiscoverable.

### Design decision (2026-09-06)

> **The Schema tab owns everything *above* the table level, and nothing at or below it.**
>
> | Tab | Owns |
> |---|---|
> | Tables | table + column level |
> | Relationships | edge level |
> | Notes / Areas | canvas annotation |
> | Code | the text representation |
> | Issues | validation over all of it |
> | **Schema** | **project metadata, namespaces, enums, table groups** |
>
> **Consequence:** the Schema panel is a *pure consumer* of store state that already exists. It adds
> no new persisted fields, no new store slice, no new sync path, no new effect at page level. That
> constraint is what makes this change safe.

### Non-goals

- No column editing (Tables owns it), no FK editing (Relationships), no validation (Issues), no
  read-only presentation (Docs). A "tree view of everything" would just be a worse Docs mode.
- No changes to the plan/capability gating semantics. See §7.
- No changes to the canvas, the camera, or any render loop.

---

## Guiding constraints

These are the two explicit requirements for this work; every section below is written to satisfy them.

**C1 — No regressions.** The DBML round-trip, Docs mode, cloud sync, share links, the plan gate and
the Code tab must behave exactly as they do today. Every change is additive or a strictly-narrower
fix with a test.

**C2 — No performance change.** Specifically:

- The panel only mounts when it is the active tab (the `dock-panel.tsx` if/else chain renders exactly
  one panel per side), so it costs **zero** when not open. Keep it that way — do **not** hoist any
  derivation into `page.tsx`, `canvas.tsx`, or a shared hook.
- The panel must **not** re-render or recompute during a canvas drag. `updateTablePos` / `moveTables`
  write `tables` on every pointermove. See §6, which is the single most important performance section
  in this plan.

---

## Phase 0 — Stabilize enum & table-group ids (infra only, no UI)

**This phase must land first, and it fixes a pre-existing bug.**

[`parsedToCanvasSchemaMeta`](../lib/parser/dsl-parser.ts) mints a fresh `crypto.randomUUID()` for every
enum and every table group on **every parse**:

```ts
const enums: CanvasEnum[] = parsed.enums.map((en) => ({
  id: crypto.randomUUID(),   // <- new id on every keystroke
  ...
}));
```

The Code tab re-parses on a 400ms debounce, so today every DBML edit rewrites all enum/group ids.
Two consequences:

1. **Pre-existing bug:** `use-cloud-autosave.ts` dedupes pushes with
   `JSON.stringify(payload) === lastPushedSignatureRef.current`, and the payload includes `enums` /
   `tableGroups` with their ids. Regenerated ids change the signature, so **a semantically-identical
   schema is pushed to Convex anyway**. Fixing this removes network calls; it cannot add any.
2. **Would-be new bug:** a Schema panel keying React children / expansion / inline-edit state by
   `enum.id` would have that state blown away on every Code-tab keystroke whenever both tabs are
   mounted (Code left, Schema right — a supported layout).

### Change

Mirror the id-preservation pattern `parsedTablesToCanvasTables` already uses
(`existingTables.find(t => t.name === name)`, [`dsl-parser.ts:287`](../lib/parser/dsl-parser.ts)):

```ts
export interface ParsedToCanvasMetaOptions {
  existingEnums?: CanvasEnum[];
  existingTableGroups?: CanvasTableGroup[];
}

export const parsedToCanvasSchemaMeta = (
  parsed: ParsedDbmlResult,
  { existingEnums = [], existingTableGroups = [] }: ParsedToCanvasMetaOptions = {}
): CanvasSchemaMeta => {
  // id: existingEnums.find((e) => e.name === en.name)?.id ?? crypto.randomUUID()
};
```

**The options argument is optional and defaults to today's behavior**, so the existing call in
[`dbml-roundtrip.test.ts:52`](../lib/__tests__/dbml-roundtrip.test.ts) and any other caller keeps
compiling and passing unchanged.

Then update the one production caller,
[`code-editor.tsx:209`](../components/diagram-general/code-editor.tsx), to read current values fresh
from the store (the same `useCanvasStore.getState()` idiom the surrounding lines already use for
`tables` and `relationships`, so no new subscription and no stale closure):

```ts
const meta = parsedToCanvasSchemaMeta(parsed, {
  existingEnums: useCanvasStore.getState().enums,
  existingTableGroups: useCanvasStore.getState().tableGroups,
});
```

### Regression guard

- New tests in `dbml-roundtrip.test.ts`: (a) enum id preserved across a re-parse when the name is
  unchanged; (b) a renamed enum gets a new id; (c) omitting the options argument reproduces today's
  behavior exactly.
- Manual: open the Code tab, type a space in the DBML, confirm the network tab shows **no** Convex
  push (previously it pushed).

**Risk: low.** Backwards-compatible signature, one production call site, covered by tests.

---

## Phase 1 — Panel shell + Project section

### 1a. Wire the tab

One branch in [`dock-panel.tsx`](../components/diagram-general/dock-panel.tsx), inserted alongside the
existing ones:

```tsx
) : effectiveActiveTab === "schema" ? (
  <SchemaPanel />
```

Static import, matching every other panel (`TablesPanel`, `IssuesPanel`, ...). Do **not** use
`next/dynamic` — the panel is small, and the only dynamic import in that file (`DraggableTab`) exists
for an `ssr: false` reason that does not apply here.

The generic `activeTabInfo` fallback stays in place untouched; it is the correct behavior for any tab
id that has no panel, and removing it would be a regression for future tabs.

### 1b. New file `components/diagram-general/schema-panel.tsx`

Structure: four collapsible sections in the `TablesPanel` accordion idiom, so it reads as part of the
same app. Sections are independently collapsible with local `useState`; no new store.

### 1c. Project section

Three inputs — `name`, `databaseType`, `note` — writing through the **existing** `setProject`.

- Local `useState` mirrors the store value; commit on blur / debounced (~300ms), never per keystroke,
  so we do not arm the 1500ms cloud-push debounce on every character.
- `databaseType` renders as a `<select>` seeded from `SQL_DIALECTS`
  ([`sql-generator.ts:7`](../lib/generator/sql-generator.ts)) plus a free-text "Other", since DBML's
  `database_type` is a free string and we must not narrow what the parser can round-trip.
- Writing `null` when all three fields are empty preserves today's `project: null` shape, which
  `generateDbmlFromCanvas` already guards on (`if (project && (...))`).

**Regression note:** `parsedToCanvasSchemaMeta` returns `project: null` when the DBML has no `Project`
block. If the panel wrote `{}` instead of `null`, the generator's guard would still hold, but the
cloud payload signature would differ from a freshly-parsed one. Write `null`.

---

## Phase 2 — Enums

Full CRUD over `CanvasEnum[]` through the existing `setEnums`:

- create / rename / delete an enum, edit its `note`
- add / rename / remove / reorder values, edit per-value `note`

### Usage indicator

Docs already matches an enum to a column by exact type-name string
([`table-view.tsx:40`](../components/documentation/table-view.tsx)). Reuse the same rule to show
*"used by 3 columns"* per enum, clickable to select the owning table via `setSelectedTableIds`
(the pattern [`issues-panel.tsx`](../components/diagram-general/issues-panel.tsx) already uses).

Deleting an enum that is in use shows a confirm dialog naming the columns. It does **not** rewrite
column types — silently mutating table data from this panel would violate the non-goals above and
surprise the user.

### Perf

The usage scan is `O(tables x columns x enums)`. It must be memoized on the derived signature from
§6, **not** on the `tables` array identity, or it re-runs on every pointermove during a drag.

---

## Phase 3 — Table groups

CRUD over `CanvasTableGroup[]` through the existing `setTableGroups`: create / rename / delete a
group, add / remove member tables via a checklist picker.

**Critical detail:** `tableNames` holds **schema-qualified strings** (`"dbo.Users"`), produced by
`qualifiedGroupRef` ([`dsl-parser.ts:411`](../lib/parser/dsl-parser.ts)), and
[`docs-sidebar.tsx:120`](../components/documentation/docs-sidebar.tsx) resolves them with an exact
`tables.find(t => t.name === ref.tableName)`. The picker must therefore store the table's **full
`table.name` verbatim**, never a display-stripped version. A single shared helper —

```ts
// lib/schema-namespace.ts
export const splitSchemaName = (name: string) => { /* moved from dbml-generator.ts */ };
```

— used by both the generator and the panel keeps these in lockstep. Move (don't copy) `splitSchema`
out of `dbml-generator.ts` and re-export it there so that file's behavior is byte-identical.

Show a "not found" marker for a `tableNames` entry that resolves to no table (already possible today
via hand-written DBML) rather than dropping it — dropping it would silently mutate the user's DBML on
the next regenerate.

---

## Phase 4 — Schemas / namespaces (highest risk — do last)

This section is **derived, not stored**: group `tables` by `splitSchemaName(t.name).schema`, showing
`dbo (12)`, `public (4)`, `(no schema) (3)`.

Actions:

1. **Assign a table to a schema** — `updateTable(id, { name: "dbo.Users" })`
2. **Rename a schema** — rewrite the prefix on every table in it
3. **Create an empty schema** — local UI state only; it materializes once a table is assigned

### Regression risks, and the guard for each

| Risk | Guard |
|---|---|
| **Renaming a schema orphans table groups.** `tableGroups.tableNames` are schema-qualified strings matched exactly. Renaming `dbo` to `sales` without rewriting them silently empties every group and changes the Docs sidebar. | The rename is a **single transaction**: compute the new `tables` *and* the new `tableGroups`, then call `setTables` + `setTableGroups`. Unit-test that a group survives a schema rename. |
| **Name collision.** Moving `Users` into `dbo` when `dbo.Users` already exists creates a duplicate. | Pre-flight check; block with an inline message. `IssuesPanel` already reports duplicate names, but this panel must not *create* one. |
| **Relationships break.** | They key off `sourceTableId` / `targetTableId`, never names — verified in [`useCanvasStore.tsx`](../store/useCanvasStore.tsx). Renaming is safe. Assert this in a test so a future refactor cannot regress it. |
| **`public` is special.** `DEFAULT_PARSE_SCHEMA = "public"` ([`dsl-parser.ts:253`](../lib/parser/dsl-parser.ts)) is *stripped* on the way in, so a table explicitly named `public.Users` is not round-trip stable. | Treat `public` as reserved: show it as "(default)" and do not offer it as a rename target. Do **not** change the parser's stripping behavior — Docs grouping depends on it (`DEFAULT_SCHEMAS` in `docs-sidebar.tsx`). |
| **Docs grouping mode flips.** `docs-sidebar.tsx` only uses schema grouping when `schemaMap.size > 1`, and explicit `tableGroups` always win. | Behavior is unchanged and correct — but note it in the panel copy so a user who creates one schema and sees no Docs change is not confused. |
| **`setTables` is gated by `codeReadOnly` and fires the upgrade toast.** | Intentional and unchanged — see §7. |

If Phase 4 proves contentious, **ship Phases 0-3 and stop.** They are independently valuable and
carry none of this risk.

---

## Phase 5 — Small follow-ups (optional)

1. **Saving indicator.** [`use-diagram-autosave.ts`](../hooks/use-diagram-autosave.ts) watches
   `tables / notes / areas / relationships` but not `enums / tableGroups / project`, so a schema-only
   edit persists (zustand `persist` writes on every `set`) without ever showing "Saving...". Adding the
   three selectors is a 3-line change; they are cheap reference selectors, and `use-cloud-autosave.ts`
   already watches all three.
2. **SQL export dialect default.** Seed the export dialog's dialect from `project.databaseType` when
   it maps to a `SqlDialect`, instead of asking twice. Purely a default; the picker stays.

---

## §6 Performance — the one thing to get right

`updateTablePos` and `moveTables` write `tables` on **every pointermove** of a canvas drag. Anything
subscribed to `tables` re-renders at pointer rate.

**Do not** write `const { tables, enums, ... } = useCanvasStore()` — that is the `TablesPanel` /
`CodeEditor` idiom, and it subscribes to the entire store. Use narrow selectors, matching the newer
[`canvas.tsx`](../components/diagram-sections/canvas/canvas.tsx) and
[`use-cloud-autosave.ts`](../hooks/use-cloud-autosave.ts) style:

```ts
const enums       = useCanvasStore((s) => s.enums);
const tableGroups = useCanvasStore((s) => s.tableGroups);
const project     = useCanvasStore((s) => s.project);
const tables      = useCanvasStore((s) => s.tables);
```

`enums` / `tableGroups` / `project` are stable references that change only on a real edit, so those
three cost nothing during a drag. `tables` is unavoidable — the panel needs names, columns and ids.
The fix is to make every derivation depend on a **cheap structural signature** rather than the array
identity:

```ts
// Changes only when something the Schema panel actually cares about changes --
// NOT when a table moves. x/y are deliberately excluded.
const schemaSignature = useMemo(
  () => tables.map((t) => `${t.id} ${t.name} ${t.columns.map((c) => c.type).join(",")}`).join(""),
  [tables]
);

// eslint-disable-next-line react-hooks/exhaustive-deps
const namespaces = useMemo(() => groupBySchema(tables), [schemaSignature]);
// eslint-disable-next-line react-hooks/exhaustive-deps
const enumUsage = useMemo(() => scanEnumUsage(tables, enums), [schemaSignature, enums]);
```

The signature build is `O(n)` string work on each `tables` change; the grouping and the
`O(tables x columns x enums)` usage scan — the expensive parts — run only on a real structural change.
The exhaustive-deps suppressions are deliberate and must carry the comment above them, matching the
existing precedent in [`tables-panel.tsx:57`](../components/diagram-general/tables-panel.tsx).

Additional rules:

- Debounce every text input's commit (~300ms) or commit on blur. A per-keystroke `setProject` would
  re-arm the 1500ms cloud-push debounce on every character.
- No `useEffect` that writes to the store on mount. The panel renders what is there; it never
  normalizes or migrates data as a side effect of being opened.
- Virtualization is not needed and should not be added — a schema with hundreds of enums is not a real
  case, and the dep list above already keeps the work off the drag path.

### Measurement

Before/after, with the React DevTools Profiler: drag a table across the canvas for ~2s with the Schema
tab open in the right dock. **Expected: zero SchemaPanel re-renders** beyond the `tables`-reference
change, and zero re-runs of the memos. This is the acceptance gate for C2.

---

## §7 Capability gating — deliberately unchanged

`setProject` / `setEnums` / `setTableGroups` / `setTables` all check `codeReadOnly` and fire the
upgrade toast ([`useCanvasStore.tsx:715-753`](../store/useCanvasStore.tsx)). The panel calls them
as-is and adds no gate of its own.

Noted for the record, **not** to be changed in this work: the Schema tab is Pro-only anyway via
`FREE_TAB_IDS = ["code"]` (`app/(diagram)/d/[id]/page.tsx:39`), so the distinction is currently moot.
But schema-level edits are *structural*, which argues they belong behind `readOnly` (canvas) rather
than `codeReadOnly` (text). Changing that today would alter the lapsed-Pro and Free-plan paths that
`free-tier-code-only-editing-plan.md` deliberately tuned. **Out of scope** — file it as a follow-up if
`visibleTabs` ever grants Free the Schema tab.

`visibleTabs`, `FREE_TAB_IDS` and `capabilities-context.tsx` are **not touched by this plan.**

---

## §8 Interaction with the Code tab

Both panels can be mounted simultaneously (Code docked left, Schema docked right) — a supported layout
that must be verified, not assumed.

The loop, traced through [`code-editor.tsx`](../components/diagram-general/code-editor.tsx):

1. Schema panel calls `setEnums(next)` — store `enums` changes.
2. CodeEditor's Canvas-to-Code effect (deps include `enums`) regenerates the DBML and calls `setCode`.
3. 400ms later `debouncedCode` changes; the Code-to-Canvas effect parses and calls
   `setTables / setRelationships / setEnums / setTableGroups / setProject`.
4. Those produce new array identities, re-running the Canvas-to-Code effect, which generates the
   **identical string** — `setCode` with an unchanged primitive — React bails — `debouncedCode` never
   changes — **the loop terminates.**

This already holds today (it is the same path a canvas edit takes). Phase 0 strengthens step 3 by
keeping ids stable through the re-parse. **Test it explicitly** — it is the highest-value manual check
in this plan.

Note the existing `isTypingRef` guard makes the editor authoritative *while typing*: a Schema-panel
edit made mid-keystroke in the Code tab will be overwritten by the next parse. That is today's
behavior for canvas edits too, and is out of scope.

---

## §9 Verification checklist

### Automated

- [ ] `dbml-roundtrip.test.ts` — full suite green, existing assertions unchanged.
- [ ] New: enum id preserved across re-parse; renamed enum gets a new id; no-options call matches old behavior.
- [ ] New: table group survives a schema rename (Phase 4).
- [ ] New: relationships survive a schema rename (id-keyed, not name-keyed).
- [ ] `sql-import.test.ts`, `share-link-roundtrip.test.ts`, `docs-markdown.test.ts` — untouched, green.
- [ ] `tsc --noEmit` clean.

### Manual — regression

- [ ] Every other dock tab renders and behaves as before; drag / dock / close / reopen unaffected.
- [ ] A tab with no panel still shows the generic fallback.
- [ ] Docs mode: project overview, enum list, sidebar grouping (explicit / schema / flat) all unchanged
      for an untouched diagram.
- [ ] Code tab alone: DBML round-trip byte-identical to before for a fixture with enums, groups and a
      project block.
- [ ] Cloud diagram: edit a table — exactly one push. Type a space in the DBML — **zero** pushes
      (Phase 0 fix).
- [ ] Share-link export / import of a diagram with enums and groups.
- [ ] Free plan: Schema tab still hidden; Code tab still editable.

### Manual — new behavior

- [ ] Project name / type / note edit appears in the Docs overview and in the generated DBML.
- [ ] Enum CRUD reflected in DBML and Docs; usage count correct; delete-in-use warns.
- [ ] Table group CRUD switches the Docs sidebar to explicit grouping.
- [ ] Schema rename updates table names, table groups and Docs grouping together; relationships intact.
- [ ] Code left + Schema right, edit in each: both converge, no flicker, no infinite loop.

### Manual — performance (C2 gate)

- [ ] Profiler: drag a table 2s with Schema open — no SchemaPanel memo re-runs.
- [ ] Canvas drag FPS unchanged from `main`.
- [ ] Schema tab closed — zero measurable cost (panel unmounted).

---

## §10 Files touched

| File | Change | Risk |
|---|---|---|
| `lib/parser/dsl-parser.ts` | Optional `existing*` options on `parsedToCanvasSchemaMeta` | Low — backwards-compatible |
| `lib/schema-namespace.ts` | **New** — `splitSchemaName` moved out of the generator | Low |
| `lib/generator/dbml-generator.ts` | Import + re-export the moved helper | Low — no behavior change |
| `components/diagram-general/code-editor.tsx` | Pass existing enums / groups into the meta mapper (3 lines) | Low |
| `components/diagram-general/schema-panel.tsx` | **New**, ~350 lines | Isolated |
| `components/diagram-general/dock-panel.tsx` | One `else if` branch | Low |
| `hooks/use-diagram-autosave.ts` | Phase 5 only — 3 selectors | Low |
| `lib/__tests__/dbml-roundtrip.test.ts` | New cases | — |

**Not touched:** `useCanvasStore.tsx` (no new fields, no new actions), `useDockStore.tsx`,
`capabilities-context.tsx`, `page.tsx`, `canvas.tsx`, `use-cloud-autosave.ts`, `convex/schema.ts`,
`diagram-envelope.ts`, anything under `components/documentation/`.

That list is the strongest evidence for C1: the highest-traffic files in the app are untouched, and
the change is one new panel plus a targeted parser fix.
