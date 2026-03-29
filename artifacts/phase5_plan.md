# Implementation Plan: Phase 5 - Advanced Tools & Data-Tier Applications

This plan outlines the next phase of development to transform the Database Viewer into a fully-fledged database management IDE, closing the feature gap with tools like SSMS and Azure Data Studio.

## Goal Description
Phase 5 focuses on introducing advanced tooling, robust Data-Tier Application (BACPAC) support, and a richer query editing experience.

---

## Proposed Changes

### 1. Robust Data-Tier Applications (Import/Export .bacpac)
Currently, the import feature is an MVP that uses a dummy simulation if `sqlpackage.exe` is missing, and we do **not** support exporting. We will build an integrated, production-ready solution.

*   **Export BACPAC Support [NEW]**:
    *   Add a context menu option on Databases: `Tasks -> Export Data-tier Application...`.
    *   Create a new Shadcn UI Dialog `export-dialog.tsx` to prompt for: target save file location (using Electron's file saver), source database name, and advanced properties.
    *   Implement IPC handler `job:runExport` in `main.js` to execute `sqlpackage.exe /Action:Export`.
*   **Import BACPAC Upgrades [MODIFY]**:
    *   Enhance `import-dialog.tsx` to allow specifying the Target Database Name and Storage Paths.
    *   Remove the dummy simulation in `main.js`. If `sqlpackage.exe` is missing, provide a clear UI error prompting the user to install the Microsoft SQL Server Data-Tier Application Framework.
    *   A `.bacpac` file encapsulates both database schema and data automatically. By executing `sqlpackage.exe /Action:Import`, we guarantee that 100% of structure, tables, and records are restored accurately.

### 2. Premium SQL Query Editor (IntelliSense)
A simple text area is insufficient for a premium tool. We need true code completion and syntax highlighting identical to Azure Data Studio/VS Code.

*   **Monaco Editor Integration [NEW/MODIFY]**:
    *   Replace the standard `<textarea>` in `query-tab.tsx` with `@monaco-editor/react`.
    *   Configure Monaco for the SQL language, enabling syntax highlighting, auto-matching brackets, and minimap support.
    *   Provide SQL schema intelligence to the editor so users get autocomplete for their specific tables and columns.

### 3. Query Results Enhancements
Power users need to extract data easily.

*   **Export to CSV/JSON [NEW]**:
    *   Add "Export to CSV" and "Export to JSON" buttons to the action toolbar above the Query Results grid.
    *   Implement an Electron IPC channel to convert the `recordset` object array into a `.csv` or `.json` file and save it to disk.

### 4. Object Scripting (Script as CREATE/DROP)
A core feature of SSMS is generating T-SQL scripts for existing database objects without writing them manually.

*   **Script Generation [NEW]**:
    *   Add context menu options to Tables/Views/Stored Procedures in the Object Explorer:
        *   `Script Table as -> CREATE To -> New Query Window`
        *   `Script Table as -> SELECT To -> New Query Window`
    *   Implement an IPC handler to query the SQL Server system catalogs (`sys.sql_modules`, `sys.tables`, etc.) to generate the raw text script for the object and open a new `query-tab` with it.

---

## User Review Required

> [!CAUTION]
> **Dependency Requirement:** For fully functional Import/Export, the user's host machine must have `sqlpackage.exe` installed and available in their system `PATH`. We should decide whether to build a settings menu for users to provide a custom path to `SqlPackage.exe`, or force them to install it globally.

## Open Questions

1.  **Monaco Editor Theme:** Do you want the query editor to strictly match the Claude aesthetic, or should it resemble a typical dark theme VS Code/Azure Data Studio editor?
2.  **`SqlPackage.exe`:** Do you prefer we add a "Settings" page right now to let the user configure the path to `SqlPackage`, or just rely on it being in the global environment PATH?

## Verification Plan

### Automated Tests
*   Run the Electron build and ensure no breaking UI changes occur with the new context menus.

### Manual Verification
1.  Right-click a connected database and export it to a local `.bacpac` file.
2.  Delete the database, then import the `.bacpac` file to ensure 100% of data and schema is restored.
3.  Type a query in the new Monaco editor to verify syntax highlighting and hotkeys work (F5 to run).
4.  Export a query result to a `.csv` file and verify it opens correctly in Excel.
