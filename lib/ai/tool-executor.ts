import { z } from "zod";
import { useCanvasStore, type Column, type Table } from "@/store/useCanvasStore";
import { findFreePosition } from "./placement";
import { toolSchemas, type ToolName } from "./tools";

const HEADER_HEIGHT = 36;
const ROW_HEIGHT = 30;

function findTable(name: string): Table | undefined {
  const { tables } = useCanvasStore.getState();
  const needle = name.trim().toLowerCase();
  return tables.find((t) => t.name.toLowerCase() === needle);
}

function findColumn(table: Table, name: string): Column | undefined {
  const needle = name.trim().toLowerCase();
  return table.columns.find((c) => c.name.toLowerCase() === needle);
}

function toColumn(input: z.infer<typeof toolSchemas.add_column>["column"]): Column {
  return {
    id: crypto.randomUUID(),
    name: input.name,
    type: input.type,
    isPrimaryKey: input.isPrimaryKey ?? false,
    isNotNull: input.isNotNull ?? false,
    isUnique: input.isUnique ?? false,
    isAutoIncrement: input.isAutoIncrement ?? false,
  };
}

function centroid(tables: Table[]): { x: number; y: number } {
  if (tables.length === 0) return { x: 0, y: 0 };
  const sum = tables.reduce((acc, t) => ({ x: acc.x + t.x, y: acc.y + t.y }), { x: 0, y: 0 });
  return { x: sum.x / tables.length, y: sum.y / tables.length };
}

/**
 * Runs a model-issued tool call against the live canvas store and returns a
 * result string for the model to relay back to the user. Never throws —
 * unresolvable names (deleted mid-conversation, typo'd, etc.) come back as a
 * plain error string instead of crashing the panel.
 */
