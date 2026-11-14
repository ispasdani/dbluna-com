import sax from "sax";
import { qualifySqlServerTable } from "@/lib/schema-namespace";
import type { Readable } from "node:stream";
import type { Relationship, SqlServerIndex, SqlServerObject } from "@/store/useCanvasStore";

interface ModelElement {
  type: string;
  name: string;
  properties: Map<string, string>;
  references: Map<string, string[]>;
  children: Map<string, ModelElement[]>;
}

interface ModelColumn {
  name: string;
  type: string;
  isPk: boolean;
  isNotNull: boolean;
  isUnique: boolean;
  isAutoIncrement: boolean;
  defaultExpression?: string;
  computedExpression?: string;
  description?: string;
}

interface ModelTable {
  name: string;
  columns: ModelColumn[];
  primaryKey?: string[];
  sqlServerIndexes?: SqlServerIndex[];
  description?: string;
}

function identifierParts(name: string) {
  return name.match(/\[(?:[^\]]|\]\])*\]|[^.]+/g)?.map((part) =>
    part.startsWith("[") ? part.slice(1, -1).replace(/\]\]/g, "]") : part,
  ) ?? [];
}

const identity = (parts: string[]) => JSON.stringify(parts);
const displayTable = (parts: string[]) =>
  parts.length === 2 ? qualifySqlServerTable(parts[0], parts[1]) : parts.join(".");
const refs = (element: ModelElement, name: string) => element.references.get(name) ?? [];
const children = (element: ModelElement, name: string) => element.children.get(name) ?? [];
const flag = (element: ModelElement, name: string) =>
  element.properties.get(name)?.toLowerCase() === "true";

function columnType(column: ModelElement) {
  const spec = children(column, "TypeSpecifier")[0] ?? column;
  const type = identifierParts(refs(spec, "Type")[0] ?? "").join(".");
  if (!type) return "unknown";
  const normalized = type.toLowerCase();
  const length = spec.properties.get("Length");
  const precision = spec.properties.get("Precision");
  const scale = spec.properties.get("Scale");
  if (flag(spec, "IsMax")) return `${type}(max)`;
  if (["decimal", "numeric"].includes(normalized) && precision) {
    return `${type}(${precision},${scale ?? "0"})`;
  }
  if (["datetime2", "datetimeoffset", "time"].includes(normalized) && scale) {
    return `${type}(${scale})`;
  }
  if (["binary", "char", "nchar", "nvarchar", "varbinary", "varchar"].includes(normalized) && length) {
    return `${type}(${length})`;
  }
  if (normalized === "float" && precision) return `${type}(${precision})`;
  return type;
}

function action(value = "0"): Relationship["onDelete"] | undefined {
  const actions: Record<string, Relationship["onDelete"]> = {
    "0": "No action", noaction: "No action",
    "1": "Cascade", cascade: "Cascade",
    "2": "Set null", setnull: "Set null",
    "3": "Set default", setdefault: "Set default",
  };
  return actions[value.toLowerCase().replace(/[ _]/g, "")];
}

