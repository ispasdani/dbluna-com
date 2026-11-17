# Tables Tab (Left Dock) — Functionality Overview in drawdb.app

The **Tables Tab** is the primary structural control panel for managing database tables outside of the visual canvas.  
It mirrors the canvas state and allows **direct, form-based editing** of tables and their fields.

---

## 1. Purpose of the Tables Tab

The Tables Tab acts as:

- A **source-of-truth view** of all tables in the diagram
- A **non-visual editing interface** for table structure
- A **synchronized companion** to the canvas

Any table that exists on the canvas is **always reflected** in the Tables Tab, and vice versa.

---

## 2. Adding a Table

### Add Table Flow

1. User clicks **“Add Table”** in the Tables Tab
2. A new table is created in the internal data model
3. The table:
   - Appears instantly on the **canvas**
   - Appears instantly in the **Tables Tab list**
4. The table is ready for editing both visually (canvas) and structurally (tab)

There is **no distinction** between tables created from the canvas or from the Tables Tab—they are the same entities.

---

## 3. Tables List (Left Dock)

The Tables Tab displays a **list of all tables** in the diagram:

- Each list item represents **one table**
- The list updates live as tables are:
  - Added
  - Renamed
  - Deleted

This list provides fast navigation and an overview without needing to pan or zoom the canvas.

---

## 4. Selecting a Table

### Selection Synchronization

- Clicking a table in the **Tables Tab**:
  - Selects the corresponding table on the canvas
  - Brings it into focus (visually highlighted)
- Selecting a table on the **canvas**:
  - Highlights the same table in the Tables Tab

This creates a **bidirectional selection model** between the canvas and the dock.

---

## 5. Editing Table Properties

From the Tables Tab, users can edit table-level properties such as:

- Table name
- Table structure (fields / columns)

Changes made here:

- Update the internal model immediately
- Are reflected live on the canvas (no manual refresh)

This allows precise edits without relying on canvas interactions.

---

## 6. Managing Fields (Columns)

Within each table entry, the Tables Tab provides controls to:

- Add new fields
- Rename fields
- Change field types
- Toggle constraints (e.g., primary key, nullable)

All field-level changes:

- Instantly update the rendered table on the canvas
- Maintain existing relationships where possible

This makes the Tables Tab the **most efficient place for bulk or detailed schema editing**.

---

## 7. Deleting Tables or Fields

- Deleting a table from the Tables Tab:
  - Removes it from the internal model
  - Removes it from the canvas
  - Removes it from the Tables list
- Deleting a field:
  - Updates the table visually
  - Removes or updates related connections if applicable

The Tables Tab enforces **structural consistency** across the diagram.

---

## 8. Relationship Awareness (Indirect Control)

While relationships are usually drawn on the canvas:

- The Tables Tab reflects relational changes indirectly
- Field-level edits may affect:
  - Relationship endpoints
  - Validity of connections

This ensures the tab remains schema-aware even if relationships are visually managed.

---

## 9. Why the Tables Tab Matters

The Tables Tab enables:

- Fast, keyboard-driven schema editing
- Clean management of large diagrams
- Editing without canvas clutter or zooming
- A clear separation between:
  - **Structure (Tables Tab)**
  - **Layout (Canvas)**

It is especially useful when working with **many tables or complex schemas**.

---

## Summary

- The Tables Tab is a **live mirror** of the canvas tables
- It provides **full CRUD control** over tables and fields
- Selection and edits are **fully synchronized** with the canvas
- It serves as the **structural editing hub** of drawdb.app

In short:  
**Canvas = visual layout**  
**Tables Tab = schema control**
