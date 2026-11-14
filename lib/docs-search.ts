import type { ParsedEnum, ParsedTable } from "@/lib/parser/dsl-parser";

export type DocsSearchKind = "Table" | "Column" | "Index" | "Unique constraint" | "Enum";

type NamedObject = Pick<ParsedTable, "name" | "schema">;

function noteText(note: string | { value: string } | undefined) {
  return typeof note === "string" ? note : note?.value;
}

export function docsQualifiedName(object: NamedObject) {
  return object.schema?.name ? [object.schema.name, object.name].join(".") : object.name;
}

export function docsItemId(owner: NamedObject, kind: DocsSearchKind, name: string) {
  return "docs-" + encodeURIComponent(JSON.stringify([owner.schema?.name, owner.name, kind, name]));
}

interface SearchEntry {
  kind: DocsSearchKind;
  name: string;
  id: number;
  owner?: ParsedTable;
}

export function searchDocs(
  tables: ParsedTable[], enums: ParsedEnum[], query: string, schema: string, kind: DocsSearchKind | "",
) {
  const needle = query.trim().toLowerCase();
  const results: Array<SearchEntry & { rank: number }> = [];
  const add = (entry: SearchEntry, object: NamedObject, qualified: string, text: Array<string | undefined>) => {
    if ((schema && schema !== object.schema?.name) || (kind && kind !== entry.kind)) return;
    const names = [entry.name, qualified].map(name => name.toLowerCase());
    const rank = names.includes(needle) ? 0
      : names.some(name => name.startsWith(needle)) ? 1
      : names.some(name => name.includes(needle)) ? 2
      : text.some(value => value?.toLowerCase().includes(needle)) ? 3 : -1;
    if (rank >= 0) results.push({ ...entry, rank });
  };

  for (const table of tables) {
    const qualified = docsQualifiedName(table);
    add({ kind: "Table", name: qualified, id: table.id }, table, table.name, [noteText(table.note)]);
    for (const column of table.fields) {
      add({ kind: "Column", name: column.name, id: table.id, owner: table }, table,
        qualified + "." + column.name, [column.type.type_name, noteText(column.note), column.defaultExpression, column.computedExpression]);
    }
    for (const index of table.sqlServerIndexes ?? []) {
      add({ kind: index.kind === "index" ? "Index" : "Unique constraint", name: index.name, id: table.id, owner: table },
        table, qualified + "." + index.name, [...index.columns, ...index.includedColumns, index.filter]);
    }
  }
  for (const item of enums) {
    add({ kind: "Enum", name: docsQualifiedName(item), id: item.id }, item, item.name,
      [noteText(item.note), ...item.values.map(value => value.name)]);
  }
  return results.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
}
