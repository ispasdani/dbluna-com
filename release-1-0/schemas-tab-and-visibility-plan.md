# Schemas Tab, Visibility & Schema Graph — Implementation Plan

## Context

A real customer schema (LeanLinking, SQL Server) landed on the canvas at **428 tables / 672
relationships**. The app renders and drives it — drawDB could not move a table at that size — but it
is visually unusable: at fit-zoom every card genuinely is on screen, so viewport culling cannot help
(see the comment at [`canvas.tsx:1635`](../components/diagram-sections/canvas/canvas.tsx)), and 672
edges in one world-sized `<svg>` read as a hairball.

The clutter is three separate problems. This plan addresses the first, and gives the user an entry
point into the diagram:

1. **Too many cards.** Fixed by filtering — this plan.
2. **The edge hairball.** Fixed by edge LOD and hub-edge collapse — *not* this plan.
3. **No entry point.** Fixed by the schema graph — this plan, Phase 3.

### What already exists

| Piece | Where | State |
|---|---|---|
| Schema grouping | `groupTablesBySchema()` in [lib/schema-namespace.ts](../lib/schema-namespace.ts) | Done |
| Schema list UI, rename, move-table | `Schemas()` at [database-panel.tsx:250-491](../components/diagram-general/database-panel.tsx) | Done |
| `arrange by schema`, packing each schema into its own block | [lib/auto-arrange.ts](../lib/auto-arrange.ts) | Done |
| Reserved `GROUP_HEADER = 56` strip above each schema block | `lib/auto-arrange.ts` | Reserved, draws nothing |
| Viewport culling, table LOD | `canvas.tsx` | Done |
| 2-degree focus mode | [hover-highlight.ts:179](../components/diagram-sections/canvas/hover-highlight.ts) | Done (selection-driven, dims) |

### What is missing

- **`hiddenSchemas`** — does not exist anywhere in the codebase (grepped). Designed and deferred on
  2026-09-13 out of the naming+grouping pass.
- **The canvas honouring visibility** — tables, their edges, their minimap dots, fit-to-screen,
  marquee selection.
- **Schema-level relationships** — "which schema talks to which, and how much". Nothing derives this.
- **A UI home that can grow.** `Schemas()` is a section inside a settings tab; the feature is about to
  become the primary navigation control for large diagrams.

## Design decisions (recorded)

**D1 — Schemas stay derived, never an entity.** A schema is the prefix inside `Table.name`
(`"Action.ActionComplianceRelation"`). This is what kept [schema-tab-plan.md](./schema-tab-plan.md)
low-risk: "no new persisted fields, no new store slice, no new sync path." A `Schema` entity would
mean a Convex change, envelope validation and a reconciliation pass on every DBML re-parse, for no
modelling gain — DBML has no schema declaration to round-trip.

**D2 — Visibility is view state, not content.** `hiddenSchemas` is keyed by schema *name*, never a
per-table `isHidden` flag (which would need explicit carry-over in `parsedTablesToCanvasTables`, the
place that preserves `x`/`y`/`color`/`isLocked` across a re-parse, plus a Convex change). It lives in
`useEditorStore` beside the camera: private per browser, no cloud sync, no autosave churn. Zoom, not
content.

**D3 — Schemas get their own dock tab.** `Enums` already split out of the original single
"everything above table level" tab, so the precedent is set. Adding a tab is near-free here:
`ALL_TAB_IDS` is derived from `TABS`, `FREE_TAB_IDS = ["code"]` so a new tab is Pro-gated
automatically ([page.tsx:42](../app/(diagram)/d/[id]/page.tsx)), and `useDockStore` has **no persist
middleware** — there is no stored tab layout to migrate.

**D4 — The Database tab survives, thinner.** `project.name` / `databaseType` / `note` round-trip as
the DBML `Project` block and are genuinely database-level. Database = the database's identity;
Schemas = the namespaces inside it. That also resolves the naming collision noted at
`useDockStore.tsx:14`.

