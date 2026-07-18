# Graph Report - D:\Officials\dbluna-com  (2026-07-18)

## Corpus Check
- 203 files · ~106,878 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 889 nodes · 1765 edges · 92 communities (50 shown, 42 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 21 edges (avg confidence: 0.73)
- Token cost: 269,964 input · 0 output

## Community Hubs (Navigation)
- Desktop Canvas & Areas Panel
- Docs Sidebar & Schema Layout
- Convex Diagram CRUD API
- Diagram Page & Dock Panel
- Component Example Gallery
- Constraint Toggle & Context Menu
- TypeScript Build Config
- ESLint Dependencies
- Combobox UI Primitive
- Marketing Skeleton Placeholders
- Table Block & Benefit Cards
- SSMS Feature-Parity Roadmap Docs
- Shadcn Component Registry
- Deploy & Tech Cards
- Marketing Home Page
- Card UI Primitive
- Scale & Sliding Number Widgets
- Use Cases & Feature Icons
- Form Field Primitive
- Pixelated Canvas & Sub-Heading
- Alert Dialog Primitive
- Marketing Layout & Footer
- Hero Section & Buttons
- UI/Editor npm Dependencies
- Code Editor Component
- Link Text Component
- Theme Toggle & Navbar
- Link Text Component (Variant)
- Nodus Dashboard Screenshot Concepts
- Visual Schema Builder Concepts
- Schema Import API Route
- Container & Logo Cloud
- Convex Client Provider
- Diagram Layout & Palette Context
- Column Relationship Extraction API
- Badge & Shimmer Text
- Convex Generated Data Model
- Convex Server Context Types
- Legacy Platform Palette Provider
- Root Layout & Metadata
- DBML Docs Phase 2 Concepts
- Phase 5 Data-Tier Plan
- Combobox Form Example
- DB Connection Store
- BACPAC Import & JSZip
- Badge Component (Variant)
- Auth Proxy Route
- class-variance-authority Dependency
- Clerk Auth Dependency
- clsx Dependency
- CodeMirror SQL Lang Dependency
- Convex Dependency
- Dagre Layout Dependency
- DBML Core Dependency
- ESLint Flat Config
- globals.css Git History
- Lucide Icons Dependency
- Monaco Editor Dependency
- Motion Animation Dependency
- MSSQL Driver Dependency
- MySQL2 Driver Dependency
- Next.js Framework Dependency
- Next.js Runtime Config
- next-themes Dependency
- Postgres Driver Dependency
- Radix UI Dependency
- react-dom Dependency
- react-markdown Dependency
- Resizable Panels Dependency
- react-use-measure Dependency
- sax XML Parser Dependency
- shadcn CLI Dependency
- tailwind-merge Dependency
- tw-animate-css Dependency
- CodeMirror React Dependency
- Zustand State Dependency
- PostCSS Config
- Convex API Namespace
- Convex Action Helper
- Convex Internal Action Helper
- Convex Internal Query Helper
- File Icon Asset
- Globe Icon Asset
- Next.js Logo Asset
- Vercel Logo Asset
- Window Icon Asset
- README Bootstrap Notes

## God Nodes (most connected - your core abstractions)
1. `cn()` - 201 edges
2. `useCanvasStore` - 29 edges
3. `Button()` - 25 edges
4. `compilerOptions` - 16 edges
5. `Container()` - 14 edges
6. `DropdownMenuContent()` - 14 edges
7. `DropdownMenuItem()` - 14 edges
8. `useDocumentationStore` - 14 edges
9. `DropdownMenu()` - 13 edges
10. `DropdownMenuTrigger()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `Object Explorer Tree` --semantically_similar_to--> `Tables Tab / Canvas Sync (drawdb.app)`  [INFERRED] [semantically similar]
  artifacts/phase3_ssms_plan.md → mdInstructions/tablesTabFunctionality.md
- `General Diagramming Functionality (Draw.io style)` --semantically_similar_to--> `SVG-Based Table Rendering (drawdb.app)`  [INFERRED] [semantically similar]
  docs/roadmap/next_steps.md → mdInstructions/howDrawdbAddsTablesToTheCanvas.md
- `DropZone()` --calls--> `cn()`  [EXTRACTED]
  components/diagram-general/dock-panel.tsx → lib/utils.ts
- `Text()` --calls--> `cn()`  [EXTRACTED]
  components/diagram-general/text.tsx → lib/utils.ts
- `TableButton()` --calls--> `cn()`  [EXTRACTED]
  components/documentation/docs-sidebar.tsx → lib/utils.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **SSMS Feature-Parity Roadmap (Phases 2-5)** — artifacts_phase2_viewer_plan_local_database_viewer, artifacts_phase3_ssms_plan_ssms_experience, artifacts_phase4_plan_dynamic_connections_styling, artifacts_phase5_plan_advanced_tools_datatier [INFERRED 0.85]
- **Convex Backend Documentation (API, Architecture, Schema)** — docs_convex_api_security_model, docs_convex_architecture_overview, docs_convex_schema_database_schema [EXTRACTED 0.95]
- **DrawDB.app Table Rendering Research Notes** — mdinstructions_howdrawdbaddstablestothecanvas_svg_table_rendering, mdinstructions_tablesstylingondrawdb_table_card_styling, mdinstructions_tablestabfunctionality_tables_tab_sync [INFERRED 0.85]

## Communities (92 total, 42 thin omitted)

### Community 0 - "Desktop Canvas & Areas Panel"
Cohesion: 0.05
Nodes (77): AreasPanel(), WorldBackground(), NotesPanel(), options, PlatformPaletteToggle(), RelationshipsPanel(), SavingIndicator(), TablesPanel() (+69 more)

### Community 1 - "Docs Sidebar & Schema Layout"
Cohesion: 0.09
Nodes (31): DocsLayout(), DEFAULT_SCHEMAS, DocsSidebar(), SidebarFolder(), TableButton(), DocumentationViewer(), ProjectOverview(), StatCard() (+23 more)

### Community 2 - "Convex Diagram CRUD API"
Cohesion: 0.06
Nodes (30): create, deleteDiagram, get, list, update, components, internal, httpAction (+22 more)

### Community 3 - "Diagram Page & Dock Panel"
Cohesion: 0.09
Nodes (28): clamp(), DiagramPage(), PageProps, DockPanel, DockPanelProps, DraggableTab, DropZone(), DropZoneProps (+20 more)

### Community 4 - "Component Example Gallery"
Cohesion: 0.08
Nodes (29): frameworks, Example(), ExampleWrapper(), Card(), CardAction(), CardContent(), CardDescription(), CardFooter() (+21 more)

### Community 5 - "Constraint Toggle & Context Menu"
Cohesion: 0.10
Nodes (24): ConstraintToggle(), DivideY(), ContextMenuCheckboxItem(), ContextMenuContent(), ContextMenuItem(), ContextMenuLabel(), ContextMenuRadioItem(), ContextMenuSeparator() (+16 more)

### Community 6 - "TypeScript Build Config"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 7 - "ESLint Dependencies"
Cohesion: 0.07
Nodes (27): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node (+19 more)

### Community 8 - "Combobox UI Primitive"
Cohesion: 0.09
Nodes (22): ComboboxChip(), ComboboxChips(), ComboboxChipsInput(), ComboboxClear(), ComboboxContent(), ComboboxEmpty(), ComboboxGroup(), ComboboxInput() (+14 more)

### Community 9 - "Marketing Skeleton Placeholders"
Cohesion: 0.12
Nodes (10): AssistantMessage(), LLMModelSelectorSkeleton(), UserMessage(), AnthropicLogo(), AttachmentIcon(), CodeIcon(), MetaLogo(), OpenAILogo() (+2 more)

### Community 10 - "Table Block & Benefit Cards"
Cohesion: 0.13
Nodes (10): TableBlock(), MiniTable(), BellIcon(), HorizontalLine(), RealtimeSyncIcon(), ReuseBrainIcon(), RocketIcon(), ScreenCogIcon() (+2 more)

### Community 11 - "SSMS Feature-Parity Roadmap Docs"
Cohesion: 0.10
Nodes (21): Local MS SQL Server Docker Setup, Phase 2: Local Database Viewer, Integrated T-SQL Query Editor (Monaco), Object Explorer Tree, Phase 3: SSMS Experience, Connect to Server Dialog, Phase 4: Dynamic Connections & Styling Refinement, guards.ts Authorization Guards (+13 more)

### Community 12 - "Shadcn Component Registry"
Cohesion: 0.10
Nodes (20): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+12 more)

### Community 13 - "Deploy & Tech Cards"
Cohesion: 0.15
Nodes (11): DeployCard(), Card(), springConfig, ConnectYourTooklsSkeleton(), DeployAndScaleSkeleton(), DesignYourWorkflowSkeleton(), CenterSVG(), ForkIcon() (+3 more)

### Community 14 - "Marketing Home Page"
Cohesion: 0.18
Nodes (8): DivideX(), LogoCloud(), SectionHeading(), Benefits(), FAQs(), Pricing(), VideoSec(), faqs

### Community 15 - "Card UI Primitive"
Cohesion: 0.16
Nodes (10): Card(), CardDescription(), CardTitle(), Features(), Tab, NativeToolsIntegrationSkeleton(), TextToWorkflowBuilderSkeleton(), BrainIcon() (+2 more)

### Community 16 - "Scale & Sliding Number Widgets"
Cohesion: 0.16
Nodes (8): Scale(), SlidingNumber(), SlidingNumberProps, TRANSITION, CheckIcon(), pricingTable, TierName, tiers

### Community 17 - "Use Cases & Feature Icons"
Cohesion: 0.21
Nodes (7): UseCases(), DatabaseIcon(), DevopsIcon(), GraphIcon(), PhoneIcon(), TruckIcon(), WalletIcon()

### Community 18 - "Form Field Primitive"
Cohesion: 0.16
Nodes (12): Field(), FieldContent(), FieldDescription(), FieldError(), FieldGroup(), FieldLabel(), FieldLegend(), FieldSeparator() (+4 more)

### Community 19 - "Pixelated Canvas & Sub-Heading"
Cohesion: 0.22
Nodes (8): PixelatedCanvas(), PixelatedCanvasProps, SubHeading(), FirstIcon(), HowItWorks(), SecondIcon(), Tab, ThirdIcon()

### Community 20 - "Alert Dialog Primitive"
Cohesion: 0.15
Nodes (11): AlertDialog(), AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogMedia() (+3 more)

### Community 21 - "Marketing Layout & Footer"
Cohesion: 0.23
Nodes (6): Button(), Footer(), Navbar(), Logo(), LogoSVG(), SendIcon()

### Community 22 - "Hero Section & Buttons"
Cohesion: 0.24
Nodes (6): ButtonWithIdGenerator(), Heading(), Hero(), GartnerLogo(), GartnerLogoText(), Star()

### Community 23 - "UI/Editor npm Dependencies"
Cohesion: 0.18
Nodes (11): @base-ui/react, @codemirror/lang-json, @dnd-kit/core, dependencies, @base-ui/react, @codemirror/lang-json, @dnd-kit/core, sass (+3 more)

### Community 24 - "Code Editor Component"
Cohesion: 0.31
Nodes (8): CodeEditor(), EditorLanguage, themeExtension, useDebounce(), jsonToTables(), tablesToJSON(), tablesToMermaid(), Column

### Community 25 - "Link Text Component"
Cohesion: 0.18
Nodes (9): sizeClasses, Text(), TextProps, TextSize, TextVariant, TextWeight, underlineClasses, variantClasses (+1 more)

### Community 26 - "Theme Toggle & Navbar"
Cohesion: 0.24
Nodes (4): ModeToggle(), items, CloseIcon(), HamburgerIcon()

### Community 27 - "Link Text Component (Variant)"
Cohesion: 0.18
Nodes (9): sizeClasses, Text(), TextProps, TextSize, TextVariant, TextWeight, underlineClasses, variantClasses (+1 more)

### Community 28 - "Nodus Dashboard Screenshot Concepts"
Cohesion: 0.22
Nodes (11): Agents by Status Donut Chart, Nodus Dashboard UI Screenshot, GPT-4o mini Model Reference, GPT-4o Model Reference, Llama3.1 70B Model Reference, Llama3.1 8B Model Reference, Nodus Product Brand, Sidebar Navigation (Dashboard, Agents, Workflows, Simulations, Tasks, Apps, Notifications) (+3 more)

### Community 29 - "Visual Schema Builder Concepts"
Cohesion: 0.29
Nodes (11): comments table (example schema entity: id PK, name text, created_at ts), Connected indicator icon (central hub node), Define Columns (capability), Drag & Drop Tables (capability), Map Relationships (capability), projects table (example schema entity: id PK, name text, created_at ts), relations table (example schema entity: id PK, from_id text, ts), Native Visual Schema Builder Screenshot (+3 more)

### Community 30 - "Schema Import API Route"
Cohesion: 0.29
Nodes (9): ColumnInfo, Engine, fetchPostgresSchema(), fetchSqlServerSchema(), groupColumns(), ImportSchemaBody, POST(), Relationship (+1 more)

### Community 31 - "Container & Logo Cloud"
Cohesion: 0.29
Nodes (5): Container(), Dot(), HeroImage(), springConfig, logos

### Community 32 - "Convex Client Provider"
Cohesion: 0.28
Nodes (5): convex, ConvexClientProvider(), geistMono, inter, AppThemeProvider()

### Community 33 - "Diagram Layout & Palette Context"
Cohesion: 0.33
Nodes (4): Ctx, PaletteContext, PlatformPalette, PlatformPaletteProvider()

### Community 34 - "Column Relationship Extraction API"
Cohesion: 0.40
Nodes (5): ColumnInfo, extractTableAndColumn(), POST(), Relationship, TableInfo

### Community 35 - "Badge & Shimmer Text"
Cohesion: 0.40
Nodes (4): Badge(), ShimmerText, TextShimmerCore(), TextShimmerProps

### Community 36 - "Convex Generated Data Model"
Cohesion: 0.33
Nodes (4): DataModel, Doc, Id, TableNames

### Community 37 - "Convex Server Context Types"
Cohesion: 0.33
Nodes (5): ActionCtx, DatabaseReader, DatabaseWriter, MutationCtx, QueryCtx

### Community 38 - "Legacy Platform Palette Provider"
Cohesion: 0.33
Nodes (3): Ctx, PaletteContext, PlatformPalette

### Community 39 - "Root Layout & Metadata"
Cohesion: 0.40
Nodes (3): geistMono, inter, metadata

### Community 40 - "DBML Docs Phase 2 Concepts"
Cohesion: 0.40
Nodes (5): DBML Docs Phase 2 Enhancement Plan, Enum Interactive Tooltips, Mini-Diagram Rendering Approach, Project Overview (README) Rendering, TableGroup Categorization

### Community 41 - "Phase 5 Data-Tier Plan"
Cohesion: 0.50
Nodes (4): Phase 5: Advanced Tools & Data-Tier Applications, BACPAC Import/Export Support, Premium SQL Editor with IntelliSense, SqlPackage.exe Dependency

### Community 42 - "Combobox Form Example"
Cohesion: 0.50
Nodes (4): FormExample(), useComboboxAnchor(), react, react

### Community 44 - "DB Connection Store"
Cohesion: 0.50
Nodes (3): ConnectionConfig, ConnectionState, useConnectionStore

### Community 45 - "BACPAC Import & JSZip"
Cohesion: 0.67
Nodes (3): BacpacImportTab(), jszip, jszip

## Ambiguous Edges - Review These
- `Connected indicator icon (central hub node)` → `relations table (example schema entity: id PK, from_id text, ts)`  [AMBIGUOUS]
  public/images/nativeVisualSchemaBuilder.png · relation: shares_data_with

## Knowledge Gaps
- **237 isolated node(s):** `PageProps`, `inter`, `geistMono`, `ColumnInfo`, `TableInfo` (+232 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **42 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Connected indicator icon (central hub node)` and `relations table (example schema entity: id PK, from_id text, ts)`?**
  _Edge tagged AMBIGUOUS (relation: shares_data_with) - confidence is low._
- **Why does `cn()` connect `Constraint Toggle & Context Menu` to `Desktop Canvas & Areas Panel`, `Docs Sidebar & Schema Layout`, `Diagram Page & Dock Panel`, `Component Example Gallery`, `Combobox UI Primitive`, `Marketing Skeleton Placeholders`, `Table Block & Benefit Cards`, `Deploy & Tech Cards`, `Marketing Home Page`, `Card UI Primitive`, `Scale & Sliding Number Widgets`, `Form Field Primitive`, `Pixelated Canvas & Sub-Heading`, `Alert Dialog Primitive`, `Marketing Layout & Footer`, `Hero Section & Buttons`, `Code Editor Component`, `Link Text Component`, `Link Text Component (Variant)`, `Container & Logo Cloud`, `Badge & Shimmer Text`, `Badge Component (Variant)`?**
  _High betweenness centrality (0.298) - this node is a cross-community bridge._
- **Why does `dependencies` connect `UI/Editor npm Dependencies` to `ESLint Dependencies`, `Combobox Form Example`, `BACPAC Import & JSZip`, `class-variance-authority Dependency`, `Clerk Auth Dependency`, `clsx Dependency`, `CodeMirror SQL Lang Dependency`, `Convex Dependency`, `Dagre Layout Dependency`, `DBML Core Dependency`, `Lucide Icons Dependency`, `Monaco Editor Dependency`, `Motion Animation Dependency`, `MSSQL Driver Dependency`, `MySQL2 Driver Dependency`, `Next.js Framework Dependency`, `next-themes Dependency`, `Postgres Driver Dependency`, `Radix UI Dependency`, `react-dom Dependency`, `react-markdown Dependency`, `Resizable Panels Dependency`, `react-use-measure Dependency`, `sax XML Parser Dependency`, `shadcn CLI Dependency`, `tailwind-merge Dependency`, `tw-animate-css Dependency`, `CodeMirror React Dependency`, `Zustand State Dependency`?**
  _High betweenness centrality (0.139) - this node is a cross-community bridge._
- **Why does `react` connect `Combobox Form Example` to `UI/Editor npm Dependencies`?**
  _High betweenness centrality (0.104) - this node is a cross-community bridge._
- **What connects `PageProps`, `inter`, `geistMono` to the rest of the system?**
  _237 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Desktop Canvas & Areas Panel` be split into smaller, more focused modules?**
  _Cohesion score 0.052781289506953225 - nodes in this community are weakly interconnected._
- **Should `Docs Sidebar & Schema Layout` be split into smaller, more focused modules?**
  _Cohesion score 0.08687943262411348 - nodes in this community are weakly interconnected._