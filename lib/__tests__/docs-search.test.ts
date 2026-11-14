import { expect, it } from "vitest";
import { docsItemId, findDocsTable, searchDocs } from "@/lib/docs-search";
import { parseDbml } from "@/lib/parser/dsl-parser";

it("ranks exact names above prefix and description matches", () => {
  const { tables, enums } = parseDbml(`
    Table sales.Account {
      id int
    }
    Table sales.AccountHistory {
      id int
    }
    Table archive.Events {
      id int [note: 'Original account']
    }
  `)!;
  const results = searchDocs(tables, enums, " account ", "", "");
  expect(results.slice(0, 2).map(result => result.name))
    .toEqual(["sales.Account", "sales.AccountHistory"]);
  expect(results.at(-1)?.owner?.name).toBe("Events");
});

it("filters by schema and kind and identifies the owning table for member matches", () => {
  const { tables, enums } = parseDbml(`
    Table sales.Account {
      id int
    }
    Table archive.Account {
      id int
    }
  `)!;
  const sales = tables.find(table => table.schema?.name === "sales")!;
  const archive = tables.find(table => table.schema?.name === "archive")!;
  sales.sqlServerIndexes = [{
    name: "UQ_Account", kind: "unique constraint", columns: ["id"], includedColumns: [], unique: true,
  }];
  const matches = searchDocs(tables, enums, "", "sales", "Unique constraint");
  expect(matches).toHaveLength(1);
  expect(matches[0]).toMatchObject({ name: "UQ_Account", owner: { id: sales.id } });
  expect(searchDocs(tables, enums, "archive.Account.id", "", "Column")[0]?.owner).toBe(archive);
  expect(docsItemId(sales, "Column", "id")).not.toBe(docsItemId(archive, "Column", "id"));
  expect(findDocsTable(tables, "archive.Account")).toBe(archive);
  expect(findDocsTable(tables, "Account")).toBeUndefined();
  expect(findDocsTable([sales], "Account")).toBe(sales);
  archive.fields[0].description = "Imported archive identifier";
  expect(searchDocs(tables, enums, "imported archive", "", "Column")[0]?.owner).toBe(archive);
});