**D5 — Panel manages, toolbar switches.** A dock panel is the wrong place to change what is on screen
while navigating. The checkboxes live in the panel *and* a `Schemas 3/8` chip lives in the floating
toolbar next to Arrange. One state, two surfaces.

**D6 — The Schemas tab owns every grouping axis above the table level.** Schema prefix (derived, from
the database), `tableGroups` (explicit, user-authored — and today it has **no authoring UI at all**;
every `setTableGroups` call site is the DBML parse path or a rename transaction), and later FK
clusters (computed, for schema-less databases). Three sources, one panel, one visibility model.

## Guiding constraints

**C1 — No regressions.** The DBML round-trip, Docs mode, cloud sync, share links, the plan gate, the
Code tab and SVG/PNG export behave exactly as they do today for a diagram with nothing hidden.

**C2 — No cost on the drag path.** `updateTablePos` / `moveTables` write `tables` on every
pointermove. §7 is the binding section; it is the most likely place this work regresses the canvas.

**C3 — Nothing hidden is unreachable.** Every path that focuses a table (Issues panel, Tables panel,
search, AI) must still land on it. Hiding is a view, not a deletion.

## Non-goals

- Edge LOD, hub-edge collapse, persistent focus mode. Separate work, separate plan.
- Per-schema table *positions* (true layers). `arrange by schema` already packs each schema into a
  contiguous block, so filtering leaves tight districts rather than sparse islands — the layout axis
  and the filter axis already agree. Revisit only if that stops being true.
- Splitting a database across multiple diagrams. Cross-schema FKs have nowhere to live and the DBML
  round-trip stops recomposing. A one-way "extract selection to new diagram" is a different feature.
- Making schemas first-class in Convex. See D1.

---

## Phase 0 — Extract `Schemas()` into its own tab

Pure refactor. No behaviour change, no new state.

1. `TabId` union + `TABS` entry in [store/useDockStore.tsx](../store/useDockStore.tsx):
   `{ id: "schemas", label: "Schemas", icon: "Layers" }`. Place it next to `database`.
2. New `components/diagram-general/schemas-panel.tsx`. Move `Schemas()` and its helpers
   (`uniqueName`, `useTableColors`, `PREVIEW_TABLES`, the schema-specific styles) out of
   `database-panel.tsx:250-491`. `useTableColors` is used by both — move it to a shared module or
   duplicate it deliberately with a comment; do not import one panel from the other.
3. One `else if` branch in [dock-panel.tsx](../components/diagram-general/dock-panel.tsx). Static
   import, matching every other panel.
4. `database-panel.tsx` keeps `ProjectCard` and the stats card. Leave the `schemaCount` stat where it
   is — a count belongs on the database summary.

Gating needs no change (D3). The generic `activeTabInfo` fallback in `dock-panel.tsx` means step 1
alone does not crash.

**Verify:** both tabs render, drag, dock, close and reopen; rename and move-table still work from the
new tab; `schema-organization.test.ts` and `schema-namespace.test.ts` untouched and green.

---

## Phase 1 — `hiddenSchemas` and the canvas

### 1a. State

In [store/useEditorStore.tsx](../store/useEditorStore.tsx), beside `cameras`:

```ts
// Per-diagram, mirroring `cameras`. Schema names, not table ids — see D2.
hiddenSchemas: Record<string, string[]>;
setSchemaHidden: (schema: string, hidden: boolean) => void;
setHiddenSchemas: (schemas: string[]) => void;   // bulk: "only this one", "show all"
renameHiddenSchema: (from: string, to: string) => void;
```

All three act on `activeDiagramId`. Nothing is added to `useCanvasStore`, so `CanvasFields`,
`DiagramData`, `diagram-envelope.ts` and `convex/schema.ts` are untouched — that is the whole point of
D2.

**A module-level `EMPTY_HIDDEN: string[] = []` sentinel is mandatory.** The canvas subscribes to this;
returning a fresh `[]` for a diagram with no entry would hand it a new array identity on every render
and invalidate everything downstream. Same trick as `NO_SELECTION` in `useCanvasStore`.

