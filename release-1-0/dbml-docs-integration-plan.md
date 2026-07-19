# DBML Docs Integration — Release 1.0 Implementation Plan

## Context

The "DBML Docs" workspace mode ([`components/documentation/`](../components/documentation/)) is currently a
disconnected island — essentially a **second, parallel DBML implementation** that barely touches the
rest of the app. This plan folds it into the canvas so there is exactly one source of truth.

### Design decision (2026-07-19)

> **The canvas is the single source of truth. Docs is a pure, read-only reflection of it.**
>
> - The **canvas** (`useCanvasStore`) already persists to Convex via
>   [`hooks/use-diagram-autosave.ts`](../hooks/use-diagram-autosave.ts).
> - The **code editor** (canvas mode) is the *textual* way to edit the canvas. After §1 it parses
>   edits back into the canvas, which then autosaves. So "type DBML → update canvas → save" already works.
> - **Docs** derives its DBML live from the canvas and renders it read-only. There is **no separate
>   docs document** and **nothing new to persist** — docs persistence *is* canvas persistence.
>
> **Consequence:** for docs-only richness (Project README/overview, enums, table groups, prose notes)
> to appear *and* survive a reload, that data must be modeled on the **canvas**, because the canvas is
> the only thing we persist. This makes §3 (model enums/groups/notes on the canvas) the mechanism that
> feeds the richer docs — not an optional extra. It also means we do **not** add a separate Convex
> field for docs DBML.

### Current architecture (as-is)

```
Docs mode (workspaceMode === "docs")
  docs-layout.tsx
    ├─ Monaco editor  (local `dslCode` useState, seeded with hardcoded sample DBML — NOT persisted)
    ├─ parseDbml()            → lib/parser/dsl-parser.ts   (@dbml/core)
    ├─ generateDbmlFromCanvas → lib/generator/dbml-generator.ts   (one-way "Sync from Canvas" button)
    └─ useDocumentationStore  → DocsSidebar + DocumentationViewer

Canvas mode (workspaceMode === "diagram")
  code-editor.tsx
    ├─ CodeMirror editor
    ├─ INLINE DBML generator (does NOT reuse dbml-generator.ts)
    ├─ Parser.parse() inline  (does NOT reuse dsl-parser.ts)
    └─ useCanvasStore  (two-way bound, autosaved via use-diagram-autosave.ts)
```

### Target architecture (to-be)

```
                         useCanvasStore  ← SINGLE SOURCE OF TRUTH (persisted to Convex)
                          ▲          │
        edits (parse)     │          │  generateDbmlFromCanvas()
                          │          ▼
  code-editor.tsx  ───────┘     Docs mode (read-only reflection)
  (CodeMirror, two-way)           docs-layout.tsx
                                    ├─ derived DBML (read-only view)
                                    ├─ parseDbml() → useDocumentationStore
                                    └─ DocsSidebar + DocumentationViewer
```

### Problems this plan solves

1. **Two independent DBML engines that diverge.** *(Resolved in §1.)* The canvas code editor had its
   own inline generator/parser that emitted **no relationships and no notes**, while
   [`lib/generator/dbml-generator.ts`](../lib/generator/dbml-generator.ts) preserves schema prefixes,
   `Ref:` relationships, and table notes. Same schema → different DBML depending on the panel.
2. **Docs is a disconnected island.** `dslCode` is a local `useState` in `docs-layout.tsx` seeded
   with a hardcoded sample; it ignores the real canvas except for a manual one-way "Sync from Canvas"
   button, and resets on every mode switch.
3. **Canvas → Docs is one-way, manual, and lossy.** It only runs on button press, and
   `generateDbmlFromCanvas()` drops enums/tableGroups because the canvas has no model for them —
   despite the parser, store, and sidebar fully supporting them.
4. **Two editor libraries shipped** (Monaco for docs, CodeMirror for canvas), doubling bundle and
   maintenance surface. The docs viewer's only error handling is a dead-end "DBML Syntax Error" screen.

---

## Goal

One DBML engine, canvas as the single source of truth, and docs as a live read-only reflection —
with enums, table groups, and project notes modeled on the canvas so they flow into docs and persist.

Sequencing principle: **unify the engine → make docs a live reflection → enrich the canvas model**.

---

## Proposed Changes

### 1. Single source of truth for DBML  ✅ DONE

Consolidated both panels onto the shared generator/parser in `lib/`.

#### [DONE] `lib/parser/dsl-parser.ts`
- Added `parsedTablesToCanvasTables()` — the parsed-DBML → canvas `Table[]` mapping (previously inline
  in `code-editor.tsx`), with **schema-qualified name reconstruction** so `Table "dbo"."Users"`
  round-trips back to the canvas name `dbo.Users` instead of collapsing to `Users`.

#### [DONE] `components/diagram-general/code-editor.tsx`
- Canvas → Code now calls `generateDbmlFromCanvas(tables, relationships)` (emits `Ref:` relationships,
  schema prefixes, and table notes the old inline generator dropped).
- Code → Canvas now calls `parseDbml()` + `parsedTablesToCanvasTables()`.
- CodeMirror DBML linter retained as the diagnostics source.

**Verified:** `next build` passes; TypeScript clean.

---

### 2. Make Docs a live, read-only reflection of the canvas  *(do next)*

