# DBML Docs Integration — Release 1.0 Implementation Plan

## Context

The "DBML Docs" workspace mode ([`components/documentation/`](../components/documentation/)) is currently a
disconnected island. It is essentially a **second, parallel DBML implementation** that barely
touches the rest of the app. This plan unifies it with the canvas so DBML becomes a single,
persisted, live source of truth across the product.

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

### Problems this plan solves

1. **Two independent DBML engines that diverge.** The canvas code editor
   ([`components/diagram-general/code-editor.tsx`](../components/diagram-general/code-editor.tsx))
   has its own inline generator/parser that emits **no relationships and no notes**, while
   [`lib/generator/dbml-generator.ts`](../lib/generator/dbml-generator.ts) preserves schema
   prefixes, `Ref:` relationships, and table notes. Same schema → different DBML depending on the panel.
2. **Docs DBML is ephemeral.** `dslCode` is a local `useState` in `docs-layout.tsx`. It resets to
   the hardcoded sample on every mode switch and is never written to Convex.
3. **Sync is one-way and lossy.** Canvas → Docs works on button press only. Docs → Canvas does not
   exist. Even the one-way path drops enums/tableGroups because `generateDbmlFromCanvas()` never
   emits them, despite the parser, store, and sidebar fully supporting them.
4. **Two editor libraries shipped** (Monaco for docs, CodeMirror for canvas), doubling bundle and
   maintenance surface. The docs viewer's only error handling is a dead-end "DBML Syntax Error" screen.

---

## Goal

Make DBML a **single source of truth**: one generator, one parser, persisted with the diagram, and
live-synced between the canvas and the docs view — with enums and table groups flowing end-to-end.

Sequencing principle: **unify → persist → make it live**. Step 1 is the root fix that unlocks the rest.

---

## Proposed Changes

### 1. Single source of truth for DBML  *(highest leverage — do first)*

Consolidate both panels onto the shared generator/parser in `lib/`.

#### [MODIFY] `components/diagram-general/code-editor.tsx`
- Delete the inline DBML generation block (currently ~L135–L151) and call
  `generateDbmlFromCanvas(tables, relationships)` instead.
- Delete the inline `Parser.parse()` + table-mapping block (~L177–L227) and route through
  `parseDbml()`, mapping the shared `ParsedDbmlResult` back onto canvas tables.
- Keep the CodeMirror DBML linter (~L77) — it becomes the shared diagnostics source (see step 5).

#### [MODIFY] `lib/generator/dbml-generator.ts`
- This becomes the **only** generator. Confirm it round-trips cleanly through `parseDbml()` (schema
  prefixes, `Ref:` relationships, notes). Add regression coverage (step 7).

#### [VERIFY] `lib/parser/dsl-parser.ts`
- Confirm the `ParsedDbmlResult → canvas Table[]` mapping (positions preserved for existing tables,
  staggered placement for new ones — logic currently living in `code-editor.tsx` ~L191–L222) is
  extracted into a reusable helper so both panels share it.

**Outcome:** relationships, notes, schema prefixes, enums, and groups render identically everywhere.

---

### 2. Persist the docs DBML