export async function parseBacpacModel(input: Readable) {
  const roots: ModelElement[] = [];
  const stack: Array<{ element?: ModelElement; relationship?: string; property?: string; text?: string }> = [];
  const parser = sax.createStream(true);

  parser.on("opentag", (node) => {
    const tag = node.name.split(":").at(-1);
    const name = String(node.attributes.Name ?? "");
    const owner = stack.findLast((frame) => frame.element)?.element;
    const relationship = stack.findLast((frame) => frame.element || frame.relationship)?.relationship;
    if (tag === "Element") {
      const element: ModelElement = {
        type: String(node.attributes.Type ?? ""), name,
        properties: new Map(), references: new Map(), children: new Map(),
      };
      if (owner && relationship) {
        const siblings = children(owner, relationship);
        siblings.push(element);
        owner.children.set(relationship, siblings);
      } else {
        roots.push(element);
      }
      stack.push({ element });
    } else if (tag === "Relationship") {
      stack.push({ relationship: name });
    } else if (tag === "Property" && owner) {
      if (node.attributes.Value !== undefined) owner.properties.set(name, String(node.attributes.Value));
      stack.push({ property: name });
    } else {
      if (tag === "References" && owner && relationship && name) {
        const references = refs(owner, relationship);
        references.push(name);
        owner.references.set(relationship, references);
      }
      stack.push(tag === "Value" ? { text: "" } : {});
    }
  });
  const appendText = (text: string) => {
    const frame = stack.at(-1);
    if (frame?.text !== undefined) frame.text += text;
  };
  parser.on("text", appendText);
  parser.on("cdata", appendText);
  parser.on("closetag", () => {
    const frame = stack.pop();
    const property = stack.at(-1)?.property;
    if (frame?.text !== undefined && property) {
      stack.findLast((item) => item.element)?.element?.properties.set(property, frame.text);
    }
  });

  await new Promise<void>((resolve, reject) => {
    parser.once("error", (error) => {
      input.unpipe(parser);
      input.destroy();
      reject(error);
    });
    input.once("error", reject);
    parser.once("end", resolve);
    input.pipe(parser);
  });

  const objectKinds = new Map<string, NonNullable<SqlServerObject["kind"]>>([
    ["SqlUserDefinedDataType", "Type"], ["SqlUserDefinedType", "Type"], ["SqlTableType", "Type"],
    ["SqlProcedure", "Procedure"], ["SqlScalarFunction", "Function"], ["SqlTableValuedFunction", "Function"],
    ["SqlDmlTrigger", "Trigger"], ["SqlDdlTrigger", "Trigger"],
    ["SqlSequence", "Sequence"], ["SqlSynonym", "Synonym"],
  ]);
  const objects = new Map<string, SqlServerObject>();
  for (const element of roots) {
    const kind = objectKinds.get(element.type);
    if ((!kind && element.type !== "SqlView") || !element.name) continue;
    const parts = identifierParts(element.name);
    objects.set(identity(parts), {
      ...(kind && { kind }),
      schema: parts.length === 2 ? parts[0] : undefined,
      name: parts.at(-1)!,
      definition: element.properties.get("SelectStatement") ?? element.properties.get("QueryScript") ?? element.properties.get("BodyScript") ?? element.properties.get("Body"),
      dependencies: [...new Set([...refs(element, "BodyDependencies"), ...refs(element, "QueryDependencies"), ...refs(element, "BaseObject"), ...refs(element, "Type"), ...refs(element, "TriggerObject")]
        .map(name => displayTable(identifierParts(name))))],
    });
  }

  const tables = new Map<string, ModelTable>();
  const columns = new Map<string, { table: ModelTable; column: ModelColumn }>();
  for (const element of roots) {
    if (element.type !== "SqlTable" || !element.name) continue;
    const parts = identifierParts(element.name);
    tables.set(identity(parts), { name: displayTable(parts), columns: [] });
  }
  function addColumn(element: ModelElement) {
    if (!element.name) return;
    const parts = identifierParts(element.name);
    const key = identity(parts);
    if (columns.has(key)) return;
    const tableParts = parts.slice(0, -1);
    const tableKey = identity(tableParts);
    const table = tables.get(tableKey) ?? { name: displayTable(tableParts), columns: [] };
    const column: ModelColumn = {
      name: parts.at(-1)!, type: columnType(element),
      isPk: false, isUnique: false,
      isNotNull: element.properties.get("IsNullable")?.toLowerCase() === "false",
      isAutoIncrement: flag(element, "IsIdentity"),
      computedExpression: element.type === "SqlComputedColumn"
        ? element.properties.get("ExpressionScript")
        : undefined,
    };
    tables.set(tableKey, table);
    table.columns.push(column);
    columns.set(key, { table, column });
  }
  for (const element of roots) {
    if (element.type === "SqlTable") {
      for (const column of children(element, "Columns")) addColumn(column);
    } else if (element.type === "SqlSimpleColumn" || element.type === "SqlComputedColumn") {
      addColumn(element);
    }
  }

  const lookupColumn = (name: string) => columns.get(identity(identifierParts(name)));
  for (const element of roots) {
    const isUniqueConstraint = element.type === "SqlUniqueConstraint";
    const isIndex = element.type === "SqlIndex";
    if (element.type === "SqlPrimaryKeyConstraint" || isUniqueConstraint || isIndex) {
      const keyColumns = refs(element, "ColumnSpecifications").concat(
        children(element, "ColumnSpecifications").flatMap((child) => refs(child, "Column")),
        refs(element, "Columns"),
        children(element, "Columns").flatMap((child) => refs(child, "Column")),
      );
      const first = lookupColumn(keyColumns[0] ?? "");
      if (element.type === "SqlPrimaryKeyConstraint" && first &&
          keyColumns.every((name) => lookupColumn(name)?.table === first.table)) {
        first.table.primaryKey = keyColumns.map((name) => identifierParts(name).at(-1)!);
      }
      if ((isIndex || isUniqueConstraint) && first && keyColumns.every((name) =>
        lookupColumn(name)?.table === first.table,
      )) {
        const includedColumns = refs(element, "IncludedColumns")
          .map((name) => lookupColumn(name))
          .filter((entry) => entry?.table === first.table)
          .map((entry) => entry!.column.name);
        const index: SqlServerIndex = {
          name: identifierParts(element.name).at(-1) ?? element.name,
          kind: isUniqueConstraint ? "unique constraint" : "index",
          columns: keyColumns.map((name) => lookupColumn(name)!.column.name),
          includedColumns,
          unique: isUniqueConstraint || flag(element, "IsUnique") || flag(element, "Unique"),
          filter: element.properties.get("FilterPredicate"),
        };
        (first.table.sqlServerIndexes ??= []).push(index);
      }
      for (const name of keyColumns) {
        const match = lookupColumn(name);
        if (!match) continue;
        if (element.type === "SqlPrimaryKeyConstraint") match.column.isPk = true;
        else if (isUniqueConstraint && keyColumns.length === 1) match.column.isUnique = true;
      }
    }
    if (element.type === "SqlDefaultConstraint") {
      const target = lookupColumn(refs(element, "Column")[0] ?? "");
      const expression = element.properties.get("DefaultExpressionScript");
      if (target && expression !== undefined) target.column.defaultExpression = expression;
    }
    if (element.type === "SqlExtendedProperty" && identifierParts(element.name).at(-1)?.toLowerCase() === "ms_description") {
      const description = element.properties.get("Value");
      const host = refs(element, "Host")[0];
      const parts = host ? identifierParts(host) : identifierParts(element.name).slice(0, -1);
      const target = columns.get(identity(parts))?.column ?? tables.get(identity(parts)) ?? objects.get(identity(parts));
      if (target && description) target.description = description;
    }
  }

  const relationships = roots.flatMap((element) => {
    if (element.type !== "SqlForeignKeyConstraint") return [];
    const source = refs(element, "Columns").map(lookupColumn);
    const target = refs(element, "ForeignColumns").map(lookupColumn);
    const firstSource = source[0];
    const firstTarget = target[0];
    const onUpdate = action(element.properties.get("UpdateAction"));
    const onDelete = action(element.properties.get("DeleteAction"));
    if (!firstSource || !firstTarget || source.length !== target.length || !onUpdate || !onDelete ||
        source.some((entry) => entry?.table !== firstSource.table) ||
        target.some((entry) => entry?.table !== firstTarget.table)) return [];
    return [{
      name: identifierParts(element.name).at(-1) ?? "",
      sourceTable: firstSource.table.name,
      targetTable: firstTarget.table.name,
      sourceColumns: source.map((entry) => entry!.column.name),
      targetColumns: target.map((entry) => entry!.column.name),
      onUpdate, onDelete,
    }];
  });

  const unresolvedForeignKeys =
    roots.filter((element) => element.type === "SqlForeignKeyConstraint").length - relationships.length;
  const unsupported = roots.filter((element) =>
    /^Sql.*(?:Index|Constraint|Function|Trigger|Procedure|Type)$/.test(element.type) &&
    !objectKinds.has(element.type) &&
    !["SqlIndex", "SqlPrimaryKeyConstraint", "SqlUniqueConstraint", "SqlForeignKeyConstraint", "SqlDefaultConstraint"].includes(element.type),
  );
  return {
    tables: [...tables.values()], relationships, unresolvedForeignKeys, objects: [...objects.values()],
    unsupportedObjects: unsupported.length,
    unsupportedExamples: unsupported.slice(0, 3).map(element => element.name || element.type),
  };
}

export type BacpacModel = Awaited<ReturnType<typeof parseBacpacModel>>;