Remove the docs island. Docs derives its DBML from the canvas reactively and renders it read-only.
No new persistence — the canvas already autosaves to Convex.

#### [MODIFY] `components/documentation/docs-layout.tsx`
- Delete the local `dslCode` `useState` and the hardcoded sample seed.
- Subscribe to `useCanvasStore` (tables + relationships) and derive the DBML via
  `generateDbmlFromCanvas()` in a `useMemo`, so docs update automatically as the canvas changes.
- Feed the derived DBML through `parseDbml()` → `setParsedDbml()` (drives the sidebar + viewer).
- Remove the manual **"Sync from Canvas"** button (sync is now automatic).
- Make the editor pane **read-only** (a DBML preview of the canvas). Editing happens only in the
  canvas code editor. *(Alternative: drop the editor pane entirely and show sidebar + viewer only —
  see Open Questions.)*

#### [MODIFY] `components/documentation/documentation-viewer.tsx`
- The "DBML Syntax Error" empty state becomes an "empty canvas" state — a reflection of an empty
  canvas is empty docs, not a syntax error (the canvas can't generate invalid DBML).

**Outcome:** docs always match the canvas, survive reloads (because the canvas does), and require no
extra backend. The README/enum/group features already built into the docs viewer render as soon as
the canvas can supply that data (§3).

---

### 3. Model Enums, TableGroups & notes on the canvas  *(unlocks rich docs)*

Docs is a reflection, so its richer sections can only show data the canvas holds. Give the canvas a
model for the things DBML docs already knows how to render.

#### [MODIFY] `store/useCanvasStore` + `lib/generator/dbml-generator.ts`
- Extend the canvas model to represent **enums** and **table groups** (and surface the existing table
  `comment`/notes and a project-level note/README).
- Emit `Enum` blocks, `TableGroup` blocks, and `Project { Note }` from `generateDbmlFromCanvas()`.

#### [MODIFY] `lib/parser/dsl-parser.ts`
- Extend `parsedTablesToCanvasTables()` (or add sibling mappers) so enums/groups/notes round-trip from
  edited DBML back onto the canvas model.

**Outcome:** canvas-authored enums/groups/notes flow into docs (folders, enum tooltips, README) and
persist automatically via canvas autosave.

---

### 4. Standardize on one editor library

#### [MODIFY] `components/documentation/docs-layout.tsx`
- Replace the Monaco `<Editor>` with the CodeMirror-based read-only view (shared theme + DBML
  highlighting). If §2 drops the docs editor pane entirely, this is moot.

#### [REMOVE] `@monaco-editor/react`
- Drop the dependency from `package.json` once docs no longer use Monaco.

---

### 5. Tests & regression coverage

#### [NEW] generator/parser round-trip tests
- `generateDbmlFromCanvas()` → `parseDbml()` → `parsedTablesToCanvasTables()` must preserve tables,
  columns, constraints, relationships, schema prefixes, notes, enums, and table groups.
- Snapshot the DBML output for a representative multi-schema fixture to catch generator drift.

---

### 6. Deep-linking + export  *(product polish — do last)*

#### [MODIFY] `components/documentation/docs-sidebar.tsx` + docs viewer
- Support URL anchors (e.g. `?table=users`) for shareable deep links. Low-risk now that docs state is
  derived from the persisted canvas. Validate history behavior inside the Desktop/Electron container.

#### [NEW] export path
- Add Markdown / PDF export of the rendered documentation — the shareable "publish" step.

---

## Sequencing / Milestones

| Order | Step | Status | Why here |
|-------|------|--------|----------|
| 1 | **§1 Single source of truth** | ✅ done | Root fix; unifies the engine |
| 2 | **§2 Docs = live read-only reflection** | next | Removes the island; small, high-value |
| 3 | **§5 Round-trip tests** | after §2 | Lock the unified engine before enriching it |
| 4 | **§3 Enums / groups / notes on canvas** | | Makes rich docs possible + persisted |
| 5 | **§4 One editor library** | | Cleanup once docs is read-only |
| 6 | **§6 Deep-linking + export** | | Product polish |

---

## Verification Plan

### Automated
- `npm run build` passes with no type errors.
- Round-trip tests (§5) pass for the multi-schema fixture.

### Manual
1. In canvas mode, build a schema with relationships and a note. Switch to Docs — DBML matches exactly
   and updates live as the canvas changes; no "Sync" button needed.
2. Edit DBML in the canvas code editor — the canvas updates and the change reflects in Docs.
3. Reload the diagram — canvas and docs both persist (no reset to the hardcoded sample).
4. (After §3) Add an enum / table group / project note on the canvas — sidebar folders, enum tooltips,
   and the README render in Docs and survive reload.
5. (After §6) Deep-link to `?table=<name>` — the correct table doc opens; verify Desktop history.

---

## Open Questions

- **Docs editor pane (§2):** keep a **read-only** DBML preview in docs, or **remove** the editor pane
  entirely so docs is purely sidebar + viewer? Read-only preview is friendlier for "show me the DBML";
  removal is cleaner and lighter.
- **Canvas model for enums/groups (§3):** first-class structures in `useCanvasStore`, or infer groups
  from schema prefixes (as `generateDbmlFromCanvas` already does for schemas)? Enums and a project
  README note have no current canvas representation and need a real model.
- **Electron router history (§6):** confirm Next.js router history is safe inside the local Desktop
  package before enabling URL anchors.