#### [MODIFY] `store/useDocumentationStore.ts`
- Add `dslCode: string` + `setDslCode()` to the store (lift it out of `docs-layout.tsx`'s local state).

#### [MODIFY] `components/documentation/docs-layout.tsx`
- Replace the local `useState(dslCode)` with the store value.
- Remove the hardcoded sample as the *persisted* default — use it only as a first-run placeholder
  when the diagram has no saved DBML yet.

#### [MODIFY] `convex/schema.ts` + `convex/diagrams.ts`
- Add a `dbmlSource` (optional string) field to the diagram document and a mutation to persist it.

#### [MODIFY] `hooks/use-diagram-autosave.ts`
- Include `dbmlSource` in the debounced autosave payload so docs survive reloads and mode switches,
  matching how the canvas already persists.

---

### 3. Make Canvas ↔ Docs live and bidirectional

#### [MODIFY] `components/documentation/docs-layout.tsx`
- Replace the manual **"Sync from Canvas"** button with a reactive derivation: subscribe to
  `useCanvasStore` (tables + relationships) and regenerate DBML automatically on change.
- Keep an explicit "reset to canvas" affordance for when the user has hand-edited the DBML and wants
  to discard divergence.

#### [MODIFY] `components/documentation/docs-layout.tsx` (Docs → Canvas)
- On valid DBML edits, run `parseDbml()` → shared mapping helper → `useCanvasStore.setTables()`,
  giving true two-way editing (the code editor already proves this round-trip works).
- Guard against feedback loops using the existing `isTypingRef` pattern from `code-editor.tsx`.

---

### 4. Emit Enums & TableGroups from the canvas

The parser, store, and sidebar already handle enums/groups; the generator does not produce them.

#### [MODIFY] `lib/generator/dbml-generator.ts`
- Emit `Enum` blocks and `TableGroup` blocks from canvas data.

#### [MODIFY] `store/useCanvasStore` (as needed)
- Extend the canvas data model to represent enums and table groups if not already present, so they
  can be generated into DBML and round-tripped.

**Outcome:** canvas-generated docs gain the folder structure and enum tooltips the docs UI was
already built for.

---

### 5. Standardize on one editor library

#### [MODIFY] `components/documentation/docs-layout.tsx`
- Replace the Monaco `<Editor>` with the CodeMirror-based editor used by the canvas so both panels
  share the same DBML linter and diagnostics.
- This replaces the dead-end "DBML Syntax Error" screen in
  [`components/documentation/documentation-viewer.tsx`](../components/documentation/documentation-viewer.tsx)
  with inline, line-level error reporting.

#### [REMOVE] `@monaco-editor/react`
- Drop the dependency from `package.json` once docs no longer use it.

---

### 6. Deep-linking + export  *(product polish — do last)*

Carried over from the Phase 2 plan's open items.

#### [MODIFY] `components/documentation/docs-sidebar.tsx` + docs viewer
- Support URL anchors (e.g. `?table=users`) for shareable deep links. Low-risk once state is
  persisted (step 2). Validate history behavior inside the Desktop/Electron container.

#### [NEW] export path
- Add Markdown / PDF export of the rendered documentation, turning docs into a shareable "publish"
  step.

---

### 7. Tests & regression coverage

#### [NEW] generator/parser round-trip tests
- `generateDbmlFromCanvas()` → `parseDbml()` → mapping must preserve tables, columns, constraints,
  relationships, notes, enums, and table groups.
- Snapshot the DBML output for a representative multi-schema fixture to catch generator drift.

---

## Sequencing / Milestones

| Order | Step | Why here |
|-------|------|----------|
| 1 | **§1 Single source of truth** | Root fix; unlocks everything else |
| 2 | **§7 Round-trip tests** | Lock the unified engine before building on it |
| 3 | **§2 Persist docs DBML** | Makes docs a real diagram artifact |
| 4 | **§3 Live bidirectional sync** | Depends on unified engine + persistence |
| 5 | **§4 Enums & TableGroups** | Fills the last generator gap |
| 6 | **§5 One editor library** | Cleanup once behavior is unified |
| 7 | **§6 Deep-linking + export** | Product polish, safe after persistence |

---

## Verification Plan

### Automated
- `npm run lint` and `npm run build` pass with no type errors.
- Round-trip tests (§7) pass for the multi-schema fixture.

### Manual
1. In canvas mode, build a schema with relationships, a note, an enum, and a table group. Switch to
   Docs mode — DBML matches exactly, sidebar shows the group folders, enum tooltips render.
2. Edit DBML in Docs mode — the canvas updates live (two-way).
3. Reload the diagram — docs DBML persists (no reset to the hardcoded sample).
4. Introduce a DBML syntax error — inline line-level diagnostics appear (no dead-end error screen).
5. Deep-link to `?table=<name>` — the correct table doc opens; verify history behaves in the Desktop
   container.

---

## Open Questions

- **Canvas data model for enums/groups (§4):** does `useCanvasStore` need new first-class structures,
  or do we infer groups from schema prefixes as `generateDbmlFromCanvas` already does for schemas?
- **Two-way conflict policy (§3):** when both canvas and hand-edited DBML diverge, which wins? Proposal:
  canvas is authoritative unless the user is actively editing DBML (mirroring `isTypingRef`).
- **Electron router history (§6):** confirm Next.js router history is safe inside the local Desktop
  package before enabling URL anchors.