```ts
const hidden = useEditorStore((s) => s.hiddenSchemas[s.activeDiagramId ?? ""] ?? EMPTY_HIDDEN);
```

**Stale entries are pruned on read, not on write.** A schema that no longer exists (its last table was
renamed away) leaves a harmless orphan name. Intersecting with live schema names at the point of use
avoids a migration and avoids writing to the store as a side effect of rendering.

### 1b. The filter, and the one mechanic that matters

In `canvas.tsx`, derive two things — in this order:

```ts
// Which schema each table belongs to, memoised on a NAME signature, not on
// `tables`. Rebuilt on a rename, never on a drag. See §7.
const schemaByTableId = useMemo(..., [nameSignature]);

// Identity-stable when nothing is hidden: returns `tables` itself, so every
// downstream memo behaves exactly as it does today. See C1 and §7.
const visibleTables = useMemo(
  () => (hidden.length === 0 ? tables : tables.filter(...)),
  [tables, hidden, schemaByTableId]
);
```

Then swap `tables` → `visibleTables` at exactly four places:

| Line | What | Effect |
|---|---|---|
| `canvas.tsx:1877` | `tables.map(...)` render loop | cards disappear |
| `canvas.tsx:786` | `minimapTables` | minimap dots disappear (the `Minimap` takes tables as a prop, so nothing inside it changes) |
| `canvas.tsx:1521` | marquee `tables.forEach(...)` | a marquee cannot select what it cannot see |
| `canvas.tsx:784` | `tablesById` | **edges disappear for free** |

That last row is the mechanic. `tablesById` feeds only `getLiveTablePosition`, and the
`routedRelationships` memo already does `if (!a || !b) continue;` for an unresolvable endpoint. Filter
the map and every edge touching a hidden table drops out of routing, out of the DOM, out of
`portsByTable`, and out of the hover/focus highlight sets — with no new code and no second filter to
keep in sync.

### 1c. Camera helpers

- `fitDiagramOnCanvas` ([use-diagram-issues.ts:131](../components/diagram-general/use-diagram-issues.ts))
  reads `useCanvasStore.getState()` directly. It must apply the same filter, or "fit" frames empty
  space where a hidden schema sits. It is called after every arrange, so this is visible immediately.
  *Note:* `notes` and `areas` are not schema-scoped and stay in the bounds.
- `focusTableOnCanvas` / `focusRelationshipOnCanvas` (same file) are the C3 path. Focusing a table in a
  hidden schema must **auto-reveal that schema** before moving the camera, with a toast naming what was
  unhidden. Silently centring on nothing is the failure mode to avoid.

### 1d. Export

`computeDiagramBounds` and `captureCanvasSvg` in [lib/diagram-io.ts](../lib/diagram-io.ts) take tables
from the caller, so this is a decision, not a constraint:

- **Image / SVG export → filtered.** "Export what you see" is what makes the filter useful for
  producing per-schema documentation.
- **DBML / SQL / JSON / share link → always the full set.** A filter must never silently truncate the
  schema. Assert this in a test.

### 1e. Panel UI

An eye toggle on each schema card, plus a header row: `Show all`, `Hide all`, and `Only this` on each
card (the one people actually use). The `(no schema)` bucket toggles like any other, keyed by
`NO_SCHEMA_KEY`.

Panels do **not** filter their own lists. The Tables, Relationships and Issues panels list the model;
the canvas shows the view. A hidden-schema row gets a muted eye glyph so the disagreement is legible.

### 1f. The rename trap

Renaming a schema must rewrite `hiddenSchemas` in the same handler, or the hidden set silently points
at a name nobody has any more. `renameSchema` in `lib/schema-namespace.ts` is deliberately store-free
and returns a plan for `tables` + `tableGroups`; do **not** couple it to view state. Instead call
`renameHiddenSchema(from, to)` alongside `applyPlan` at both existing call sites:
`database-panel.tsx:317` (moving to `schemas-panel.tsx` in Phase 0) and `tables-panel.tsx:330`.

This is the same failure mode `applyRenames` already guards for `tableGroups`, and the reason that
function's docstring calls it "the single most dangerous thing this section can do."

