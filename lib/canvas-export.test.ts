import { describe, it, expect } from "vitest";
import { computeDiagramBounds } from "./canvas-export";
import type { Table, Note, Area } from "@/store/useCanvasStore";

const table: Table = { id: "t1", name: "users", x: 100, y: 100, color: "#000", columns: [] };
const note: Note = { id: "n1", x: -50, y: 0, width: 200, height: 100, title: "", content: "", color: "#000", isLocked: false };
const area: Area = { id: "a1", x: 500, y: 500, width: 300, height: 300, title: "", color: "#000", isLocked: false, zIndex: 0 };

describe("computeDiagramBounds", () => {
    it("returns a small placeholder box for an empty diagram", () => {
        const bounds = computeDiagramBounds([], [], []);
        expect(bounds.w).toBeGreaterThan(0);
        expect(bounds.h).toBeGreaterThan(0);
    });

    it("encloses every table/note/area with padding", () => {
        const bounds = computeDiagramBounds([table], [note], [area]);
        // note is the leftmost element at x=-50
        expect(bounds.x).toBeLessThan(-50);
        // area's right edge is the rightmost point (500 + 300)
        expect(bounds.x + bounds.w).toBeGreaterThan(800);
        expect(bounds.y).toBeLessThan(0);
        expect(bounds.y + bounds.h).toBeGreaterThan(800);
    });
});
