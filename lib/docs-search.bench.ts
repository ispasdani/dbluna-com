import { bench, describe } from "vitest";
import { searchDocs } from "@/lib/docs-search";
import type { ParsedTable } from "@/lib/parser/dsl-parser";

const tables: ParsedTable[] = Array.from({ length: 1000 }, (_, id) => ({
  id,
  name: "Table" + id,
  schema: { name: "schema" + id % 10 },
  fields: Array.from({ length: 30 }, (_, column) => ({
    id: column,
    name: "Column" + column,
    type: { type_name: "int" },
    pk: false,
    unique: false,
    not_null: false,
    increment: false,
    description: "Synthetic description " + column,
  })),
}));

describe("documentation search across 1,000 tables and 30,000 columns", () => {
  bench("qualified name", () => {
    searchDocs(tables, [], "schema9.Table999.Column29", "", "");
  });
  bench("filtered description", () => {
    searchDocs(tables, [], "synthetic description 29", "schema9", "Column");
  });
});