---

## Phase 2 — Toolbar chip

A `Schemas 3/8` button in [canvas-floating-toolbar.tsx](../components/diagram-general/canvas-floating-toolbar.tsx),
beside `ArrangeMenu`, opening a popover of the same toggles. Hidden entirely when the diagram has
0 or 1 schemas — on a MySQL import there is nothing to switch.

Reads the same `useEditorStore` state. No new state, no duplication of the toggle logic — extract the
list into a small shared component used by both surfaces.

---

## Phase 3 — Schema graph

The entry point, and the most differentiating piece. Nothing in drawDB, dbdiagram or ChartDB has it.

### Derivation

New `lib/schema-graph.ts`, store-free and unit-testable under vitest's `node` environment (same
reasoning as `lib/auto-arrange.ts`):

```ts
export interface SchemaGraphNode { schema: string | null; tableCount: number; internalRefs: number; }
export interface SchemaGraphEdge { from: string | null; to: string | null; count: number; relIds: string[]; }

export function buildSchemaGraph(tables: Table[], relationships: Relationship[]): {
  nodes: SchemaGraphNode[];
  edges: SchemaGraphEdge[];
};
```

Walk `relationships`, resolve both endpoints through `splitSchemaName`, bucket the unordered pair.
Same-schema refs accumulate into the node's `internalRefs` rather than becoming a self-loop — a loop
on a node is noise, a number on it is information. Node order comes from `groupTablesBySchema` so the
graph reads in the same order as the list beside it.

### Render

A section at the top of the Schemas panel. For ~8 nodes and ~15 edges a **circular layout** is more
readable and far simpler than dagre; reach for `@dagrejs/dagre` (already a dependency) only if real
schemas turn out denser than expected.

- Node radius or badge = `tableCount`; edge stroke width = `count`, bucketed (not linear — one 60-edge
  pair would flatten everything else).
- Click a node → `setHiddenSchemas` to everything but that one, then `fitDiagramOnCanvas`. That single
  interaction is the payoff for Phases 1–3.
- Click an edge → reveal both schemas and select the relationships it represents (`relIds` is carried
  for exactly this).
- Hidden schemas render dimmed in the graph, not removed — the graph is the map, not the view.

### Perf

Memoise on a signature of table **names** plus `relationships`, never on the `tables` array. The panel
must not recompute during a canvas drag (§7).

---

## Phase 4 — Cross-schema stubs *(open decision — do not start without a call)*

With `Auth` hidden and `Billing` shown, every FK from `Billing` into `Auth` currently just vanishes.
The view becomes a filter you cannot trust: nothing on screen says whether `Billing` is self-contained.

**Recommended:** a ghost node at the view edge labelled `auth.Users`, non-interactive except to reveal
its schema. That is how a filter becomes a *view*, and it is also how a user discovers "Billing depends
on four tables in Auth."

**Cheaper interim:** a `→ 12 external` badge on each schema card and on the graph node, with no canvas
change at all.

Phases 0–3 ship and are independently valuable without either. Decide before starting; the ghost node
touches the canvas render path and inherits every compositing constraint documented around
[hover-highlight.ts](../components/diagram-sections/canvas/hover-highlight.ts) — notably that
`opacity` on a `<g>` allocates a buffer the size of the group.

---

## Phase 5 — Draw an Area per schema

`layoutBySchema` already reserves `GROUP_HEADER = 56` above every block with the comment *"Nothing
draws in it yet — it is where a per-schema Area header would sit."* Have `arrange by schema` emit one
`Area` per schema, titled with the schema name.

Cheap, and it turns a field of 428 cards into visible districts even with nothing hidden. Two details:
`Area` is content (it syncs, unlike `hiddenSchemas`), so this must go through the existing `readOnly`
gate, and the arrange confirm dialog's one-step undo must restore the areas too, not just positions.

---

## Phase 6 — Grouping source *(deferred)*

