# Styling of Tables in drawdb.app (as rendered on the canvas)

## 1. Overall “card” look

- Tables read visually like **small cards/panels** on the diagram surface:
  - A **bounded rectangle** (the table container)
  - A **header area** at the top containing the table name
  - A **stacked list of field rows** below the header :contentReference[oaicite:1]{index=1}

---

## 2. Header styling

- The header is a distinct band that:
  - Displays the **table name**
  - Stays visually separated from the field list (clear header/body division) :contentReference[oaicite:2]{index=2}

- Long names are handled in a constrained width layout (the app historically uses a fixed-ish table width, leading to truncation/ellipsis when names are long). :contentReference[oaicite:3]{index=3}

---

## 3. Color identity strip

- Each table includes a **thin color strip at the top** (a “tag”/accent) used for quick visual identification among many tables. :contentReference[oaicite:4]{index=4}

---

## 4. Field rows (columns list)

- The body is a vertical list of **field rows**:
  - Field name
  - Optional field type (can be toggled via editor settings) :contentReference[oaicite:5]{index=5}
- Rows are visually separated to improve scanability (spacing and/or dividers). :contentReference[oaicite:6]{index=6}

---

## 5. Indicators and small glyphs

- Field rows can show compact indicators such as:
  - **Primary key** marker
  - **Non-null** marker :contentReference[oaicite:7]{index=7}

These are usually subtle “metadata” UI elements (small icons or abbreviated marks) aligned within each row.

---

## 6. Relationship grip points

- Each field row supports **connection points (“grips”)** used to create relationships.
- These grips behave like interactive affordances (commonly appearing on hover and/or near the row edge), enabling “drag to connect” behavior. :contentReference[oaicite:8]{index=8}

---

## 7. Selection and interaction states

- Tables have clear interaction styling for editing:
  - **Hover affordances** (edit controls appear on hover)
  - **Selected state** with a highlighted outline/border (described as a blue highlight in the canvas behavior docs) :contentReference[oaicite:9]{index=9}
- Dragging and positioning is smooth because the table is treated as a movable element within the canvas system. :contentReference[oaicite:10]{index=10}

---

## 8. Theme-aware appearance

- The editor supports **light/dark mode**, so the table’s background/text/border styling adapts accordingly. :contentReference[oaicite:11]{index=11}

---

## Summary

- **Card-like container**
- **Distinct header** + **colored accent strip**
- **Structured field list** with optional types and constraint markers
- **Grip points** for relationships
- **Hover + selection styling**
- **Theme-aware** (light/dark)
