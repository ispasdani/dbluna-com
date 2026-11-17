# Implementation Plan: Phase 3 - SSMS Experience

This plan outlines the next steps to evolve the local Database Viewer into a more robust, full-featured Database Management tool that closely mirrors the look, feel, and functionality of SQL Server Management Studio (SSMS).

## Overview

In Phase 2, we successfully established a direct connection to a local SQL Server and built a basic view to list tables and display their top 100 rows. Phase 3 focuses on transforming this MVP into a professional, tabbed workspace with a hierarchical object explorer, context menus, and a dedicated query editor.

---

## Step 1: Implement an SSMS-Style Layout & Tabbed Workspace

Rethink the UI structure to support a resizable Object Explorer and multiple open tabs (e.g., query windows, table data views, schema designers), just like an IDE.

*   **Resizable Panels:** Use a library like `react-resizable-panels` to create a standard SSMS layout:
    *   Left Panel: Object Explorer.
    *   Main Area: Tabbed Document interface.
    *   Bottom Panel (conditional): Query Results / Messages.
*   **Tab System:** Replace the single main content area with a dynamic tab manager using Zustand to handle multiple open components (e.g., Tab 1: "dbo.Users - Top 1000", Tab 2: "SQLQuery1.sql").

## Step 2: The Object Explorer Tree

Upgrade the current flat table list into a hierarchical tree view component that replicates the SSMS Object Explorer structure.

*   **Tree Structure Component:** Build a collapsible tree using a UI component (e.g., Shadcn Accordion or a dedicated tree library).
*   **Hierarchy Levels:**
    *   Server Level (Localhost)
    *   Databases (System Databases, User Databases)
    *   Under each Database: Tables, Views, Programmability (Stored Procs, Functions).
*   **IPC Enhancements:** Add `db:getDatabases`, `db:getViews`, `db:getStoredProcedures` endpoints to feed the tree structure dynamically.

## Step 3: Context Menus & Actions

A key feature of SSMS is the ability to right-click database objects to perform context-specific actions.

*   **Custom Context Menu Component:** Implement a right-click drop-down menu tied to the Object Explorer tree nodes using Shadcn UI's Context Menu.
*   **Table Context Actions:**
    *   `Select Top 1000 Rows`: Opens a new tab with query results.
    *   `Design`: Opens a schema viewer showing column details (primary keys, types, nulls).
    *   `Script Table as -> CREATE To -> New Query Editor Window`.

## Step 4: Integrated T-SQL Query Editor

Provide a workspace where users can write, execute, and analyze custom T-SQL queries.

*   **Code Editor Component:** Integrate `@monaco-editor/react` to provide a VS Code-like editing experience with SQL syntax highlighting.
*   **Execution Runtime:** Add an "Execute (F5)" button that sends the editor's content to the backend via a new IPC handler (`db:executeQuery`).
*   **Results Pane:** Display query results in an interactive data grid below the editor, along with a "Messages" tab (e.g., "Commands completed successfully.").

---

## Conclusion

Phase 3 is an ambitious upgrade that brings true database management capabilities to dbluna. By implementing a resizable IDE layout, a hierarchical object tree, context menus, and a dedicated Monaco SQL editor, the application will provide a highly familiar and powerful experience for users transitioning from SSMS.
