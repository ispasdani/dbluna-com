export type ArticleTag = "guide" | "best-practices" | "tutorial";

export type ArticleSection = {
  heading: string;
  body: string[];
};

export type ArticleFaq = {
  question: string;
  answer: string;
};

export type Article = {
  slug: string;
  tag: ArticleTag;
  publishedAt: string;
  updatedAt: string;
  readMinutes: number;
  metaTitle: string;
  metaDescription: string;
  title: string;
  excerpt: string;
  lead: string;
  keyPoints: string[];
  sections: ArticleSection[];
  faq: ArticleFaq[];
};

export const TAG_LABELS: Record<ArticleTag, string> = {
  guide: "Guide",
  "best-practices": "Best Practices",
  tutorial: "Tutorial",
};

const articles: Article[] = [
  {
    slug: "what-is-dbml",
    tag: "guide",
    publishedAt: "2025-10-15",
    updatedAt: "2025-10-15",
    readMinutes: 6,
    metaTitle: "What Is DBML? A Developer's Guide to Database Markup Language",
    metaDescription:
      "DBML (Database Markup Language) is a simple, readable DSL for defining database schemas. Learn the syntax, benefits, and how to use DBML in your team's workflow.",
    title: "What Is DBML? A Developer's Guide to Database Markup Language",
    excerpt:
      "DBML is a readable, human-friendly DSL for defining and sharing database schemas. Learn what it is, how it works, and why engineers reach for it instead of raw SQL.",
    lead: "If you've ever handed a new team member a raw SQL CREATE TABLE dump and watched their eyes glaze over, DBML was built for exactly that moment. It's a concise, version-controllable way to describe a database schema that any developer can read at a glance — and that converts cleanly to and from SQL, JSON, and visual diagrams.",
    keyPoints: [
      "DBML is a domain-specific language for defining database schemas in plain, readable text",
      "Supports tables, columns, relationships, indexes, enums, and notes out of the box",
      "Tool-agnostic: converts to and from SQL, JSON, and visual canvas diagrams",
      "Version-controllable — check your schema into Git like any other source file",
      "First-class two-way support in DBLuna's code editor and visual canvas",
    ],
    sections: [
      {
        heading: "What Is DBML?",
        body: [
          "DBML — Database Markup Language — is a domain-specific language (DSL) designed specifically for defining relational database schemas. Created by the team at dbdiagram.io, it has become a de facto standard for teams who want a human-readable, version-controllable alternative to raw DDL SQL.",
          "A DBML file describes tables, columns, data types, primary keys, foreign-key relationships, indexes, and even inline notes — all in a syntax that resembles a clean config file rather than procedural SQL. The result is something any developer can review in a pull request without needing to mentally parse nested CREATE TABLE statements.",
        ],
      },
      {
        heading: "DBML Syntax at a Glance",
        body: [
          "The core unit in DBML is the Table block. You declare a table name, then list columns with their types and optional constraints. Foreign-key relationships are declared separately with a Ref statement, making the relationship graph easy to scan independently of table definitions.",
          "Enums are first-class citizens in DBML, defined once and referenced by name across multiple tables. Indexes are declared inside the table block using an Indexes section, supporting composite keys, unique constraints, and notes. This separation of concerns keeps each section focused and scannable.",
          "A minimal DBML file for a users-and-posts schema is under 20 lines. That same schema in PostgreSQL DDL SQL runs to 60+ lines with boilerplate. The signal-to-noise ratio is dramatically better, and the diff in a code review is immediately intelligible.",
        ],
      },
      {
        heading: "Why Not Just Write SQL?",
        body: [
          "SQL CREATE TABLE is the authoritative source of truth once a schema is deployed — but it's a poor collaboration medium. DDL varies across databases (PostgreSQL, MySQL, SQL Server each have dialects), it mixes type definitions with engine-specific storage options, and reviewing a 200-line migration in a pull request is genuinely painful.",
          "DBML solves the collaboration problem without replacing SQL. You design and discuss the schema in DBML, then generate dialect-specific SQL for migrations. The DBML file lives in your repository as human-readable documentation. Your CI pipeline can verify that the generated SQL matches what's deployed. The two layers serve different audiences: DBML for humans, SQL for databases.",
          "There is also a practical portability benefit. If you ever switch from PostgreSQL to MySQL, your DBML schema is unchanged — only the SQL generation target changes. The logical design is separated from the physical implementation detail.",
        ],
      },
      {
        heading: "How DBML Fits Into Your Workflow",
        body: [
          "Most teams adopt DBML at the design phase, before any migrations are written. An engineer proposes a schema change by opening a DBML file, editing it, and submitting a pull request. The diff is readable, reviewers can comment on specific fields or relationships, and the discussion happens in the PR rather than in a Slack thread.",
          "Once the PR is approved, the DBML is used to generate the SQL migration. Tools like dbmate, Flyway, or Liquibase pick up the generated SQL. The DBML file is updated in lockstep with each migration, so it always reflects the current deployed schema.",
          "For teams using DBLuna, the DBML file also drives the visual canvas. Any change in the code editor is immediately reflected in the diagram and vice versa — making the visual canvas a live rendering of the canonical DBML source rather than a separate artifact that drifts out of sync.",
        ],
      },
      {
        heading: "DBML and DBLuna",
        body: [
          "DBLuna's code editor is built around DBML as a first-class format. The editor parses DBML in real time, validates relationships and types, and renders the diagram as you type. Going the other direction — dragging tables on the canvas, adding columns, drawing foreign-key lines — writes back to the DBML instantly.",
          "This two-way binding means you never need to maintain a diagram separately from your schema definition. The diagram is always the DBML, just rendered visually. Export the DBML file to Git, import an existing SQL schema and get DBML back, or share a read-only link that renders the diagram without an account. DBML is the thread that connects all of it.",
        ],
      },
    ],
    faq: [
      {
        question: "Is DBML a replacement for SQL?",
        answer:
          "No — DBML is a design and documentation layer, not an execution layer. You still write SQL migrations to apply schema changes to a database. DBML gives you a clean, readable source of truth that can generate SQL, rather than treating SQL as the primary design artefact.",
      },
      {
        question: "Can I import existing SQL into DBML?",
        answer:
          "Yes. DBLuna can import a PostgreSQL schema, SQL Server schema, or a raw SQL file and convert it to DBML automatically. The import lays the tables out on the canvas and populates the code editor with the equivalent DBML, giving you a head start on documenting an existing database.",
      },
      {
        question: "Does DBML support all database types?",
        answer:
          "DBML is database-agnostic by design. You can use any type name in a column definition — DBML does not validate type names, so you can write uuid, jsonb, tsvector, or any other database-specific type. When generating SQL from DBML, the target dialect handles the type mapping.",
      },
      {
        question: "Where can I learn more about the DBML specification?",
        answer:
          "The official DBML specification is maintained at dbml.org. It documents all supported keywords, syntax rules, and examples. DBLuna's code editor follows the same specification, so any valid DBML file will work in DBLuna without modification.",
      },
    ],
  },

  {
    slug: "database-schema-design-best-practices",
    tag: "best-practices",
    publishedAt: "2025-10-22",
    updatedAt: "2025-10-22",
    readMinutes: 8,
    metaTitle:
      "How to Design a Database Schema: Best Practices for Modern Apps",
    metaDescription:
      "Learn how to design a database schema that scales — covering naming conventions, normalization, indexing strategies, and relationship patterns every developer should know.",
    title: "How to Design a Database Schema: Best Practices for Modern Apps",
    excerpt:
      "A well-designed schema is the foundation every application builds on. These are the naming conventions, normalization rules, indexing strategies, and relationship patterns that experienced engineers apply from day one.",
    lead: "Most database problems that surface after launch were already present in the original schema. Naming inconsistencies, missing indexes, relationship models that made sense for a 10,000-row table but not a 10-million-row one — these are fixable with migrations, but migrations are expensive. Getting the design right the first time is dramatically cheaper.",
    keyPoints: [
      "Consistent naming conventions reduce cognitive load across the whole team",
      "Normalization to 3NF prevents data anomalies without premature over-engineering",
      "Every foreign key should have an index; most queries filter on more than the primary key",
      "Soft deletes, audit columns, and created_at/updated_at are almost always worth adding upfront",
      "Design for the query patterns you know about, not just the data model in the abstract",
    ],
    sections: [
      {
        heading: "Start With Naming Conventions",
        body: [
          "Naming is the highest-leverage design decision you make in a schema, because it cannot be changed cheaply once an application is built on top of it. Pick a convention before you write the first table and enforce it on every column from day one.",
          "The widely-adopted PostgreSQL community convention is snake_case for everything: table names are plural nouns (users, orders, order_items), primary keys are id, and foreign keys are {singular_table_name}_id (so the FK from order_items back to orders is order_id). This creates a mechanical rule that any engineer can follow without thinking, which means fewer inconsistencies in practice.",
          "Avoid abbreviations unless they are universally understood in your domain. A column named cust_addr_zip is harder to search, harder to autocomplete, and ambiguous in a new engineer's first week. customer_postal_code is unambiguous, easy to grep for, and self-documenting.",
        ],
      },
      {
        heading: "Normalize to Third Normal Form — Then Stop",
        body: [
          "Normalization is the process of restructuring a relational schema to reduce redundancy and protect data integrity. Third Normal Form (3NF) is the practical sweet spot for most transactional applications: it eliminates the most common data anomalies without introducing so many join tables that queries become unwieldy.",
          "The rule of thumb: every non-key column should depend on the key, the whole key, and nothing but the key. If you find yourself storing the same customer email address in three different tables, something is wrong. If you find yourself storing a derived value (total_price = quantity × unit_price) as a column, consider whether that derivation belongs in the application layer instead.",
          "Fourth and fifth normal forms exist but require genuinely complex multi-valued dependencies that most CRUD applications simply do not have. Normalize aggressively up to 3NF, then apply judgment beyond that. Premature denormalization for performance is a common mistake — most performance problems have index solutions that don't require schema restructuring.",
        ],
      },
      {
        heading: "Index Strategically, Not Exhaustively",
        body: [
          "Every index you add speeds up reads and slows down writes. Indexes also consume storage and add overhead to vacuums and autovacuum. The goal is the minimum set of indexes that makes your known query patterns fast, not one index per column.",
          "The mandatory indexes are: every primary key (usually automatic), every foreign key (not automatic in most databases — you must add these explicitly), and every column that appears in a WHERE clause of a query you know will run frequently and on large tables.",
          "Composite indexes are more powerful than they appear. An index on (user_id, created_at DESC) can serve both 'find all records for user' and 'find latest record for user' queries with a single index scan. Think about the prefix rule: a composite index on (a, b, c) serves queries filtering on a, or a + b, or a + b + c, but not b or c alone.",
          "Partial indexes are underused. An index on (status) WHERE status = 'pending' is much smaller and faster than a full index on status if 95% of rows are 'completed'. Scan your slow query log before adding indexes; don't add them speculatively.",
        ],
      },
      {
        heading: "Add Audit Columns by Default",
        body: [
          "Add created_at and updated_at to every table from the start. The cost is negligible (two timestamp columns, auto-populated by a trigger or ORM hook), but the value of having a chronological audit trail for debugging, data exports, and incremental syncs is enormous. You will want these columns eventually, and retrofitting them onto a populated table is awkward.",
          "Soft deletes — a deleted_at timestamp column rather than an actual DELETE — are worth considering for any entity that users can 'delete' through the UI. Hard deletes are irreversible and complicate recovery; soft deletes keep the row in the table and let you filter it out with a WHERE deleted_at IS NULL clause. They also make audit logs and 'undo' features trivially implementable.",
          "For tables that represent sensitive or audited entities (financial transactions, permission changes, user accounts), consider a separate audit log table populated by triggers. This is heavier infrastructure but provides immutable records that can't be tampered with by application code.",
        ],
      },
      {
        heading: "Model Relationships Explicitly",
        body: [
          "Every foreign key constraint should be declared in the schema — not just tracked by the application. Database-enforced foreign keys prevent orphaned records, make the schema self-documenting, and are visible to every tool that introspects the schema (ORMs, diagram tools, migration generators).",
          "For many-to-many relationships, always use an explicit junction table rather than storing arrays of IDs in a column. A user_roles table with user_id and role_id columns is queryable, indexable, and extensible (you can add a granted_at timestamp column later). An array column storing role IDs is opaque to the query planner and violates normalization.",
          "Think carefully about ON DELETE behaviour on foreign keys. ON DELETE CASCADE means deleting a parent row silently deletes all child rows — powerful but potentially catastrophic if misapplied. ON DELETE RESTRICT (the default) prevents deletion of a parent row if children exist, which is safer but requires the application to handle the constraint error. Document the intended behavior in the schema with a comment.",
        ],
      },
    ],
    faq: [
      {
        question: "Should I use UUIDs or auto-incrementing integers as primary keys?",
        answer:
          "Both have trade-offs. Auto-incrementing integers (BIGSERIAL in PostgreSQL) are compact, ordered, and fast for clustered index scans. UUIDs are globally unique — useful for distributed systems, external APIs, and row references you need to expose publicly. A common pattern is to use an internal integer id for joins and a UUID for any external-facing identifier. Avoid UUIDs as clustered primary keys on high-write tables due to index fragmentation from random insertion order.",
      },
      {
        question: "When should I denormalize for performance?",
        answer:
          "Denormalize only after you have a measured performance problem and confirmed that indexing cannot solve it. Premature denormalization trades a hypothetical performance gain for a real data-integrity cost. When you do denormalize — for example, caching an aggregate like order_item_count on the parent orders row — enforce consistency with database triggers or application-level invariants, and document the denormalization explicitly.",
      },
      {
        question: "How should I handle schema changes over time?",
        answer:
          "Use a migration tool (Flyway, Liquibase, dbmate, or your ORM's built-in migrations) and commit every migration as a versioned file in your repository. Never edit a migration that has been applied to any environment — append a new migration instead. Review migrations in pull requests the same way you review application code. Maintain a DBML file alongside migrations so you always have a readable snapshot of the current schema.",
      },
    ],
  },

  {
    slug: "er-diagrams-explained",
    tag: "guide",
    publishedAt: "2025-11-05",
    updatedAt: "2025-11-05",
    readMinutes: 7,
    metaTitle: "ER Diagrams Explained: How to Model Your Database Visually",
    metaDescription:
      "Entity-relationship diagrams are the clearest way to communicate a database design. This guide explains entities, attributes, relationships, cardinality, and how to draw an ER diagram from scratch.",
    title: "ER Diagrams Explained: How to Model Your Database Visually",
    excerpt:
      "An entity-relationship diagram turns your database schema into a visual map that anyone on the team can read and discuss. Learn the core concepts — entities, attributes, relationships, and cardinality — and how to build one.",
    lead: "When a new engineer joins a project and asks 'how does the data model work?', the most efficient answer is a diagram. A well-drawn ER diagram communicates the structure of a database in minutes — relationships that would take paragraphs to explain in prose are immediately obvious from the connecting lines. This guide covers everything you need to know to read and create them.",
    keyPoints: [
      "Entities are the things your application tracks — users, orders, products",
      "Attributes are the properties of an entity — a user has an email, a name, a created date",
      "Relationships describe how entities connect — an order belongs to a user, contains many products",
      "Cardinality (one-to-one, one-to-many, many-to-many) defines the multiplicity of each relationship",
      "Crow's foot notation is the most widely used visual standard for ER diagrams today",
    ],
    sections: [
      {
        heading: "What Is an Entity-Relationship Diagram?",
        body: [
          "An entity-relationship (ER) diagram is a visual representation of the entities in a system and the relationships between them. First formalised by Peter Chen in 1976, the concept predates relational databases and has been adapted into many notations over the decades. In modern practice, ER diagrams are used synonymously with database schema diagrams — they show tables, columns, and foreign-key relationships.",
          "Unlike a generic flowchart, an ER diagram has precise semantics. Each symbol carries a specific meaning that trained engineers interpret consistently. This makes ER diagrams a shared language for database design discussions, documentation, and review — far more precise than written descriptions and far more portable than SQL scripts.",
        ],
      },
      {
        heading: "Entities and Attributes",
        body: [
          "An entity is any distinct object or concept that the system needs to track and store information about. In a typical e-commerce application, the core entities are Customer, Product, Order, and OrderItem. In a project management tool, they might be User, Project, Task, and Comment. Identifying entities is the first step of schema design.",
          "Attributes are the properties of an entity. A Customer entity has attributes like id, email, full_name, and created_at. Attributes map directly to columns in the corresponding database table. Every entity has at least one identifying attribute — the primary key — that uniquely identifies each instance.",
          "Some attributes are composite (a mailing address broken into street, city, state, and postal code) and some are derived (age, computed from date_of_birth). Derived attributes are typically not stored in the database; they are computed at query time or in the application layer to avoid synchronisation problems.",
        ],
      },
      {
        heading: "Relationships and Cardinality",
        body: [
          "A relationship connects two entities and describes how instances of one relate to instances of the other. The most important property of a relationship is its cardinality — how many instances of each entity can participate.",
          "One-to-one (1:1): each instance on both sides relates to at most one instance on the other side. Example: a User has one UserProfile, and each UserProfile belongs to exactly one User. True 1:1 relationships are relatively rare and are sometimes better modelled as a single table with optional columns.",
          "One-to-many (1:N): one instance on the 'one' side can relate to many instances on the 'many' side. Example: one Order has many OrderItems, but each OrderItem belongs to exactly one Order. This is the most common relationship type in relational schemas, implemented with a foreign key on the 'many' side.",
          "Many-to-many (M:N): instances on both sides can relate to many instances on the other. Example: a Product can appear in many Orders, and an Order can contain many Products. Many-to-many relationships require a junction table (OrderItem in this case) with foreign keys to both parent tables.",
        ],
      },
      {
        heading: "Crow's Foot Notation",
        body: [
          "Crow's foot notation is the dominant visual standard for modern ER diagrams. It represents cardinality with symbols at the ends of relationship lines. The 'crow's foot' symbol (three lines fanning out) indicates 'many'. A single perpendicular line indicates 'one'. A circle indicates 'zero (optional)'.",
          "Reading a relationship line in crow's foot notation: you read the symbol closest to each entity to understand the constraints from the perspective of the entity on the other side. A line connecting Orders to Customers with a crow's foot near Orders and a single line near Customers reads as: 'a Customer has zero or many Orders, and each Order belongs to exactly one Customer.'",
          "DBLuna renders all relationships using crow's foot notation automatically. When you declare a foreign key relationship in DBML, the diagram draws the appropriate line and symbols. Hovering over a relationship line shows the field names on both sides of the join.",
        ],
      },
      {
        heading: "Drawing an ER Diagram From Scratch",
        body: [
          "Start by listing your entities — the nouns in your application's domain. Don't worry about attributes yet; just identify the distinct 'things' the system needs to track. For a simple task management app: User, Workspace, Project, Task, Comment, Label.",
          "Next, identify relationships. For each pair of entities, ask: 'Can an instance of A relate to an instance of B, and if so, how many?' Write down the cardinality. A Workspace has many Projects. A Project has many Tasks. A Task has many Comments. A Task can have many Labels, and a Label can apply to many Tasks.",
          "Now add attributes. Each entity gets its primary key first, then the foreign keys implied by its relationships, then its own data columns. A Task gets id, project_id (FK), title, description, status, assignee_id (FK to User), created_at, updated_at.",
          "With entities, relationships, and attributes defined, drawing the diagram is mechanical. In DBLuna, you can type the DBML directly in the code editor and the diagram renders immediately, or you can drag tables onto the canvas and draw relationship lines with the mouse. Either path produces the same output.",
        ],
      },
    ],
    faq: [
      {
        question: "What's the difference between a conceptual, logical, and physical ER diagram?",
        answer:
          "Conceptual ER diagrams show entities and relationships without attributes — they communicate the high-level domain model to non-technical stakeholders. Logical ER diagrams add attributes and define cardinality precisely, but remain database-agnostic. Physical ER diagrams map the logical model to a specific database engine, including exact column types, indexes, constraints, and naming conventions. DBLuna diagrams are physical ER diagrams.",
      },
      {
        question: "Should I create an ER diagram before or after writing the schema?",
        answer:
          "Ideally both at the same time — in DBLuna, the diagram and the DBML schema are two views of the same underlying data, updated in sync. Start by sketching entities and relationships (even on a whiteboard), then refine the model in a tool where the diagram and the schema stay linked. This removes the risk of a diagram drifting out of sync with the actual deployed schema.",
      },
      {
        question: "How do I show optional vs. required relationships in an ER diagram?",
        answer:
          "In crow's foot notation, a circle on the end of a line indicates 'zero or more' (the relationship is optional). A perpendicular bar indicates 'exactly one' (the relationship is required). So a line reading 'O|' to 'crow's foot' means 'zero or one on this side, one or many on the other' — a standard optional one-to-many.",
      },
    ],
  },

  {
    slug: "postgresql-schema-visualization",
    tag: "tutorial",
    publishedAt: "2025-11-18",
    updatedAt: "2025-11-18",
    readMinutes: 5,
    metaTitle:
      "How to Import and Visualize a PostgreSQL Schema in Minutes",
    metaDescription:
      "Step-by-step guide to importing a PostgreSQL schema into DBLuna and generating an interactive ER diagram — no manual re-entry required.",
    title: "How to Import and Visualize a PostgreSQL Schema in Minutes",
    excerpt:
      "If you've inherited a PostgreSQL database with no documentation, DBLuna's schema import turns it into an interactive ER diagram in under a minute. Here's exactly how to do it.",
    lead: "Most real-world databases were not designed with documentation in mind. You join a project, find a 40-table PostgreSQL schema with no diagram and no comments, and spend your first week running \\d table_name over and over trying to piece together how it all fits together. There is a faster way.",
    keyPoints: [
      "DBLuna imports PostgreSQL schemas directly from a connection string or a pg_dump SQL file",
      "The import extracts tables, columns, types, constraints, foreign keys, and indexes automatically",
      "The resulting diagram is fully interactive — drag tables, add notes, group related entities",
      "The DBML code editor is populated alongside the diagram, giving you a text-based schema snapshot",
      "Share a read-only link with anyone on the team — no account required to view",
    ],
    sections: [
      {
        heading: "Two Ways to Import a PostgreSQL Schema",
        body: [
          "DBLuna supports two import paths for PostgreSQL schemas. The first is a live connection: you provide a connection string (or individual host/port/user/password/database fields) and DBLuna introspects the running database using the information_schema. This gives you the most complete picture, including comments and live data types.",
          "The second path is a SQL file: export your schema with pg_dump --schema-only and upload the resulting .sql file to DBLuna. This option is useful when you don't want to expose your database to an external connection, or when you need to document a schema at a specific point in time without a live database available.",
          "Both paths produce the same output: a populated DBML file in the code editor and a laid-out visual diagram on the canvas.",
        ],
      },
      {
        heading: "What Gets Imported",
        body: [
          "The import extracts every table in the target schema (public by default, configurable), including all columns with their data types and nullability. Primary keys, unique constraints, check constraints, and foreign key relationships are imported and rendered as relationship lines on the diagram.",
          "Indexes are extracted and visible in the DBML output, even though they are not drawn as visual elements on the canvas. Column comments (added with COMMENT ON COLUMN) are imported as column notes in DBML. Table comments become table notes.",
          "Sequences, views, functions, and stored procedures are not imported — DBLuna focuses on the structural schema (tables and their relationships) rather than executable database objects. If you need to document views, you can add them as additional tables manually.",
        ],
      },
      {
        heading: "Cleaning Up the Auto-Layout",
        body: [
          "The auto-layout algorithm places tables in a force-directed arrangement that minimises edge crossings, but it rarely matches the way engineers think about a domain. After importing, spend five minutes reorganising the canvas into logical groups.",
          "A useful pattern is to cluster tables by bounded context or feature area. If you're working on a multi-tenant SaaS, cluster the account/workspace/user tables in one area and the billing tables in another. DBLuna's area and sticky note features let you draw visual boundaries and label each cluster.",
          "If the schema is large (50+ tables), use the minimap in the bottom-right corner to navigate. The minimap shows the full canvas at a reduced scale and highlights your current viewport. You can also use the search to jump to a specific table.",
        ],
      },
      {
        heading: "Sharing and Exporting the Result",
        body: [
          "Once you're happy with the layout, share it with the team. DBLuna's no-account share link renders the diagram in any browser with no login required — paste it in Slack, a Notion page, or a Confluence doc and anyone can explore the schema without signing up.",
          "For a more formal handoff, export the diagram as SVG (vector, scales to any size) for embedding in documentation, or export the DBML file to commit to your repository as a persistent schema snapshot. The DBML file can be re-imported into DBLuna at any time to restore the full diagram.",
          "If you need to track schema changes over time, import a fresh schema dump after each migration. Comparing the before and after DBML files in git diff gives you a precise, readable changelog of every column added, removed, or changed.",
        ],
      },
    ],
    faq: [
      {
        question: "Does the import require write access to the database?",
        answer:
          "No — the import only reads from the information_schema and pg_catalog system tables. A read-only database user with CONNECT and SELECT privileges on the target schema is sufficient. We recommend creating a dedicated read-only user for schema imports rather than using your application's database user.",
      },
      {
        question: "Can I import schemas from MySQL or SQL Server?",
        answer:
          "Yes. DBLuna supports imports from PostgreSQL, SQL Server, and CSV files. The SQL Server import uses the INFORMATION_SCHEMA tables in the same way as PostgreSQL. MySQL support via a SQL file import is also available — upload your mysqldump --no-data output and DBLuna will parse the CREATE TABLE statements.",
      },
      {
        question: "What happens if my schema has circular foreign key references?",
        answer:
          "Circular foreign key references are uncommon but valid in some schemas (for example, a categories table where each category has an optional parent_category_id pointing back to the same table). DBLuna handles self-referential and circular references correctly — they render as looping relationship lines on the canvas and appear in the DBML as normal Ref declarations.",
      },
    ],
  },

  {
    slug: "database-documentation-guide",
    tag: "best-practices",
    publishedAt: "2025-12-02",
    updatedAt: "2025-12-02",
    readMinutes: 6,
    metaTitle:
      "Database Documentation: How to Keep Your Whole Team in Sync",
    metaDescription:
      "Good database documentation prevents misunderstandings, speeds up onboarding, and makes schema changes safer. Here's a practical guide to what to document and how to keep it current.",
    title: "Database Documentation: How to Keep Your Whole Team in Sync",
    excerpt:
      "An undocumented database is a liability that grows with every new engineer who joins the team. Here's a practical guide to what database documentation should include, how to generate it automatically, and how to keep it from going stale.",
    lead: "The most common answer to 'where's the database documentation?' is 'there isn't any.' That answer is almost always followed by months of tribal knowledge transfer, mysterious bugs that turn out to be misunderstood foreign key semantics, and data migrations that break because someone didn't know a column was used for two different purposes. Documentation is not optional — it's the difference between a schema that one person understands and one that the whole team can work safely with.",
    keyPoints: [
      "An ER diagram is the minimum viable database documentation — start there",
      "Column-level notes explain the why and the edge cases, not just the data type",
      "A DBML file in version control gives you a diff-friendly schema changelog for free",
      "Auto-generated documentation sites remove the manual maintenance burden",
      "Documentation should live where engineers work — not in a separate wiki that goes stale",
    ],
    sections: [
      {
        heading: "Why Database Documentation Gets Skipped",
        body: [
          "Database documentation gets skipped for the same reason code comments get skipped: it feels like overhead, it doesn't run in CI, and there's no immediate negative consequence for omitting it. The negative consequence arrives weeks or months later when a new engineer makes a wrong assumption, or when a migration script corrupts data because the author didn't know a column had a non-obvious constraint.",
          "The other reason is friction. Keeping a separate document or wiki page in sync with a live, changing schema is genuinely tedious. The moment a schema change happens without a corresponding documentation update — which is inevitable — the documentation is misleading, which is worse than no documentation at all.",
          "The solution to both problems is automation: generate the documentation directly from the schema so it can never drift, and make the schema itself the documentation so there's no separate file to maintain.",
        ],
      },
      {
        heading: "The Minimum: An ER Diagram",
        body: [
          "An entity-relationship diagram showing all tables and their relationships is the minimum documentation that any database should have. It answers the most frequent questions engineers ask about an unfamiliar schema: what tables exist, what data does each one hold, and how do they connect?",
          "A diagram is faster to read than any written description and dramatically more useful than reading table definitions one by one. For a new engineer, a 20-minute walkthrough of a diagram conveys what would otherwise take days of exploration.",
          "The catch is keeping the diagram current. A diagram drawn once in Lucidchart and then ignored as the schema evolves is misleading. The diagram needs to be the schema — or derived automatically from it — so that updates are structural rather than editorial.",
        ],
      },
      {
        heading: "Column-Level Notes: Documenting the Why",
        body: [
          "Data types and column names tell you what a column stores. Notes tell you why it exists, what edge cases to be aware of, and what assumptions the application makes about its values. These are the things that aren't obvious from the schema itself and that typically live only in someone's head.",
          "Good column notes document: business rules encoded in a value (status = 'pending' means the webhook hasn't fired yet), nullable semantics (this is null for legacy records created before 2022 and should be treated as 'default'), and cross-table dependencies (this value must match the partner_id in the external_accounts table in the billing service).",
          "In DBML, column notes are written inline as a note: 'text here' field. In DBLuna, they appear in the column inspector panel and are included in any exported DBML file. Adding a note is a 30-second operation that pays dividends every time someone reads the schema six months later.",
        ],
      },
      {
        heading: "DBML in Version Control as a Living Schema",
        body: [
          "A DBML file committed alongside your migrations is a schema changelog for free. Every pull request that modifies the schema also modifies the DBML file, producing a human-readable diff: 'added column active_at to subscriptions table, changed type of price from integer to numeric(10,2)'. Reviewers can comment on the DBML change in the PR review, which grounds the discussion in the actual schema impact rather than the migration SQL.",
          "This approach also gives you a time machine for the schema. Checking out the DBML file at any past commit gives you the complete schema state at that point in time — useful for debugging production issues or understanding the schema state at the time a bug was introduced.",
          "The discipline required is: every migration must be accompanied by a corresponding DBML update. This is easiest to enforce with a CI check that generates expected DBML from the migration and verifies it matches the committed file, or with a DBLuna export step in the deployment pipeline.",
        ],
      },
      {
        heading: "Sharing Documentation With the Whole Team",
        body: [
          "Documentation that lives only on one engineer's local machine doesn't exist as far as the team is concerned. The goal is to make the current schema available to every engineer — and to non-engineers like product managers and data analysts — with zero friction.",
          "DBLuna's no-account share links serve this need for diagrams: one link, sharable via Slack or a Notion embed, that renders the current diagram in any browser. For teams that want a more formal documentation page with table descriptions and column notes formatted as a reference doc, DBLuna's documentation export generates a structured HTML page from the DBML file.",
          "Pinning the diagram link and the documentation URL in the engineering team's Slack channel description, Notion table of contents, or GitHub repository README eliminates the 'where is the schema?' question permanently.",
        ],
      },
    ],
    faq: [
      {
        question: "How often should database documentation be updated?",
        answer:
          "Every time the schema changes — which means every migration. If you maintain a DBML file in version control and update it with every pull request, the documentation is always current at zero additional cost. The mistake is treating documentation as a separate task from the migration, which creates a gap between the two that grows wider over time.",
      },
      {
        question: "Should non-engineers have access to the database documentation?",
        answer:
          "Yes, and this is often undervalued. Product managers who understand the data model ask better questions and write better specs. Data analysts who know the exact column semantics write correct queries the first time. BI engineers who understand the foreign-key structure build joins that are actually correct. Keeping the documentation behind an engineering-only wall costs the whole organisation.",
      },
      {
        question: "What's the difference between database documentation and a data dictionary?",
        answer:
          "A data dictionary is a specific type of database documentation that catalogs every field in a system with its name, type, description, and constraints — it reads like a reference manual. Broader database documentation includes ER diagrams, architectural context, data flow descriptions, and usage guidelines. Both are useful; the data dictionary answers 'what is this field?' while the architectural documentation answers 'how does this schema support the system?'",
      },
    ],
  },
];

export function getAllArticles(): Article[] {
  return [...articles].sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

export function getArticleBySlug(slug: string): Article | undefined {
  return articles.find((a) => a.slug === slug);
}

export function getRelatedArticles(currentSlug: string, count = 3): Article[] {
  return articles
    .filter((a) => a.slug !== currentSlug)
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    )
    .slice(0, count);
}

export const ARTICLE_SLUGS = articles.map((a) => a.slug);

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