**MySQL and SQLite have no schemas** — database *is* schema — so a MySQL import gives one bucket of
428 tables and Phases 1–4 are a no-op. The fallback is FK-cluster detection (connected components,
then Louvain) synthesising groups the database never provided.

Design the panel so the grouping *source* is swappable from day one — `group by: schema /
table groups / FK clusters` — rather than hardcoding the prefix. Shipping the switcher is deferred;
not designing for it is not.

---

## §7 Performance — the drag path

`moveTables` writes `tables` on every pointermove of a canvas drag. Two rules, both non-optional:

**1. Never derive a schema from a name on the drag path.** `splitSchemaName` does an `indexOf`, two
`slice`s and a regex `replace`. Doing that 428 times per pointermove is ~25k regex ops/second for a
value that changes only on a rename. Memoise `schemaByTableId` on a cheap structural signature, the
idiom [schema-tab-plan.md §6](./schema-tab-plan.md) established and `tables-panel.tsx:57` already
carries:

```ts
// Changes on a rename, NOT when a table moves. x/y deliberately excluded.
const nameSignature = useMemo(() => tables.map((t) => `${t.id} ${t.name}`).join("|"), [tables]);
// eslint-disable-next-line react-hooks/exhaustive-deps
const schemaByTableId = useMemo(() => buildSchemaIndex(tables), [nameSignature]);
```

**2. `visibleTables` must return `tables` by identity when nothing is hidden.** This is the C1
guarantee in one line. A fresh filtered array every pointermove would invalidate `tablesById` →
`getLiveTablePosition` → `routedRelationships` → `RelationshipLayer`'s memo, rebuilding every line on
the canvas for a drag that moved one card. Three separate bugs of exactly that shape were found and
fixed on this canvas already; do not add a fourth.

### Measurement gate

Reproduce against `next build && next start`, **with the dock mounted** — a `CanvasStage`-only harness
misses the dominant cost, and selection stalls in `next dev` are a dev-build artifact (React property
validation plus DevTools walking the fiber tree on every commit).

- [ ] Drag a table for 2s on the 428-table schema with nothing hidden: frame profile identical to
      `main`, and zero re-runs of the `schemaByTableId` memo.
- [ ] Same drag with 6 of 8 schemas hidden: no worse than the unfiltered case.
- [ ] Toggling one schema: one render of `CanvasStage`, not one per table.
- [ ] Schemas panel open, drag 2s: zero panel re-renders and zero `buildSchemaGraph` re-runs.

---

## §8 Traps carried over

| Trap | Guard |
|---|---|
| A schema rename orphans `hiddenSchemas`. | §1f — `renameHiddenSchema` at both call sites. Unit-test it. |
| `public` is reserved. `DEFAULT_PARSE_SCHEMA` strips it on the way in, so `public.Users` is not round-trip stable; `validateSchemaName` already refuses it. | Do not offer it as a target. Unchanged by this plan. |
| Changing a schema prefix **in the Code tab** loses the table's position, colour, lock state and ids — `parsedTablesToCanvasTables` matches on the exact qualified name (`dsl-parser.ts:366`). | Not introduced here, but the Schemas panel is now the supported way to reorganise. Say so in the panel copy. |
| Relationships survive a rename because they key off table *ids*, never names. | Already asserted in `schema-organization.test.ts`. Keep the assertion. |
| Compositor layers on this canvas are scarce — `will-change: opacity` on ~200 relationship groups rendered the canvas **blank**. | Phase 4 only. Prefer `stroke-opacity` on leaves over `opacity` on a `<g>`. Verify visually, not by frame rate. |
| Hiding leaves `selectedTableIds` pointing at invisible tables. | Leave the selection intact (it is not a deletion) but suppress its contribution to `fitDiagramOnCanvas`, and make Delete-key handling ignore hidden ids. |

---

## §9 Verification checklist

### Automated
- [ ] New `lib/__tests__/schema-graph.test.ts`: node/edge counts on a fixture with cross-schema and
      same-schema refs; `internalRefs` not emitted as an edge; unqualified tables bucket to `null`.
