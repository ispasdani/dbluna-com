# DBML Documentation: Phase 2 Enhancements

This plan outlines the next phase of development for the DBML Documentation tool, aiming to match and exceed the premium features found in tools like `dbdocs.io`.

## Goal Description
Enhance the existing "DBML Docs" workspace mode to support comprehensive Project Overviews, logical Table Grouping, interactive Enum definitions, and focused table-centric mini-diagrams. This will significantly improve the navigation and readability of massive database schemas.

## User Review Required

> [!IMPORTANT]
> **Priority Decision:** The mini-diagrams (Rendering a small visual graph inside the documentation page) will require integrating `reactflow` or a secondary instance of our custom `CanvasStage`. If we use our custom Canvas, it might introduce state complexities since it shares the Zustand store. I recommend we implement it using a lightweight, read-only graph renderer instead. Do you approve this approach?

> [!WARNING]
> Please review the order of operations below. If any specific feature like "PDF Exports" is more critical for you right now, let me know, and I can swap priorities!

## Proposed Changes

### 1. Data Store & Parsing Enhancements
To support new DBML features, we must upgrade how we parse and store the AST.

#### [MODIFY] `store/useDocumentationStore.ts`
- Extend the state model to explicitly track `projectNode` (for README generation), `tableGroups` (for sidebar categorization), and `enums` (for property tooltips).

#### [MODIFY] `lib/generator/dbml-generator.ts`
- Ensure our automated Canvas Sync accounts for Enums or groupings if we choose to add them visually in the future.

---

### 2. Project Overview (The "README")
When no specific table is selected from the sidebar, the user should be presented with a beautiful, Markdown-powered homepage detailing the whole database architecture.

#### [MODIFY] `components/documentation/documentation-viewer.tsx`
- Conditionally render a `<ProjectOverview />` component if `activeTable` is null.

#### [NEW] `components/documentation/project-overview.tsx`
- Parses `parsedDbml.project.note` using `react-markdown` to render the homepage.

---

### 3. Folder/TableGroup Categorization
Massive schemas need organization. DBML natively supports `TableGroup`.

#### [MODIFY] `components/documentation/docs-sidebar.tsx`
- Read the `tableGroups` from the DBML AST.
- Refactor the flat list of tables into an expandable folder structure, clustering tables based on their defined `TableGroup`, mirroring our Object Explorer's aesthetics.
- Orphan tables (without a group) remain at the root level.

---

### 4. Focused Table Mini-Diagrams
Adding visual relational graphs at the bottom of the table documentation plane.

#### [MODIFY] `components/documentation/relationship-view.tsx`
- Underneath the current "Incoming/Outgoing" text lists, inject a visual graph.
- We will construct a minimal dependency graph showing the `ActiveTable` in the center, bridging visually to its deeply linked neighbors.

---

### 5. Enums & Interactive Tooltips
Allow developers to easily inspect acceptable values for columns.

#### [MODIFY] `components/documentation/table-view.tsx`
- Identify columns utilizing an Enum type instead of a standard primitive.
- Parse the `enums` dictionary and attach a Hover Card / Tooltip to the data type UI Pill that lists all enum values cleanly.

## Open Questions

> [!CAUTION]
> Integrating deep-linking (URL anchors like `?table=users`) will forcefully push states into the browser history. Does the Desktop Electron container process Next.js router history smoothly during local packaging, or should we keep state fully strictly inside Zustand for now?

## Verification Plan

### Automated Tests
- Run `npm run lint` and `npm run build` to ensure the extended AST parsing does not throw type errors.

### Manual Verification
1. Open the Desktop Workspace, write a DBML string containing a `Project { Note: '...' }` and a `TableGroup`.
2. Verify the Sidebar dynamically adopts the folder structure.
3. Deselect tables and verify the Project README renders beautifully.
4. Open a highly connected table and manually test the clarity of the new mini-diagram.
