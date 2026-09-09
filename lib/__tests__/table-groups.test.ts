import { describe, it, expect } from "vitest";
import {
  claimedTableNames,
  resolveGroupMembers,
  toggleGroupMember,
} from "@/lib/table-groups";
import type { CanvasTableGroup, Table } from "@/store/useCanvasStore";

const table = (name: string, id = crypto.randomUUID()): Table => ({
  id,
  name,
  x: 0,
  y: 0,
  color: "#6366f1",
  columns: [],
});

describe("resolveGroupMembers", () => {
  it("resolves schema-qualified members to their canvas tables", () => {
    const users = table("dbo.Users");
    const orders = table("orders");

    const resolved = resolveGroupMembers(["dbo.Users", "orders"], [users, orders]);

    expect(resolved.map((m) => m.table?.id)).toEqual([users.id, orders.id]);
  });

  it("keeps an unresolvable member instead of dropping it", () => {
    // Hand-written DBML can name a table that doesn't exist. Dropping it would
    // silently rewrite the user's schema on the next regenerate.
    const resolved = resolveGroupMembers(["ghost"], [table("orders")]);

    expect(resolved).toHaveLength(1);
    expect(resolved[0].name).toBe("ghost");
    expect(resolved[0].table).toBeNull();
  });

  it("matches case-sensitively, so a schema prefix cannot be fuzzily matched", () => {
    // Unlike enum types, table names are not uppercased anywhere in the DBML
    // round-trip, and the Docs sidebar compares them exactly.
    const resolved = resolveGroupMembers(["DBO.Users"], [table("dbo.Users")]);

    expect(resolved[0].table).toBeNull();
  });

  it("preserves member order", () => {
    const tables = [table("c"), table("a"), table("b")];

    const resolved = resolveGroupMembers(["b", "c", "a"], tables);

    expect(resolved.map((m) => m.name)).toEqual(["b", "c", "a"]);
  });

  it("picks the first of two identically named tables, as the Docs sidebar does", () => {
    const first = table("orders", "first");
    const second = table("orders", "second");

    const resolved = resolveGroupMembers(["orders"], [first, second]);

    expect(resolved[0].table?.id).toBe("first");
  });
});

describe("toggleGroupMember", () => {
  it("adds a name that is not present, appending it", () => {
    expect(toggleGroupMember(["a"], "b")).toEqual(["a", "b"]);
  });

  it("removes a name that is present", () => {
    expect(toggleGroupMember(["a", "b", "c"], "b")).toEqual(["a", "c"]);
  });

  it("does not mutate the input", () => {
    const input = ["a"];
    toggleGroupMember(input, "b");
    expect(input).toEqual(["a"]);
  });
});

describe("claimedTableNames", () => {
  it("collects names across every group, overlaps included", () => {
    const groups: CanvasTableGroup[] = [
      { id: "1", name: "Core", tableNames: ["users", "orders"] },
      { id: "2", name: "Billing", tableNames: ["orders", "invoices"] },
    ];

    expect(claimedTableNames(groups)).toEqual(new Set(["users", "orders", "invoices"]));
  });

  it("is empty for no groups", () => {
    expect(claimedTableNames([])).toEqual(new Set());
  });
});
