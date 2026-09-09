import { describe, it, expect } from "vitest";
import { splitSchemaName } from "@/lib/schema-namespace";

describe("splitSchemaName", () => {
  it("splits a schema-qualified name", () => {
    expect(splitSchemaName("dbo.Users")).toEqual({ schema: "dbo", table: "Users" });
  });

  it("strips square brackets from both parts", () => {
    expect(splitSchemaName("[Ncr].Orders")).toEqual({ schema: "Ncr", table: "Orders" });
    expect(splitSchemaName("[Ncr].[Orders]")).toEqual({ schema: "Ncr", table: "Orders" });
  });

  it("treats an unqualified name as having no schema", () => {
    expect(splitSchemaName("users")).toEqual({ schema: null, table: "users" });
  });

  it("does not treat a leading dot as a schema qualifier", () => {
    // dotIdx === 0, so the name is preserved verbatim rather than yielding an
    // empty schema — matches the generator's original behavior.
    expect(splitSchemaName(".users")).toEqual({ schema: null, table: ".users" });
  });

  it("splits on the first dot only, so further dots stay in the table part", () => {
    expect(splitSchemaName("dbo.my.table")).toEqual({ schema: "dbo", table: "my.table" });
  });

  it("handles an empty name", () => {
    expect(splitSchemaName("")).toEqual({ schema: null, table: "" });
  });
});
