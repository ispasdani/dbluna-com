import { describe, it, expect } from "vitest";
import { generateSqlFromCanvas } from "./sql-generator";
import type { Table, Relationship } from "@/store/useCanvasStore";

const usersTable: Table = {
    id: "t1",
    name: "users",
    x: 0,
    y: 0,
    color: "#000",
    columns: [
        { id: "c1", name: "id", type: "integer", isPrimaryKey: true, isNotNull: true, isUnique: false, isAutoIncrement: true },
        { id: "c2", name: "email", type: "varchar", isPrimaryKey: false, isNotNull: true, isUnique: true, isAutoIncrement: false },
    ],
};

const postsTable: Table = {
    id: "t2",
    name: "posts",
    x: 0,
    y: 0,
    color: "#000",
    columns: [
        { id: "c3", name: "id", type: "integer", isPrimaryKey: true, isNotNull: true, isUnique: false, isAutoIncrement: true },
        { id: "c4", name: "user_id", type: "integer", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
    ],
};

const relationship: Relationship = {
    id: "r1",
    name: "",
    sourceTableId: "t2",
    sourceColumnId: "c4",
    targetTableId: "t1",
    targetColumnId: "c1",
    cardinality: "Many to one",
    onUpdate: "No action",
    onDelete: "No action",
};

describe("generateSqlFromCanvas", () => {
    it("generates postgres DDL with primary key and foreign key", () => {
        const sql = generateSqlFromCanvas([usersTable, postsTable], [relationship], "postgres");
        expect(sql).not.toBeNull();
        expect(sql).toContain('CREATE TABLE "users"');
        expect(sql).toContain('CREATE TABLE "posts"');
        expect(sql).toMatch(/PRIMARY KEY/i);
        expect(sql).toMatch(/FOREIGN KEY/i);
    });

    it("generates SQL for every supported dialect", () => {
        for (const dialect of ["postgres", "mysql", "mssql", "oracle"] as const) {
            const sql = generateSqlFromCanvas([usersTable], [], dialect);
            expect(sql, `dialect=${dialect}`).not.toBeNull();
            expect(sql!.length).toBeGreaterThan(0);
        }
    });

    it("doesn't throw for an empty diagram", () => {
        const sql = generateSqlFromCanvas([], [], "postgres");
        expect(sql).not.toBeNull();
    });
});
