import type { ParsedDbmlResult, ParsedColumn } from "@/lib/parser/dsl-parser";

// Notes arrive as a bare string or a `{ value }` object depending on @dbml/core
// context — normalize to a plain string.
const noteText = (note: unknown): string | undefined => {
  if (typeof note === "string") return note;
  if (note && typeof note === "object" && "value" in note) {
    return (note as { value?: string }).value;
  }
  return undefined;
};

interface DocRef {
  fromTable: string;
  fromFields: string[];
  toTable: string;
  toFields: string[];
  onUpdate?: string;
  onDelete?: string;
}

// Pull relationships out of the raw @dbml/core AST. Endpoint[0] is the "many"
// side as authored (`Ref: orders.user_id > users.id`).
function extractRefs(parsed: ParsedDbmlResult): DocRef[] {
  const raw = parsed.raw as any;
  const refs: DocRef[] = [];
  const qualified = (name: string, schema?: string) => schema && schema !== "public" ? `${schema}.${name}` : name;
  (raw?.schemas ?? []).forEach((schema: any) => {
    (schema.refs ?? []).forEach((ref: any) => {
      const [from, to] = ref.endpoints ?? [];
      if (!from || !to) return;
      refs.push({
        fromTable: qualified(from.tableName, from.schemaName ?? from.fields?.[0]?.table?.schema?.name),
        fromFields: from.fieldNames ?? [],
        toTable: qualified(to.tableName, to.schemaName ?? to.fields?.[0]?.table?.schema?.name),
        toFields: to.fieldNames ?? [],
        onUpdate: ref.onUpdate,
        onDelete: ref.onDelete,
      });
    });
  });
  return refs;
}

function columnConstraints(col: ParsedColumn): string {
  const parts: string[] = [];
  if (col.pk) parts.push("PK");
  if (col.unique && !col.pk) parts.push("unique");
  if (col.not_null && !col.pk) parts.push("not null");
  if (col.increment) parts.push("auto-increment");
  if (col.defaultExpression) parts.push("default " + col.defaultExpression);
  if (col.computedExpression) parts.push("computed " + col.computedExpression);
  return parts.join(", ");
}

// Escape pipes so column names/notes don't break Markdown tables.
const cell = (value: string | undefined): string =>
  (value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");

/**
 * Renders a parsed DBML schema as human-readable Markdown documentation:
 * project overview, per-table column tables + relationships, and enum listings.
 */
export function generateDocsMarkdown(parsed: ParsedDbmlResult): string {
  const lines: string[] = [];
  const refs = extractRefs(parsed);

  // ── Project overview ──────────────────────────────────────────
  const title = parsed.project?.name || "Database Documentation";
  lines.push(`# ${title}`, "");
  if (parsed.project?.databaseType) {
    lines.push(`**Database:** ${parsed.project.databaseType}`, "");
  }
  if (parsed.project?.note) {
    lines.push(parsed.project.note, "");
  }

  lines.push(
    `**${parsed.tables.length}** tables · **${refs.length}** relationships · **${parsed.enums.length}** enums`,
    "",
  );

  // ── Tables ────────────────────────────────────────────────────
  if (parsed.tables.length > 0) {
    lines.push("## Tables", "");
    parsed.tables.forEach((table) => {
      const name = table.schema?.name && table.schema.name !== "public" ? `${table.schema.name}.${table.name}` : table.name;
      lines.push(`### ${name}`, "");

      const tableNote = noteText(table.note);
      if (tableNote) lines.push(tableNote, "");
      if (table.description) lines.push("**SQL Server description**", "", table.description, "");

      const primaryKey = table.indexes?.find((index) => index.pk)?.columns;
      if (primaryKey && primaryKey.length > 1) {
        const fields = primaryKey.map((column) => column.value ?? column.name);
        lines.push(`**Primary key** (${fields.join(", ")})`, "");
      }

      lines.push(
        "| Column | Type | Constraints | Note |",
        "| --- | --- | --- | --- |",
      );
      table.fields.forEach((col) => {
        lines.push(
          `| ${cell(col.name)} | ${cell(col.type?.type_name)} | ${cell(columnConstraints(col))} | ${cell([noteText(col.note), col.description && 'SQL Server description ' + col.description].filter(Boolean).join(' · '))} |`,
        );
      });
      lines.push("");

      if (table.sqlServerIndexes?.length) {
        lines.push("**Indexes and unique constraints**", "");
        for (const index of table.sqlServerIndexes) {
          const kind = index.kind === "index" && index.unique ? "unique index" : index.kind;
          const included = index.includedColumns.length
            ? " · Includes " + index.includedColumns.join(", ")
            : "";
          const predicate = index.filter ? " · Filter " + index.filter : "";
          lines.push("- " + index.name + " (" + kind + ") · " + index.columns.join(", ") + included + predicate);
        }
        lines.push("");
      }

      const related = refs.filter(
        (r) => r.fromTable === name || r.toTable === name,
      );
      if (related.length > 0) {
        lines.push("**Relationships**", "");
        related.forEach((r) => {
          lines.push(
            `- \`${r.fromTable}.${r.fromFields.join(", ")}\` → \`${r.toTable}.${r.toFields.join(", ")}\`` +
            (r.onUpdate || r.onDelete ? ` (update ${r.onUpdate ?? "no action"}, delete ${r.onDelete ?? "no action"})` : ""),
          );
        });
        lines.push("");
      }
    });
  }

  if (parsed.project?.sqlServerViews?.length) {
    lines.push("## SQL Server views", "");
    for (const view of parsed.project.sqlServerViews) {
      lines.push("### " + [view.schema, view.name].filter(Boolean).join("."), "");
      if (view.description) lines.push(view.description, "");
      if (view.dependencies.length) lines.push("**Dependencies** " + view.dependencies.join(", "), "");
      if (view.definition) {
        let fence = "~~~";
        for (const run of view.definition.match(/~+/g) ?? []) {
          if (run.length >= fence.length) fence = "~".repeat(run.length + 1);
        }
        lines.push(fence + "sql", view.definition, fence, "");
      }
    }
  }

  // ── Enums ─────────────────────────────────────────────────────
  if (parsed.enums.length > 0) {
    lines.push("## Enums", "");
    parsed.enums.forEach((en) => {
      lines.push(`### ${en.name}`, "");
      en.values.forEach((val) => {
        const vNote = noteText(val.note);
        lines.push(`- \`${val.name}\`${vNote ? ` — ${vNote}` : ""}`);
      });
      lines.push("");
    });
  }

  return lines.join("\n").trimEnd() + "\n";
}
