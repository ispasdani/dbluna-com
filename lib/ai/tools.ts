import { z } from "zod";
import { tool } from "ai";

// Shared between the server's tool *declarations* (this file, no `execute`
// on any of them — see route.ts) and the client's tool-executor
// (tool-executor.ts), so the two can't drift out of sync on argument shape.
// The model only ever sees `tableName`/`columnName`, never internal ids —
// the executor resolves name -> id against the live store right before
// mutating (avoids a whole class of hallucinated-id failures).

const columnSchema = z.object({
  name: z.string().describe("Column name, e.g. 'user_id'"),
  type: z.string().describe("SQL type, e.g. 'INT', 'VARCHAR', 'TIMESTAMP'"),
  isPrimaryKey: z.boolean().optional(),
  isNotNull: z.boolean().optional(),
  isUnique: z.boolean().optional(),
  isAutoIncrement: z.boolean().optional(),
});

const cardinalitySchema = z.enum(["One to one", "One to many", "Many to one"]);

export const toolSchemas = {
  add_table: z.object({
    name: z.string().describe("Table name, e.g. 'orders'"),
    columns: z.array(columnSchema).min(1),
    areaTitle: z
      .string()
      .optional()
      .describe("Name of an existing area to place the new table near"),
  }),
  update_table: z.object({
    tableName: z.string(),
    name: z.string().optional().describe("New name for the table"),
    comment: z.string().optional(),
    color: z.string().optional().describe("Hex color, e.g. '#4f46e5'"),
  }),
  delete_table: z.object({
    tableName: z.string(),
  }),
  add_column: z.object({
    tableName: z.string(),
    column: columnSchema,
  }),
  update_column: z.object({
    tableName: z.string(),
    columnName: z.string(),
    updates: columnSchema.partial(),
  }),
  delete_column: z.object({
    tableName: z.string(),
    columnName: z.string(),
  }),
  add_relationship: z.object({
    sourceTable: z.string(),
    sourceColumn: z.string(),
    targetTable: z.string(),
    targetColumn: z.string(),
    cardinality: cardinalitySchema.optional(),
  }),
  add_note: z.object({
    title: z.string().optional(),
    content: z.string(),
  }),
  add_area: z.object({
    title: z.string(),
    tableNames: z
      .array(z.string())
      .optional()
      .describe("Existing tables this area should be drawn around"),
  }),
};

export type ToolName = keyof typeof toolSchemas;

const descriptions: Record<ToolName, string> = {
  add_table:
    "Add a new table to the diagram with the given columns. Positioned automatically to avoid overlapping existing tables.",
  update_table: "Rename a table or change its comment/color.",
  delete_table: "Delete a table and any relationships attached to it.",
  add_column: "Add a column to an existing table.",
  update_column: "Update an existing column on a table.",
  delete_column: "Delete a column from a table.",
  add_relationship:
    "Connect two tables with a foreign-key relationship between two columns.",
  add_note: "Add a sticky note to the canvas.",
  add_area:
    "Add a labeled area/group box on the canvas, optionally drawn around a set of existing tables.",
};

// Server-side declarations: no `execute` on any of these. That's what marks
// them as client-side tools in the AI SDK — the model's tool calls stream to
// the client as events instead of running here, because the canonical
// diagram state lives only in the browser (Zustand + IndexedDB).
export const aiTools = {
  add_table: tool({ description: descriptions.add_table, inputSchema: toolSchemas.add_table }),
  update_table: tool({ description: descriptions.update_table, inputSchema: toolSchemas.update_table }),
  delete_table: tool({ description: descriptions.delete_table, inputSchema: toolSchemas.delete_table }),
  add_column: tool({ description: descriptions.add_column, inputSchema: toolSchemas.add_column }),
  update_column: tool({ description: descriptions.update_column, inputSchema: toolSchemas.update_column }),
  delete_column: tool({ description: descriptions.delete_column, inputSchema: toolSchemas.delete_column }),
  add_relationship: tool({ description: descriptions.add_relationship, inputSchema: toolSchemas.add_relationship }),
  add_note: tool({ description: descriptions.add_note, inputSchema: toolSchemas.add_note }),
  add_area: tool({ description: descriptions.add_area, inputSchema: toolSchemas.add_area }),
};
