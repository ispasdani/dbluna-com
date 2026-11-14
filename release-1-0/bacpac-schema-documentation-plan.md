# BACPAC schema mapping and searchable documentation

## Outcome

A user imports a SQL Server BACPAC, opens **DBML Docs**, and can browse the database by schema, search its objects and descriptions, and follow dependencies to understand how the database fits together. The canvas remains the table relationship map. Both views derive their content from the same persisted diagram. Extraction, search, diagrams, and documentation export use deterministic code and require no LLM or access to the table data in the archive.

## Current implementation

- The [BACPAC dialog](../components/diagram-sections/import-schema-dialog.tsx) extracts `model.xml` in the browser and posts it to the authenticated [import route](../app/api/import-bacpac/route.ts). The SAX parser captures basic column information and holds a single column pair per foreign key. The dialog assigns default cardinality and referential actions.
- The [DBML generator](../lib/generator/dbml-generator.ts), [DBML parser](../lib/parser/dsl-parser.ts), and [Convex validators](../convex/schema.ts) also use single-column relationship endpoints. The [namespace helper](../lib/schema-namespace.ts) derives names from display strings, and the DBML parser treats `public` as its default schema.
- [Docs](../components/documentation/docs-layout.tsx) currently generates and parses DBML from the canvas. The [sidebar](../components/documentation/docs-sidebar.tsx) matches table, column, and enum names. The [Markdown generator](../lib/generator/docs-markdown.ts) renders tables and relationships but drops schema identity from relationship endpoints.

## 1. Preserve SQL Server metadata at import

- Extract a pure, typed parser from the route. Read object and relationship context by XML nesting. Collect named objects first and resolve references in a second pass so input order does not affect the result. Keep the existing archive upload and import entry points.
- Preserve schema and identifier as distinct values. Decode escaped brackets and preserve literal dots, spaces, and case. Use object IDs or structured qualified names for lookup. Keep explicit `public` distinct from an unqualified object.
- Capture complete type declarations, including lengths such as `nvarchar(max)`, precision and scale such as `decimal(19,4)`, and schema-qualified alias types. Capture nullability, identity, computed expressions, and defaults. Surface unresolved types rather than substituting `VARCHAR`.
- Store PK and unique constraints as ordered sets of columns. Store each FK as one named constraint with ordered source and target columns and its `ON UPDATE` and `ON DELETE` actions. Derive relationship cardinality from declared uniqueness where supported. Show an unknown value when metadata is insufficient.
- Read table and column `MS_Description` extended properties when present. Record them as source descriptions and retain existing notes for user-authored context.
- Inventory schemas, tables, views, indexes, constraints, user-defined types, procedures, functions, triggers, sequences, and synonyms when present in the package. Bring views, indexes, types, and constraints into the first documentation release. Add the other object detail pages after the inventory works. Extract available definitions and declared dependencies. Mark unsupported objects and unresolved references in the import preview with counts and examples. Treat runtime dependencies such as dynamic SQL as unknown when the package cannot establish them.

## 2. Carry fidelity through storage and export

- Extend canvas and persisted diagram types with optional structured SQL Server metadata. Add ordered relationship endpoints while continuing to read existing `sourceColumnId` and `targetColumnId` as one-column relationships. Update live and snapshot validators, autosave, restore, JSON import/export, and sharing where they consume the diagram shape. Load older diagrams without a bulk migration.
- Update relationship editing, deletion, and rendering to use all endpoint columns. Draw one canvas edge per constraint and show the ordered pairs in its details. Keep qualified names and authored notes intact across edits, reloads, and version restores.
- Emit and read composite constraints and refs in DBML where the format supports them. Keep the persisted diagram as the documentation source for metadata that DBML cannot represent. Check the code editor round-trip so an ordinary DBML edit preserves SQL Server metadata for surviving objects. Make any format-specific omissions visible at export.
- Build a documentation projection from the diagram and its stored metadata. Reuse the existing docs components and navigation, with a shared qualified identity for docs links, the relationship graph, and Markdown export. Keep existing DBML tables, enums, notes, and table groups available for diagrams from other sources.

## 3. Make the documentation easy to explore

- Start with a database overview listing schemas, object counts, and import coverage. Group the sidebar by schema and object type. Keep the current **DBML Docs** entry point and access rules.
- Build a local search index when the documentation projection changes. Match schema-qualified and short names, columns, types, constraints, indexes, source descriptions, and authored notes. For views and other objects with definitions, include definition text and show the matching excerpt. Rank exact and prefix name matches ahead of text matches. Offer schema and object-type filters and keep the owner visible on every column or constraint result.
- Make results keyboard-accessible and link directly to the matching object, column, or constraint. Use stable qualified identities for deep links and support browser back and forward navigation. Keep results usable for repeated names such as `sales.Orders` and `archive.Orders`.
- Give each table a summary, column dictionary, keys and indexes, and incoming and outgoing relationships. Show composite FK columns in order alongside their update and delete actions. Give views and routines their available definitions, dependencies, and reverse links. Present imported descriptions and authored notes together with their provenance. Render imported text and definitions as text.
- Extend Markdown export with qualified headings and internal links, object summaries, constraints, relationship pairs and actions, and coverage notes. Keep JSON as the export used to preserve the full imported model. Validate that the existing viewer and export agree on object counts and relationship endpoints.

## 4. Delivery and verification

| Milestone | Exit criteria |
| --- | --- |
| Import and persistence | A scrubbed or synthetic package with duplicate table names across schemas, bracket escapes, parameterized types, composite PKs and FKs, all supported referential actions, and descriptions survives import, reload, JSON round-trip, and version restore with the same metadata. Existing diagrams and single-column relationships still open and edit. |
| Searchable reference | A user can find a table by qualified name, find a column by its description, jump to a constraint, and follow incoming and outgoing links. Keyboard navigation and direct links work for objects with identical short names. The canvas shows one edge per FK constraint. |
| Broader object coverage | Views, indexes, types, and constraints appear in browse, search, and export. Routines, triggers, sequences, and synonyms gain dedicated views where their metadata is available. Unsupported or unresolved objects are visible in the import coverage summary. |

Use a synthetic `model.xml` fixture for parser edge cases and a small SQL Server-generated BACPAC for end-to-end verification. Compare the generated reference with the source database catalog for names, type declarations, column order, constraints, actions, and descriptions. Exercise malformed XML, absent descriptions, dangling references, and legacy diagrams. Measure import time, search index build time, and keystroke latency on a representative large schema before deciding whether search needs a worker or results need virtualization.
 
## Verification status

- The parser processed Microsoft's Wide World Importers Standard BACPAC and found 48 tables, 98 foreign keys with zero unresolved, 41 column defaults, 111 indexes and unique constraints, and 76 additional schema objects.
- The JSON regression test checks preservation of imported object metadata. The synthetic search benchmark averaged about 5.9 ms for a fully qualified name and 2.0 ms for a filtered description across 1,000 tables and 30,000 columns. These timings measure the search function.
- The authenticated browser flow, cloud save and restore, and comparison with a running SQL Server catalog still require end-to-end verification.
