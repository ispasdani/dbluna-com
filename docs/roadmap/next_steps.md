# Project Roadmap & Next Steps

This document outlines the planned features and technical improvements for the **dbluna** project.

## 🚀 Immediate Next Steps

### 1. Convex Backend Connection
Integration of the frontend with the Convex backend to enable persistent storage and real-time updates.
- **Data Synchronization**: Implement hooks to sync the Zustand store with Convex mutations and queries.
- **Persistence**: Ensure diagrams are saved automatically upon changes (debounced).
- **Schema Validation**: Align the frontend data structures with the Convex `schema.ts`.

### 2. General Diagramming Functionality (Diagrams.net / Draw.io style)
Expand the tool's capabilities beyond database schemas to allow for general documentation and flowcharts.
- **Custom Shapes**: Add support for standard flowchart shapes (rectangles, diamonds, circles, etc.).
- **Rich Text Documentation**: Allow users to create "Documentation Blocks" using a Markdown editor or rich text.
- **Freehand Drawing**: Introduce basic sketching tools for quick annotations.
- **Image Embeds**: Enable users to upload or link images within their diagrams.

## ✨ Future Features

### 3. Real-time Collaboration
Leaveraging Convex's real-time capabilities to allow multiple users to work on the same diagram simultaneously.
- **Presence Indicators**: Show who else is viewing or editing the diagram.
- **Conflict Resolution**: Implement optimistic updates with robust rollback logic.

### 4. Versioning & History
- **Snapshotting**: Create save points for diagrams.
- **Undo/Redo (Global)**: Persistent undo/redo history across sessions.
- **Diff View**: Visually compare different versions of a schema.

### 5. Advanced SQL Support
- **Multi-Dialect Export**: Support for PostgreSQL, MySQL, SQLite, and MSSQL.
- **SQL-to-Diagram**: Improve the parser to handle complex `CREATE TABLE` statements and existing database introspection.

### 6. Templates & Industry Standards
- **Pre-built Templates**: Provide starting points for common application architectures (e.g., E-commerce, SaaS, Blog).
- **Compliance Checks**: Integrated linting for database design best practices (e.g., missing indexes, normalization warnings).

---
> [!NOTE]
> This roadmap is a living document and will be updated as project requirements evolve.
