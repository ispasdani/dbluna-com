# Implementation Plan: Phase 4 - Dynamic Connections & Styling Refinement

This plan outlines the next steps to evolve the local Database Viewer into a more robust tool, removing hardcoded values and refining the UI to closely match a premium SQL Server Management Studio (SSMS) experience.

## Overview

In Phase 3, we successfully implemented a tabbed workspace, a hierarchical object explorer, and basic querying capabilities. However, connections are currently hardcoded, and the UI lacks the final polish of a professional tool. Phase 4 addresses these issues by introducing dynamic connection management and visual refinements.

---

## Step 1: Dynamic "Connect to Server" Dialog

Remove the hardcoded `sa` and `daniel` credentials from the codebase. Implement a startup dialog similar to SSMS.

*   **Connection Modal:** Create a new Shadcn UI Dialog that prompts the user for:
    *   Server type (default to Database Engine).
    *   Server name (e.g., `localhost`, `.\SQLEXPRESS`).
    *   Authentication mode (Windows Authentication vs. SQL Server Authentication).
    *   Username and Password (if SQL Auth is selected).
    *   Connection Options: Encrypt connection, Trust server certificate.
*   **State Management:** Store the active connection details in a global state so all components can access the active connection string/context without having to pass it deeply down the tree.

## Step 2: Connection Persistence and History

Allow the user to see the explorer and revisit past connections without always needing to re-enter credentials or import files (.bacpac).

*   **Recent Connections:** Save successfully used connection profiles (Server Name, Username, Auth Type) to local storage or an Electron store so they can be selected quickly from a dropdown on the connect screen.
*   **Secure Storage:** Focus on usability first by saving the connection details. For passwords, either require them per-session or explore secure OS-level keychain storage via electron in the future.

## Step 3: SSMS Styling & UI Polish

Enhance the styling to be more dense, professional, and visually appealing, akin to a sophisticated IDE.

*   **Density:** Reduce padding and margins in the Object Explorer tree and Data Grids to match the high-information density expectations of power users.
*   **Icons & Theming:** Use consistent, SSMS-style icons for servers, databases, folders, and tables. Ensure the dark theme is premium (deep grays, clear accent colors).
*   **Splitters:** Make the resizable panel splitters more visible or give them an intuitive hover state.

## Step 4: Refactoring `explorer/page.tsx`

*   Update the `useEffect` hook that automatically connects on mount. Instead, it should present the Connect Dialog to the user, or auto-connect using a saved default profile if one is selected.
*   Gracefully handle connection drops and provide a "Disconnect" or "Connect Object Explorer..." option in the UI to manage the active session.

---

## Conclusion

Phase 4 will transform the application from a hardwired MVP into a dynamic, production-ready developer tool. Users will be able to manage connections fluidly, and the polished UI will feel like a natural, modern successor to SSMS.