- [ ] New: `renameHiddenSchema` rewrites the hidden set; a rename with nothing hidden is a no-op.
- [ ] New: stale hidden names (schema no longer present) are ignored, not crashed on.
- [ ] New: DBML / SQL / share-link export includes tables in hidden schemas (§1d).
- [ ] Existing suites green and unchanged: `schema-namespace`, `schema-organization`, `table-groups`,
      `dbml-roundtrip`, `auto-arrange`, `hover-highlight`, `share-link-roundtrip`, `canvas-export`.
- [ ] `tsc --noEmit` clean.

### Manual — regression (nothing hidden)
- [ ] Canvas drag, pan, zoom, marquee, hover glow, focus mode: indistinguishable from `main`.
- [ ] `arrange by schema` → `fit` frames the whole diagram as before.
- [ ] SVG and PNG export byte-comparable to `main` for a fixture diagram.
- [ ] Free plan: Schemas tab hidden, Code tab still editable.
- [ ] Cloud diagram: toggling a schema triggers **zero** Convex pushes (D2 — this is the acceptance
      test for visibility not being content).

### Manual — new behaviour
- [ ] Hide a schema: its cards, its edges, and its minimap dots all go. Cross-schema edges go too.
- [ ] `fit` after hiding frames only what is visible.
- [ ] Reload the page: the hidden set survives. Open the same diagram in another browser: it does not.
- [ ] Rename a hidden schema from the Schemas panel *and* from the Tables panel — it stays hidden, and
      its table groups survive.
- [ ] Issues panel → click a problem on a table in a hidden schema: the schema reveals, the camera
      lands on the table, a toast says what was unhidden (C3).
- [ ] Schema graph: click a node → canvas shows only that schema. Click an edge → both reveal, the
      relationships select.
- [ ] A diagram with no schema prefixes at all: the panel says so plainly and the toolbar chip is
      absent — no empty affordances.

---

## §10 Files touched

| File | Change | Risk |
|---|---|---|
| `store/useDockStore.tsx` | `TabId` + `TABS` entry | Low — no persist to migrate |
| `components/diagram-general/schemas-panel.tsx` | **New** — `Schemas()` moved in, plus toggles and the graph | Isolated |
| `components/diagram-general/database-panel.tsx` | `Schemas()` removed; `ProjectCard` + stats stay | Low |
| `components/diagram-general/dock-panel.tsx` | One `else if` | Low |
| `store/useEditorStore.tsx` | `hiddenSchemas` + 3 actions | Low — new slice, nothing existing reads it |
| `components/diagram-sections/canvas/canvas.tsx` | `schemaByTableId`, `visibleTables`, four swap sites | **Highest — §7 is the gate** |
| `components/diagram-general/use-diagram-issues.ts` | `fitDiagramOnCanvas` filters; `focusTableOnCanvas` auto-reveals | Medium |
| `components/diagram-general/tables-panel.tsx` | `renameHiddenSchema` beside the existing rename | Low |
| `components/diagram-general/canvas-floating-toolbar.tsx` | Schemas chip | Low |
| `lib/schema-graph.ts` | **New**, store-free | Isolated |
| `lib/diagram-io.ts` | Filtered tables for image export only | Low |
| `lib/auto-arrange.ts` | Phase 5 only — emit an Area per schema | Medium |

**Not touched:** `convex/schema.ts`, `lib/diagram-envelope.ts`, `useCanvasStore.tsx` (no new fields, no
new actions), `lib/parser/dsl-parser.ts`, `lib/generator/`, `capabilities-context.tsx`,
`hooks/use-cloud-autosave.ts`, anything under `components/documentation/`.

That list is the evidence for C1 and D2: the persistence, sync and round-trip paths are all untouched,
and the one high-risk file is high-risk for a performance reason with a measurement gate attached.

## Suggested sequencing

Phase 0 → 1 → 2 ship the clutter fix and are worth releasing on their own. Phase 3 is what makes a
428-table import a selling point rather than a stress test. Phase 4 needs a decision first, Phase 5 is
a cheap visual win at any time, Phase 6 is the answer for MySQL and can wait for a customer to need it.
