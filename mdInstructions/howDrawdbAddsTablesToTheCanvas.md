# How drawdb.app Adds Tables to the Canvas

## 1. SVG, not raster images

Each table you add is represented as a **group of SVG elements**:

- `<rect>` for the table container and rows
- `<text>` for table name, columns, and types
- `<line>` or `<path>` for separators

This makes tables:

- Crisp at any zoom level
- Easily movable, resizable, and editable
- Exportable as SVG / PNG / PDF without quality loss

---

## 2. Canvas ≠ HTML DOM

Even though it looks like a normal UI, the diagram area is **not HTML divs**.

- It’s a **single SVG canvas** (or SVG layered over a lightweight canvas)
- Interactions (drag, resize, connect) are handled via:
  - Pointer / mouse events
  - Transform attributes (`translate`, `scale`)
  - Re-rendering the affected SVG nodes

---

## 3. Why SVG is a Good Choice for DrawDB

SVG gives drawdb exactly what it needs:

| Requirement       | Why SVG works                  |
| ----------------- | ------------------------------ |
| Zoom & pan        | Vector-based, no blur          |
| Dragging tables   | Update `transform`             |
| Connecting tables | Dynamic `<path>` edges         |
| Export diagrams   | Native SVG export              |
| Performance       | Fine for medium-sized diagrams |

---

## 4. Not Canvas-only, Not Images

- ❌ Not `<canvas>`-only drawing (that would make editing harder)
- ❌ Not pre-rendered images
- ✅ Structured vector scene graph (SVG)

This also explains why:

- You can select individual text
- Connectors snap precisely
- Layout stays sharp when zooming

---

## 5. Typical Internal Model

Internally, drawdb likely uses:

- A JSON data model for tables / columns / relations
- A render layer that converts that model → SVG
- Libraries like:
  - Custom SVG rendering
  - Or helpers similar to **Konva**, **D3**, or **React + SVG**

---

## TL;DR

- Tables in **drawdb.app are SVG elements**
- Each table is a structured group of SVG shapes + text
- This enables smooth interaction, zooming, and exporting
