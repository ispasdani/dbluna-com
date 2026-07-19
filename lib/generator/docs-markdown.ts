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
}

// Pull relationships out of the raw @dbml/core AST. Endpoint[0] is the "many"
// side as authored (`Ref: orders.user_id > users.id`).
function extractRefs(parsed: ParsedDbmlResult): DocRef[] {
  const raw = parsed.raw as any;
  const refs: DocRef[] = [];
  (raw?.schemas ?? []).forEach((schema: any) => {
    (schema.refs ?? []).forEach((ref: any) => {
      const [from, to] = ref.endpoints ?? [];
      if (!from || !to) return;
      refs.push({
        fromTable: from.tableName,
        fromFields: from.fieldNames ?? [],
        toTable: to.tableName,
        toFields: to.fieldNames ?? [],
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
  return parts.join(", ");
}

// Escape pipes so column names/notes don't break Markdown tables.
const cell = (value: string | undefined): string => (value ?? "").replace(/\|/g, "\\|");

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
    ""
  );

  // ── Tables ────────────────────────────────────────────────────
  if (parsed.tables.length > 0) {
    lines.push("## Tables", "");
    parsed.tables.forEach((table) => {
      lines.push(`### ${table.name}`, "");

      const tableNote = noteText(table.note);
      if (tableNote) lines.push(tableNote, "");

      lines.push("| Column | Type | Constraints | Note |", "| --- | --- | --- | --- |");
      table.fields.forEach((col) => {
        lines.push(
          `| ${cell(col.name)} | ${cell(col.type?.type_name)} | ${cell(columnConstraints(col))} | ${cell(noteText(col.note))} |`
        );
      });
      lines.push("");

      const related = refs.filter(
        (r) => r.fromTable === table.name || r.toTable === table.name
      );
      if (related.length > 0) {
        lines.push("**Relationships**", "");
        related.forEach((r) => {
          lines.push(
            `- \`${r.fromTable}.${r.fromFields.join(", ")}\` → \`${r.toTable}.${r.toFields.join(", ")}\``
          );
        });
        lines.push("");
      }
    });
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
