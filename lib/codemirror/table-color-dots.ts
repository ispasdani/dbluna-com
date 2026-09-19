// Imported through @uiw/react-codemirror, which re-exports @codemirror/view and
// @codemirror/state, so this uses the exact copies the editor runs on.
import {
  Decoration,
  EditorView,
  RangeSetBuilder,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from "@uiw/react-codemirror";

export type TableDotLanguage = "dbml" | "json" | "mermaid";

/**
 * Finds the table name on a line and where it starts, for each output format:
 * - DBML:    `Table "schema"."name" {` or `Table name {` (quotes optional)
 * - JSON:    `    "name": "schema.name",` at table depth (4 spaces), not a column's
 * - Mermaid: `Safe_Name {` (spaces in names become underscores)
 */
function findTableName(text: string, language: TableDotLanguage): { name: string; offset: number } | null {
  if (language === "dbml") {
    const m = /^(\s*Table\s+)((?:"[^"]+"|[\w$]+)(?:\s*\.\s*(?:"[^"]+"|[\w$]+))?)/i.exec(text);
    if (!m) return null;
    return { name: m[2].replace(/"/g, "").replace(/\s*\.\s*/, "."), offset: m[1].length };
  }
  if (language === "json") {
    const m = /^( {4}"name":\s*)"((?:[^"\\]|\\.)*)"/.exec(text);
    if (!m) return null;
    return { name: m[2], offset: m[1].length };
  }
  const m = /^(\s*)([^\s{]+)\s*\{\s*$/.exec(text);
  if (!m || m[2] === "erDiagram") return null;
  return { name: m[2], offset: m[1].length };
}

class DotWidget extends WidgetType {
  constructor(readonly color: string) {
    super();
  }
  eq(other: DotWidget) {
    return other.color === this.color;
  }
  toDOM() {
    const el = document.createElement("span");
    el.className = "cm-table-dot";
    el.style.backgroundColor = this.color;
    el.setAttribute("aria-hidden", "true");
    return el;
  }
  ignoreEvent() {
    return true;
  }
}

/**
 * Shows each table's canvas colour as a small square before its name. Display
 * only: the square is a widget, not text, so copy, download and typing never
 * see it. `colorOf` receives the name as written in the code; the caller maps
 * it to a table (and returns undefined for names it doesn't know yet).
 */
export function tableColorDots(language: TableDotLanguage, colorOf: (name: string) => string | undefined) {
  const build = (view: EditorView): DecorationSet => {
    const builder = new RangeSetBuilder<Decoration>();
    for (const { from, to } of view.visibleRanges) {
      let pos = from;
      while (pos <= to) {
        const line = view.state.doc.lineAt(pos);
        const hit = findTableName(line.text, language);
        const color = hit && colorOf(hit.name);
        if (hit && color) {
          builder.add(
            line.from + hit.offset,
            line.from + hit.offset,
            Decoration.widget({ widget: new DotWidget(color), side: -1 })
          );
        }
        pos = line.to + 1;
      }
    }
    return builder.finish();
  };

  return [
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;
        constructor(view: EditorView) {
          this.decorations = build(view);
        }
        update(update: ViewUpdate) {
          if (update.docChanged || update.viewportChanged) this.decorations = build(update.view);
        }
      },
      { decorations: (v) => v.decorations }
    ),
    EditorView.baseTheme({
      ".cm-table-dot": {
        display: "inline-block",
        width: "8px",
        height: "8px",
        borderRadius: "2.5px",
        margin: "0 6px 0 1px",
        verticalAlign: "0.05em",
      },
    }),
  ];
}
