# Implementation Plan: Phase 2 - Local Database Viewer

This plan outlines the steps to build a lightweight, read-only SQL Server "Database Viewer" directly into the `dbluna-com` Electron Desktop Workstation. 

## Overview
Currently, the workstation can import `.bacpac` files into a local SQL Server, but the user must leave the application and use a third-party tool like DBeaver or Azure Data Studio to verify the data.

The goal of Phase 2 is to create a seamless experience where, immediately after a successful import, the dashboard transitions into a Database Explorer that allows the user to browse their tables, view schemas, and query sample data securely from within the Electron app.

---

## Step 1: Install SQL Driver & Setup Backend Connection

We will utilize the `mssql` Node.js package in the Electron main process to establish direct connections to the target SQL Server instance and query metadata.

### Proposed Changes

#### [MODIFY] [package.json]
*   Add dependencies: `mssql` (The Microsoft SQL Server Node.js driver).

#### [MODIFY] [electron/main.js]
*   Import `mssql`.
*   Establish state to securely hold the current connection pool instance.
*   Add IPC Handlers:
    *   `db:connect`: Accepts a connection string/config, connects to SQL Server via `mssql`, and persists the active pool.
    *   `db:getTables`: Executes a system query (e.g., `SELECT * FROM INFORMATION_SCHEMA.TABLES;`) to retrieve all available tables in the database.
    *   `db:queryTable`: Accepts a table name and securely executes `SELECT TOP 100 * FROM [tableName]` to fetch sample row data.
    *   `db:disconnect`: Closes the active pool.

#### [MODIFY] [electron/preload.js]
*   Add context bridge methods for the new IPC commands:
    *   `connectDb: (config) => ipcRenderer.invoke('db:connect', config)`
    *   `getTables: () => ipcRenderer.invoke('db:getTables')`
    *   `queryTable: (tableName) => ipcRenderer.invoke('db:queryTable', tableName)`
    *   `disconnectDb: () => ipcRenderer.invoke('db:disconnect')`

---

## Step 2: Build the Database Explorer UI

We will construct a new React view in the desktop route that acts as the Database Viewer layout. It will feature a sidebar for navigation and a main content area for the data grid.

### Proposed Changes

#### [NEW] [app/(desktop)/desktop/explorer/page.tsx]
*   Create a new route for the Database Explorer.
*   **Sidebar Component:**
    *   On mount, calls `window.electron.getTables()` and populates a vertical list categorizing tables by schema.
    *   Allows the user to click a table name to set it as the "Active Table".
*   **Data Grid Component:**
    *   When an Active Table is selected, calls `window.electron.queryTable(activeTable)`.
    *   Renders an interactive, scrollable HTML table displaying the column headers and the top 100 rows.

#### [MODIFY] [app/(desktop)/desktop/page.tsx]
*   Update the "Bacpac Importer" MVP logic.
*   When `runImport` returns a "success" state code, expose a new prominent button: **"Open Database Explorer"**.
*   Clicking this button pushes the router to `/desktop/explorer` automatically triggering the connection and the explorer UI.

---

## Step 3: Integrate Existing Component Libraries

To make the Explorer look beautiful and premium, we will leverage modern UI elements already available in the application context.

### Proposed Changes

#### [MODIFY] [app/(desktop)/desktop/explorer/page.tsx]
*   Implement Shadcn UI `Table` components or generic styled robust Tailwind tables for visualizing the row data.
*   Implement Shadcn UI `ScrollArea` for the left sidebar to elegantly handle hundreds of table names.
*   Incorporate lucide-react icons (e.g., `Database`, `Table`, `Columns`) for premium visual cues.

---

## Verification Plan

### Manual Verification
1.  **Backend Connectivity:** Boot Electron, and execute `window.electron.connectDb()` with valid local credentials. Ensure the IPC returns a success payload without crashing.
2.  **Metadata Extraction:** Call `window.electron.getTables()`. Verify that it accurately parses the `INFORMATION_SCHEMA` and returns a JSON array of table object definitions to React.
3.  **Data Hydration:** Select a table with known mock data and trigger `window.electron.queryTable(name)`. Ensure the React UI grid renders identical row values to what is seen in traditional DB management tools.
4.  **Graceful Teardown:** Verify that closing the desktop application implicitly severs the `mssql` connection pool without leaving hanging connections.