export async function applyToolCall(toolName: string, rawInput: unknown): Promise<string> {
  if (!(toolName in toolSchemas)) {
    return `Error: unknown tool "${toolName}".`;
  }

  const name = toolName as ToolName;
  const parsed = toolSchemas[name].safeParse(rawInput);
  if (!parsed.success) {
    return `Error: invalid arguments for "${name}": ${parsed.error.message}`;
  }
  // `parsed.data`'s shape depends on `name`, which the switch below narrows
  // case by case — there's no single static type to give it here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const input = parsed.data as any;
  const store = useCanvasStore.getState();

  switch (name) {
    case "add_table": {
      const { tables, areas } = store;
      if (tables.some((t) => t.name.toLowerCase() === input.name.trim().toLowerCase())) {
        return `Error: a table named "${input.name}" already exists.`;
      }

      const near = input.areaTitle
        ? areas.find((a) => a.title.toLowerCase() === input.areaTitle.trim().toLowerCase())
        : undefined;
      const origin = near ?? centroid(tables);

      const columns = (input.columns as z.infer<typeof toolSchemas.add_column>["column"][]).map(toColumn);
      const height = HEADER_HEIGHT + columns.length * ROW_HEIGHT;
      const pos = findFreePosition(tables, areas, { near: origin, height });

      const newTable: Table = {
        id: crypto.randomUUID(),
        name: input.name,
        x: pos.x,
        y: pos.y,
        color: "#4f46e5",
        isLocked: false,
        columns,
      };
      store.setTables([...tables, newTable]);
      return `Added table "${input.name}" with ${columns.length} column(s).`;
    }

    case "update_table": {
      const table = findTable(input.tableName);
      if (!table) return `Error: no table named "${input.tableName}".`;
      const updates: Partial<Table> = {};
      if (input.name) updates.name = input.name;
      if (input.comment !== undefined) updates.comment = input.comment;
      if (input.color) updates.color = input.color;
      store.updateTable(table.id, updates);
      return `Updated table "${input.tableName}".`;
    }

    case "delete_table": {
      const table = findTable(input.tableName);
      if (!table) return `Error: no table named "${input.tableName}".`;
      store.deleteTable(table.id);
      return `Deleted table "${input.tableName}".`;
    }

    case "add_column": {
      const table = findTable(input.tableName);
      if (!table) return `Error: no table named "${input.tableName}".`;
      if (findColumn(table, input.column.name)) {
        return `Error: table "${input.tableName}" already has a column named "${input.column.name}".`;
      }
      store.updateTable(table.id, { columns: [...table.columns, toColumn(input.column)] });
      return `Added column "${input.column.name}" to "${input.tableName}".`;
    }

    case "update_column": {
      const table = findTable(input.tableName);
      if (!table) return `Error: no table named "${input.tableName}".`;
      const column = findColumn(table, input.columnName);
      if (!column) return `Error: table "${input.tableName}" has no column named "${input.columnName}".`;
      store.updateField(table.id, column.id, input.updates);
      return `Updated column "${input.columnName}" on "${input.tableName}".`;
    }

    case "delete_column": {
      const table = findTable(input.tableName);
      if (!table) return `Error: no table named "${input.tableName}".`;
      const column = findColumn(table, input.columnName);
      if (!column) return `Error: table "${input.tableName}" has no column named "${input.columnName}".`;
      store.deleteField(table.id, column.id);
      return `Deleted column "${input.columnName}" from "${input.tableName}".`;
    }

    case "add_relationship": {
      const sourceTable = findTable(input.sourceTable);
      if (!sourceTable) return `Error: no table named "${input.sourceTable}".`;
      const targetTable = findTable(input.targetTable);
      if (!targetTable) return `Error: no table named "${input.targetTable}".`;
      const sourceColumn = findColumn(sourceTable, input.sourceColumn);
      if (!sourceColumn) return `Error: table "${input.sourceTable}" has no column named "${input.sourceColumn}".`;
      const targetColumn = findColumn(targetTable, input.targetColumn);
      if (!targetColumn) return `Error: table "${input.targetTable}" has no column named "${input.targetColumn}".`;

      store.addRelationship({
        sourceTableId: sourceTable.id,
        sourceColumnId: sourceColumn.id,
        targetTableId: targetTable.id,
        targetColumnId: targetColumn.id,
        ...(input.cardinality ? { cardinality: input.cardinality } : {}),
      });
      return `Connected ${input.sourceTable}.${input.sourceColumn} -> ${input.targetTable}.${input.targetColumn}.`;
    }

    case "add_note": {
      store.addNote();
      const newId = useCanvasStore.getState().selectedNoteIds[0];
      if (!newId) return "Error: failed to create note.";
      store.updateNote(newId, {
        title: input.title ?? "Untitled Note",
        content: input.content,
      });
      return `Added note${input.title ? ` "${input.title}"` : ""}.`;
    }

    case "add_area": {
      const { tables, areas } = store;
      const memberTables = (input.tableNames ?? [])
        .map((n: string) => findTable(n))
        .filter((t: Table | undefined): t is Table => !!t);

      store.addArea();
      const newId = useCanvasStore.getState().selectedAreaIds[0];
      if (!newId) return "Error: failed to create area.";

      if (memberTables.length > 0) {
        const pad = 40;
        const minX = Math.min(...memberTables.map((t: Table) => t.x)) - pad;
        const minY = Math.min(...memberTables.map((t: Table) => t.y)) - pad;
        const maxX = Math.max(...memberTables.map((t: Table) => t.x + 220)) + pad;
        const maxY = Math.max(
          ...memberTables.map((t: Table) => t.y + HEADER_HEIGHT + t.columns.length * ROW_HEIGHT)
        ) + pad;
        store.updateArea(newId, {
          title: input.title,
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
        });
      } else {
        const pos = findFreePosition(tables, areas, { width: 500, height: 400 });
        store.updateArea(newId, { title: input.title, x: pos.x, y: pos.y });
      }
      return `Added area "${input.title}".`;
    }

    default:
      return `Error: unknown tool "${toolName}".`;
  }
}
