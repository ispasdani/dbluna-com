import { describe, it, expect } from "vitest";
import { compressToEncodedURIComponent } from "lz-string";
import { encodeDiagramForShare, decodeDiagramFromShare } from "@/lib/share-link";
import type { DiagramData } from "@/store/useCanvasStore";

function buildDiagram(): DiagramData {
  return {
    name: "Test diagram",
    updatedAt: Date.now(),
    tables: [
      {
        id: crypto.randomUUID(),
        name: "users",
        x: 10,
        y: 20,
        color: "#6366f1",
        columns: [
          {
            id: crypto.randomUUID(),
            name: "id",
            type: "INT",
            isPrimaryKey: true,
            isNotNull: true,
            isUnique: true,
            isAutoIncrement: true,
          },
        ],
      },
    ],
    notes: [
      {
        id: crypto.randomUUID(),
        x: 0,
        y: 0,
        width: 200,
        height: 150,
        title: "Note",
        content: "hello",
        color: "#e11d48",
        isLocked: false,
      },
    ],
    areas: [
      {
        id: crypto.randomUUID(),
        x: 0,
        y: 0,
        width: 500,
        height: 400,
        title: "Area",
        color: "#94a3b8",
        isLocked: false,
        zIndex: 0,
      },
    ],
    relationships: [],
    enums: [
      { id: crypto.randomUUID(), name: "status", values: [{ name: "active" }, { name: "inactive" }] },
    ],
    tableGroups: [{ id: crypto.randomUUID(), name: "core", tableNames: ["users"] }],
    project: { name: "Test project", databaseType: "PostgreSQL", note: "readme" },
    background: "dots",
    snapToGrid: true,
    isFocusModeEnabled: false,
  };
}

describe("share-link round-trip", () => {
  it("decodes exactly what was encoded, including enums/tableGroups/project", () => {
    const diagram = buildDiagram();
    const fragment = encodeDiagramForShare(diagram);
    const decoded = decodeDiagramFromShare(fragment);

    expect(decoded).not.toBeNull();
    expect(decoded!.name).toBe(diagram.name);
    expect(decoded!.tables).toEqual(diagram.tables);
    expect(decoded!.notes).toEqual(diagram.notes);
    expect(decoded!.areas).toEqual(diagram.areas);
    expect(decoded!.relationships).toEqual(diagram.relationships);
    expect(decoded!.enums).toEqual(diagram.enums);
    expect(decoded!.tableGroups).toEqual(diagram.tableGroups);
    expect(decoded!.project).toEqual(diagram.project);
    expect(decoded!.background).toBe("dots");
    expect(decoded!.snapToGrid).toBe(true);
    expect(decoded!.isFocusModeEnabled).toBe(false);
  });

  it("defaults enums/tableGroups/project when decoding an older envelope missing them", () => {
    const diagram = buildDiagram();
    // Simulate a pre-DBML-integration link: a real envelope, correctly
    // compressed, but from before enums/tableGroups/project existed.
    const legacyEnvelope = {
      v: 1,
      name: diagram.name,
      tables: diagram.tables,
      notes: diagram.notes,
      areas: diagram.areas,
      relationships: diagram.relationships,
      background: diagram.background,
      snapToGrid: diagram.snapToGrid,
      isFocusModeEnabled: diagram.isFocusModeEnabled,
    };
    const fragment = compressToEncodedURIComponent(JSON.stringify(legacyEnvelope));
    const decoded = decodeDiagramFromShare(fragment);

    expect(decoded).not.toBeNull();
    expect(decoded!.enums).toEqual([]);
    expect(decoded!.tableGroups).toEqual([]);
    expect(decoded!.project).toBeNull();
    expect(decoded!.tables).toEqual(diagram.tables);
  });

  it("returns null for garbage input", () => {
    expect(decodeDiagramFromShare("not-a-real-fragment")).toBeNull();
    expect(decodeDiagramFromShare("")).toBeNull();
  });

  it("returns null for a truncated fragment", () => {
    const diagram = buildDiagram();
    const fragment = encodeDiagramForShare(diagram);
    const truncated = fragment.slice(0, Math.floor(fragment.length / 2));
    expect(decodeDiagramFromShare(truncated)).toBeNull();
  });
});
