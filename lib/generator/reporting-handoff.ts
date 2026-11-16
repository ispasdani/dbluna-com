import { qualifySqlServerTable } from "@/lib/schema-namespace";
import type { ParsedDbmlResult, ParsedTable } from "@/lib/parser/dsl-parser";

export interface ReportingBrief {
  title: string;
  question: string;
  rules: string;
  reconciliation: string;
  audience?: string;
  output?: string;
  owner?: string;
  version?: string;
  projectName?: string;
}

export const emptyReportingBrief: ReportingBrief = {
  title: "", question: "", rules: "", reconciliation: "",
};

export function reportingName(schema: string | undefined | null, name: string) {
  return schema ? qualifySqlServerTable(schema, name) : name;
}

function tableSchema(table: ParsedTable) {
  const schema = table.schema?.name;
  return schema === "public" && !table.explicitDefaultSchema ? undefined : schema;
}

export function reportingSources(parsed: ParsedDbmlResult) {
  return [
    ...parsed.tables.map(table => ({
      key: JSON.stringify(["Table", table.schema?.name, table.name]),
      kind: "Table", name: reportingName(tableSchema(table), table.name), schema: tableSchema(table), table, view: undefined,
    })),
    ...(parsed.project?.sqlServerObjects ?? []).filter(object => !object.kind).map(view => ({
      key: JSON.stringify(["View", view.schema, view.name]),
      kind: "View", name: reportingName(view.schema, view.name), schema: view.schema, table: undefined, view,
    })),
  ];
}

/** Shape of the JSON island the Graph tab reads. Exported for tests. */
export interface HandoffMapData {
  nodes: Array<{
    id: string; name: string; short: string; schema: string; kind: string;
    primary?: true; rows?: string; note?: string;
    cols: Array<{ n: string; t: string; pk?: true; nn?: true; fk?: string; ref?: string }>;
  }>;
  edges: Array<{ s: string; t: string; ae?: string; be?: string; on?: string; dep?: true }>;
}

const escape = (value: string) => value.replace(/[&<>"']/g, char =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!,
);
const noteText = (note: string | { value: string } | undefined) =>
  typeof note === "string" ? note : note?.value;
const prose = (label: string, value?: string) => value?.trim()
  ? '<h3 class="label">' + escape(label) + '</h3><p class="prose">' + escape(value.trim()) + '</p>'
  : "";
const plural = (count: number, one: string, many = one + "s") => count + " " + (count === 1 ? one : many);
/** JSON that is safe inside a <script> element: no "<" can close the tag. */
const scriptJson = (value: unknown) => JSON.stringify(value)
  .replace(/</g, "\\u003c").split(String.fromCharCode(0x2028)).join("\\u2028").split(String.fromCharCode(0x2029)).join("\\u2029");

const icon = (paths: string) =>
  '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + paths + '</svg>';
const icons = {
  graph: icon('<circle cx="5" cy="6" r="2.5"/><circle cx="19" cy="7" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M7.5 6.2 16.5 6.8M6.3 8.2l4.4 7.6M17.8 9.2l-4.6 6.8"/>'),
  overview: icon('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>'),
  joins: icon('<path d="M4 7h6a4 4 0 0 1 4 4v2a4 4 0 0 0 4 4h2M4 17h4M16 7h4"/>'),
  dictionary: icon('<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v18H6.5A1.5 1.5 0 0 1 5 19.5z"/><path d="M9 8h6M9 12h6"/>'),
  search: icon('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  print: icon('<path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><path d="M7 14h10v7H7z"/>'),
  link: icon('<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>'),
};

/* Colour tokens, declared once and reused for the media query and the explicit theme overrides. */
const lightTokens = "color-scheme:light;--on-primary:#fff;--page:#fff;--surface:#fff;--subtle:#f3f4f6;--ink:#111827;--muted:#5d6471;--line:#e5e7eb;--primary:#6366f1;--accent:#4338ca;--selection:#eef2ff;--canvas:#f4f5f7;--dots:#d5d8e0;--edge:#9ca1bd;--ok:#047857;--ok-bg:#ecfdf5;--warn:#b45309;--warn-bg:#fffbeb;--key:#b45309;--shadow:0 1px 2px #1118270d;--shadow-lg:0 14px 34px -10px #11182740,0 2px 6px #1118270f";
const darkTokens = "color-scheme:dark;--on-primary:#14152a;--page:#1a1b26;--surface:#1e1f2e;--subtle:#25273c;--ink:#e1e3f0;--muted:#a6aac4;--line:#35374d;--primary:#818cf8;--accent:#b1b9ff;--selection:#2b2e50;--canvas:#15161f;--dots:#2c2e42;--edge:#646a8c;--ok:#34d399;--ok-bg:#10302a;--warn:#fbbf24;--warn-bg:#2e2716;--key:#fbbf24;--shadow:0 1px 2px #0007;--shadow-lg:0 18px 44px -10px #000c,0 2px 6px #0006";

export function generateReportingHandoff(
  parsed: ParsedDbmlResult,
  brief: ReportingBrief,
  selected: Readonly<Record<string, string>>,
  primaryKey: string,
  options: { includeNotes: boolean; includeSql: boolean; exportedAt?: string },
) {
  const sources = reportingSources(parsed).filter(source => Object.hasOwn(selected, source.key))
    .map((source, index) => ({ ...source, anchor: "source-" + (index + 1) }));
  type Source = typeof sources[number];
  const copyButton = (value: string, label: string, extra = "") => '<button type="button" class="utility' + extra + '" data-copy="' + escape(value) + '" aria-label="' + escape(label) + '">Copy</button>';
  const exportedAt = options.exportedAt ?? new Date().toISOString();
  const primary = sources.find(source => source.key === primaryKey);
  const link = (source: Source) =>
    '<a href="#' + source.anchor + '">' + escape(source.name) + '</a>';
  const lookup = new Map(sources.flatMap(source => source.table
    ? [[JSON.stringify([source.table.schema?.name ?? "public", source.table.name]), source] as const]
    : []));
  const sourcesByName = new Map(sources.map(source => [source.name, source]));
  const joins = parsed.refs.flatMap(ref => {
    if (ref.endpoints.length !== 2) return [];
    const [first, second] = ref.endpoints;
    const findSource = (endpoint: typeof first) =>
      lookup.get(JSON.stringify([endpoint.schemaName ?? "public", endpoint.tableName]));
    const left = findSource(first);
    const right = findSource(second);
    if (!left || !right || !first.fieldNames.length || first.fieldNames.length !== second.fieldNames.length) return [];
    const conditions = first.fieldNames.map((field, i) =>
      left.name + "." + field + " = " + right.name + "." + second.fieldNames[i]);
    const cardinality = (first.relation === "*" ? "Many" : "One") + " to " + (second.relation === "*" ? "many" : "one");
    return [{ left, right, conditions, cardinality, name: ref.name, first: first.relation, second: second.relation, firstFields: first.fieldNames, secondFields: second.fieldNames }];
  });
  const dependencies = sources.flatMap(source => (source.view?.dependencies ?? []).flatMap(name => {
    const target = sourcesByName.get(name);
    return target ? [{ source, target }] : [];
  }));
  const joinBody = (join: typeof joins[number]) => {
    const { left, right, conditions, cardinality, name, first, second } = join;
    const guidance = first === "*" && second === "*"
      ? "Many-to-many: rows can multiply on both sides. Confirm the intended grain and aggregate or deduplicate before combining measures."
      : first === "*" || second === "*"
        ? "Joining " + (first === "1" ? left.name : right.name) + " to " + (first === "*" ? left.name : right.name) + " can repeat rows from the one side. Aggregate the many side before summing one-side measures."
        : "Declared one-to-one: verify key uniqueness in the actual data before relying on one row per match.";
    return '<div class="join-heading">' + link(left) + '<span class="badge">' + cardinality + '</span>' + link(right) + '</div><small>Declared relationship · left source to right source</small>' +
      (name ? '<small class="constraint-name">' + escape(name) + '</small>' : '') +
      '<div class="join-code"><code>' + escape(conditions.join(" AND ")) + '</code>' + copyButton(conditions.join(" AND "), "Copy join condition") + '</div>' +
      (conditions.length > 1 ? '<p>Composite join. Match every column pair.</p>' : '') +
      '<p class="guidance">' + escape(guidance) + '</p><p>Choose INNER JOIN or LEFT JOIN according to whether unmatched records should be excluded or retained. The schema does not decide this reporting rule.</p>';
  };
  const map = [
    ...joins.map(join => '<li data-left="' + join.left.anchor + '" data-right="' + join.right.anchor + '" data-left-end="' + join.first + '" data-right-end="' + join.second + '">' + joinBody(join) + '</li>'),
    ...dependencies.map(({ source, target }) => '<li data-left="' + source.anchor + '" data-right="' + target.anchor +
      '" data-dependency>' + link(source) + ' <span class="badge">depends on</span> ' + link(target) + '</li>'),
  ];

  // Column facts are computed once and rendered twice: in the dictionary and in the Graph tab.
  const describe = (source: Source) => {
    const { table } = source;
    const primaryFields = table?.indexes?.find(index => index.pk)?.columns?.map(column => column.value ?? column.name);
    const sourceJoins = joins.filter(join => join.left === source || join.right === source);
    const fields = (table?.fields ?? []).map(field => {
      const isPrimary = Boolean(field.pk || primaryFields?.includes(field.name));
      const notNull = Boolean(field.not_null || isPrimary);
      const constraints = [isPrimary && "Primary key", field.unique && "Unique", field.increment && "Auto-increment", notNull ? "Not nullable" : "Nullable"].filter((item): item is string => Boolean(item));
      const details = options.includeNotes ? [field.description, noteText(field.note)].filter(Boolean).join(" · ") : "";
      const related = sourceJoins.flatMap(join => {
        const pairs: Array<{ target: Source; column: string; foreign: boolean }> = [];
        if (join.left === source && join.firstFields.includes(field.name)) pairs.push({ target: join.right, column: join.secondFields[join.firstFields.indexOf(field.name)], foreign: join.first === "*" && join.second === "1" });
        if (join.right === source && join.secondFields.includes(field.name)) pairs.push({ target: join.left, column: join.firstFields[join.secondFields.indexOf(field.name)], foreign: join.second === "*" && join.first === "1" });
        return pairs;
      });
      const enumItem = parsed.enums.find(item =>
        field.type.type_name === reportingName(item.schema?.name, item.name) ||
        (field.type.type_name === item.name && (item.schema?.name ?? "public") === (table?.schema?.name ?? "public")));
      const defaultValue = field.defaultExpression ?? field.dbdefault?.value;
      return { field, isPrimary, notNull, constraints, details, related, enumItem, defaultValue };
    });
    return { primaryFields, sourceJoins, fields };
  };
  const described = new Map(sources.map(source => [source, describe(source)]));

  const chipClass = (constraint: string) =>
    constraint === "Primary key" ? " chip-key" : constraint === "Nullable" ? " chip-soft" : "";
  const dictionary = sources.map(source => {
    const { table, view } = source;
    const { primaryFields, sourceJoins, fields } = described.get(source)!;
    const columns = table ? fields.map(({ field, isPrimary, constraints, details, related, enumItem, defaultValue }) => {
      const extra = (defaultValue !== undefined ? '<div>Default: <code>' + escape(String(defaultValue)) + '</code></div>' : '') +
        (field.computedExpression ? '<div>Computed: <code>' + escape(field.computedExpression) + '</code></div>' : '') +
        (enumItem ? '<div>Allowed values: ' + enumItem.values.map(value => '<code>' + escape(value.name) + '</code>').join(', ') + '</div>' : '') +
        related.map(item => '<div>' + (item.foreign ? 'Foreign key → ' : 'Related column → ') + '<a href="#' + item.target.anchor + '">' + escape(item.target.name + '.' + item.column) + '</a></div>').join('');
      const marker = isPrimary ? '<span class="col-key pk" title="Primary key">PK</span>' : related.some(item => item.foreign) ? '<span class="col-key fk" title="Foreign key">FK</span>' : '';
      return '<tr><td><div class="col-cell"><span class="col-name" data-searchable>' + escape(field.name) + '</span>' + marker + copyButton(source.name + '.' + field.name, "Copy qualified column name", " reveal") + '</div></td><td data-searchable><code class="type">' + escape(field.type.type_name) + '</code></td><td data-searchable><div class="chips">' +
        constraints.map(constraint => '<span class="chip' + chipClass(constraint) + '">' + escape(constraint) + '</span>').join("") + '</div>' + (extra ? '<div class="col-extra">' + extra + '</div>' : '') + '</td><td data-searchable>' + escape(details) + '</td></tr>';
    }).join("") : "";
    const indexes = table?.sqlServerIndexes?.map(index =>
      '<li><code>' + escape(index.name) + '</code> ' + escape("(" + index.columns.join(", ") + ")") +
      (index.unique ? ' <span class="chip">Unique</span>' : '') + '</li>').join("");

    return '<article id="' + source.anchor + '" data-source class="card" tabindex="-1">' +
      '<header class="source-heading"><div class="source-title"><span class="badge">' + source.kind + '</span><h3>' + escape(source.name) + '</h3></div><div class="source-actions">' + copyButton(source.name, 'Copy qualified source name') + '<button type="button" class="utility" data-show-graph="' + source.anchor + '">Show in graph</button><a class="utility" href="#' + source.anchor + '">Permalink</a></div></header>' +
      (selected[source.key]?.trim() ? prose("Row meaning", selected[source.key]) : '<p class="context-gap">Row meaning has not been documented. Confirm what makes one record distinct before aggregating.</p>') +
      (options.includeNotes ? prose("Imported description", table?.description ?? view?.description) +
        prose("Authored notes", noteText(table?.note)) : "") +
      (primaryFields?.length ? '<p>Primary key <code>' + escape(primaryFields.join(", ")) + '</code></p>' : '') +
      (table ? '<div class="table-wrap"><table><thead><tr><th>Column</th><th>Type</th><th>Constraints</th><th>Description</th></tr></thead><tbody>' +
        columns + '</tbody></table></div>' : '') +
      (indexes ? '<h4>Indexes and unique constraints</h4><ul class="index-list">' + indexes + '</ul>' : '') +
      (options.includeSql && view?.definition ? '<h4>View SQL</h4><pre>' + escape(view.definition) + '</pre>' : '') +
      '<section class="source-relationships"><h4>Relationships for this source</h4>' +
      (sourceJoins.length ? '<ul class="map">' + sourceJoins.map(join => '<li>' + joinBody(join) + '</li>').join('') + '</ul>' : '<p class="muted">No declared joins to other included sources.</p>') +
      (view?.dependencies?.some(name => sourcesByName.has(name)) ? '<p>Declared dependencies: ' + view.dependencies.filter(name => sourcesByName.has(name)).map(name => link(sourcesByName.get(name)!)).join(', ') + '</p>' : '') + '</section></article>';
  }).join("");

  const groups = new Map<string | undefined, Source[]>();
  for (const source of sources) {
    const group = groups.get(source.schema) ?? [];
    group.push(source);
    groups.set(source.schema, group);
  }
  const sourceList = [...groups.entries()].sort(([left], [right]) =>
    (left ?? "").localeCompare(right ?? ""),
  ).map(([schema, group]) =>
    '<details class="source-group" open><summary>' + escape(schema ?? "Unqualified") + '</summary><ul>' +
    group.map(source => '<li><a href="#' + source.anchor + '" aria-label="' + escape(source.name) + '">' +
      escape(source.table?.name ?? source.view!.name) + '</a></li>').join("") +
    '</ul></details>',
  ).join("");

  const mapData: HandoffMapData = {
    nodes: sources.map(source => ({
      id: source.anchor,
      name: source.name,
      short: source.table?.name ?? source.view!.name,
      schema: source.schema ?? "Unqualified",
      kind: source.kind,
      ...(source === primary ? { primary: true as const } : {}),
      ...(selected[source.key]?.trim() ? { rows: selected[source.key].trim() } : {}),
      ...(options.includeNotes && (source.table?.description ?? source.view?.description)
        ? { note: source.table?.description ?? source.view?.description } : {}),
      cols: described.get(source)!.fields.map(({ field, isPrimary, notNull, related }) => {
        const foreign = related.find(item => item.foreign);
        const other = related.find(item => !item.foreign);
        return {
          n: field.name, t: field.type.type_name,
          ...(isPrimary ? { pk: true as const } : {}),
          ...(notNull ? { nn: true as const } : {}),
          ...(foreign ? { fk: foreign.target.name + "." + foreign.column } : {}),
          ...(other && !foreign ? { ref: other.target.name + "." + other.column } : {}),
        };
      }),
    })),
    edges: [
      ...joins.map(join => ({ s: join.left.anchor, t: join.right.anchor, ae: join.first, be: join.second, on: join.conditions.join(" AND ") })),
      ...dependencies.map(({ source, target }) => ({ s: source.anchor, t: target.anchor, dep: true as const })),
    ],
  };

  const describedCount = sources.filter(source => selected[source.key]?.trim()).length;
  const undescribed = sources.length - describedCount;
  const tableCount = sources.filter(source => source.table).length;
  const viewCount = sources.length - tableCount;
  const describedPct = sources.length ? Math.round(describedCount / sources.length * 100) : 0;
  const check = (ok: boolean, text: string) =>
    '<li class="' + (ok ? "is-ok" : "is-gap") + '"><span class="status" aria-hidden="true">' + (ok ? "✓" : "!") + '</span><span>' + text + '</span></li>';
  const meta = [
    plural(sources.length, "source"),
    plural(map.length, "connection"),
    brief.owner?.trim() && "Owner: " + escape(brief.owner.trim()),
    brief.version?.trim() && escape(brief.version.trim()),
  ].filter(Boolean).map(item => '<li>' + item + '</li>').join("") +
    '<li>Exported <time datetime="' + escape(exportedAt) + '">' + escape(exportedAt) + '</time></li>';

  const title = escape(brief.title.trim() || "Reporting handoff");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>${title}</title>
<style>
:root{${lightTokens};--mono:"Geist Mono",ui-monospace,SFMono-Regular,Consolas,monospace;--sans:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;--header-h:150px}
@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){${darkTokens}}}
:root[data-theme="light"]{${lightTokens}}
:root[data-theme="dark"]{${darkTokens}}
*,*::before,*::after{box-sizing:border-box}[hidden]{display:none!important}
html{font:13px/1.55 var(--sans);-webkit-text-size-adjust:100%}
body{margin:0;background:var(--canvas);color:var(--ink)}
main,.masthead-inner{width:min(100%,88rem);margin-inline:auto;padding-inline:clamp(1rem,3vw,2rem)}
h1,h2,h3,h4{line-height:1.25;margin:0 0 .6rem;overflow-wrap:anywhere;letter-spacing:-.015em;font-weight:600}
h1{font-size:clamp(1.3rem,2.4vw,1.75rem);margin:0}h2{font-size:15px}h3{font-size:13px}
h4{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:22px 0 8px}
p{margin:.35rem 0 .9rem}a{color:var(--accent);text-underline-offset:.2em}
button,input,select{font:inherit;color:inherit}:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
.muted,small{color:var(--muted)}code,pre{font-family:var(--mono);font-size:.92em;overflow-wrap:anywhere}
pre{background:var(--subtle);padding:12px;border-radius:8px;overflow:auto}
input[type=search],input:not([type]){width:100%;padding:7px 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface);font-size:12.5px}
input[type=search]:focus,select:focus{border-color:var(--primary);outline:none;box-shadow:0 0 0 3px color-mix(in srgb,var(--primary) 18%,transparent)}
select{border:1px solid var(--line);border-radius:8px;padding:6px 8px;background:var(--surface);font-size:12px;max-width:100%}
label{font-size:12px;font-weight:500}

/* Header */
.masthead{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--surface) 94%,transparent);backdrop-filter:saturate(1.4) blur(10px);border-bottom:1px solid var(--line)}
.topbar{display:flex;align-items:flex-start;justify-content:space-between;gap:12px 20px;flex-wrap:wrap;padding-top:16px}
.title-block{min-width:0;flex:1 1 22rem}
.eyebrow{display:flex;align-items:center;gap:8px;margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--muted)}
.brand-mark{width:16px;height:16px;border-radius:5px;background:linear-gradient(135deg,var(--primary),#c084fc);flex:none}
.meta{display:flex;flex-wrap:wrap;gap:4px 0;list-style:none;margin:8px 0 0;padding:0;color:var(--muted);font-size:12px}
.meta li{display:inline;white-space:nowrap}.meta li+li::before{content:"";display:inline-block;vertical-align:middle;width:3px;height:3px;border-radius:50%;background:currentColor;opacity:.5;margin:0 10px}
.export-tools{display:flex;flex-wrap:wrap;align-items:center;gap:6px}.export-tools label{display:flex;gap:6px;align-items:center;color:var(--muted)}
.utility{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--line);border-radius:7px;padding:4px 9px;background:var(--surface);color:var(--ink);font-size:11.5px;font-weight:500;line-height:1.45;cursor:pointer;text-decoration:none;white-space:nowrap;transition:background .15s,border-color .15s,opacity .15s}
.utility:hover{background:var(--selection);border-color:color-mix(in srgb,var(--primary) 45%,var(--line))}
.utility:disabled{opacity:.4;cursor:not-allowed;background:var(--surface);border-color:var(--line)}
.utility.primary{background:var(--primary);border-color:var(--primary);color:var(--on-primary)}.utility.primary:hover{filter:brightness(1.08)}
.utility svg{width:13px;height:13px}
.tabs{display:flex;gap:2px;overflow-x:auto;margin-top:10px;scrollbar-width:none}
.tabs button{display:inline-flex;align-items:center;gap:7px;flex:none;border:0;border-bottom:2px solid transparent;background:none;color:var(--muted);padding:9px 12px 10px;cursor:pointer;font-size:12.5px;font-weight:500;border-radius:6px 6px 0 0}
.tabs button:hover{color:var(--ink);background:var(--subtle)}.tabs button:focus-visible{outline-offset:-2px}
.tabs [aria-selected=true]{color:var(--ink);border-bottom-color:var(--primary);font-weight:600}
.tabs svg{width:15px;height:15px}.tabs [aria-selected=true] svg{color:var(--primary)}
.tab-count{font-size:10.5px;font-weight:600;padding:0 6px;border-radius:9px;background:var(--subtle);color:var(--muted);font-variant-numeric:tabular-nums}
#copy-status{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:60;margin:0;padding:8px 14px;border-radius:8px;background:var(--ink);color:var(--page);font-size:12px;box-shadow:var(--shadow-lg)}#copy-status:empty{display:none}

/* Shared surfaces */
.panel{margin-block:20px 56px;scroll-margin-top:calc(var(--header-h) + 16px)}
.card{border:1px solid var(--line);border-radius:12px;background:var(--surface);padding:clamp(14px,2vw,20px);box-shadow:var(--shadow)}
.stack{display:grid;gap:16px;align-content:start}
.badge{display:inline-flex;align-items:center;background:var(--selection);color:var(--accent);font-size:11px;font-weight:600;border-radius:6px;padding:1px 7px;line-height:1.6;white-space:nowrap}
.label{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:14px 0 4px}.card>h2+.label{margin-top:6px}
.prose{white-space:pre-wrap;overflow-wrap:anywhere;max-width:80ch;line-height:1.65;margin-top:0}
.section-heading{display:flex;align-items:baseline;justify-content:space-between;gap:.65rem;flex-wrap:wrap}.section-heading h2{margin:0}.section-heading p{margin:0;color:var(--muted);font-size:12px}
.context-gap{border-left:3px solid var(--warn);border-radius:0 8px 8px 0;padding:10px 12px;background:var(--warn-bg);color:var(--ink)}
.chip{display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:999px;padding:0 7px;font-size:11px;line-height:1.6;white-space:nowrap;background:var(--surface)}
.chip-key{border-color:color-mix(in srgb,var(--key) 45%,var(--line));color:var(--key);background:color-mix(in srgb,var(--key) 9%,var(--surface))}.chip-soft{color:var(--muted);border-style:dashed}
.chips{display:flex;flex-wrap:wrap;gap:4px}
mark{background:#fde68a;color:#422006;border-radius:2px}

/* Graph tab */
.map-shell{border:1px solid var(--line);border-radius:14px;background:var(--surface);box-shadow:var(--shadow);overflow:hidden}
.map-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;padding:10px 12px;border-bottom:1px solid var(--line)}
.map-find{position:relative;flex:1 1 220px;max-width:340px}.map-find svg{position:absolute;left:9px;top:50%;width:14px;height:14px;transform:translateY(-50%);color:var(--muted);pointer-events:none}.map-find input{padding-left:30px}
#map-find-results{position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:10;background:var(--surface);border:1px solid var(--line);border-radius:10px;box-shadow:var(--shadow-lg);padding:4px;max-height:300px;overflow:auto}
#map-find-results button{display:flex;width:100%;align-items:center;gap:8px;border:0;background:none;padding:6px 8px;border-radius:6px;text-align:left;cursor:pointer;font-size:12px}
#map-find-results button:hover,#map-find-results [aria-selected=true]{background:var(--selection)}#map-find-results p{margin:6px 8px;color:var(--muted)}
#map-find-results small{margin-left:auto}
.legend{display:flex;flex-wrap:wrap;gap:6px;flex:1 1 200px;min-width:0}
.legend button{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:999px;padding:2px 9px 2px 7px;background:var(--surface);font-size:11.5px;cursor:pointer;max-width:100%}
.legend button:hover{background:var(--subtle)}.legend button[aria-pressed=false]{opacity:.45}.legend button[aria-pressed=false] .dot{background:transparent;box-shadow:inset 0 0 0 1.5px var(--c)}
.legend small{font-variant-numeric:tabular-nums}
.dot{width:9px;height:9px;border-radius:50%;flex:none;background:var(--c)}.dot.view{border-radius:2px;transform:rotate(45deg) scale(.85)}
.zoom-group{display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:8px;overflow:hidden;margin-left:auto;background:var(--surface)}
.zoom-group button{border:0;border-left:1px solid var(--line);background:none;padding:4px 10px;cursor:pointer;font-size:12px;line-height:1.5}.zoom-group button:first-child{border-left:0}.zoom-group button:hover{background:var(--subtle)}
.zoom-group output{min-width:48px;text-align:center;font-size:11.5px;color:var(--muted);font-variant-numeric:tabular-nums;border-left:1px solid var(--line);padding:4px 0}
.map-stage{position:relative;height:clamp(420px,calc(100vh - var(--header-h) - 130px),900px);background:radial-gradient(circle,var(--dots) 1px,transparent 1.3px) 0 0/22px 22px var(--canvas);overflow:hidden}
#map-canvas{display:block;width:100%;height:100%;touch-action:none;cursor:grab}#map-canvas:focus-visible{outline-offset:-3px}
#map-canvas.over-node{cursor:pointer}#map-canvas.dragging{cursor:grabbing}
.map-tip{position:absolute;z-index:4;width:min(300px,calc(100% - 16px));pointer-events:none;background:var(--surface);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow-lg);padding:12px;font-size:12px}
.map-tip p{margin:6px 0}.map-tip footer{margin-top:8px;padding-top:8px;border-top:1px solid var(--line);font-size:11px;color:var(--muted)}
.node-meta{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--muted);margin-bottom:2px;min-width:0}.node-meta .badge{margin-left:auto}
.node-title{display:block;font-size:14px;font-weight:600;overflow-wrap:anywhere;line-height:1.3}
.map-inspector{position:absolute;z-index:6;top:12px;right:12px;bottom:12px;width:min(340px,calc(100% - 24px));display:flex;flex-direction:column;background:var(--surface);border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow-lg);overflow:hidden;animation:slide-in .18s ease-out}
@keyframes slide-in{from{opacity:0;transform:translateX(12px)}}
.insp-head{padding:14px 14px 12px;border-bottom:1px solid var(--line);display:grid;gap:10px}
.insp-top{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:start}
.insp-close{border:0;background:none;border-radius:6px;width:26px;height:26px;cursor:pointer;color:var(--muted);font-size:18px;line-height:1}.insp-close:hover{background:var(--subtle);color:var(--ink)}
.insp-actions{display:flex;flex-wrap:wrap;gap:6px}
.insp-body{overflow:auto;padding:4px 14px 16px;flex:1}.insp-body h4{margin-top:16px}
.insp-stats{font-size:11.5px;color:var(--muted)}
.cols{list-style:none;margin:6px 0 0;padding:0}
.cols li{display:grid;grid-template-columns:22px minmax(0,1fr) auto;gap:6px;align-items:baseline;padding:4px 0;border-bottom:1px dashed var(--line)}.cols li:last-child{border-bottom:0}
.cols .n{overflow-wrap:anywhere;font-weight:500}.cols .t{font-family:var(--mono);font-size:10.5px;color:var(--muted);text-align:right;overflow-wrap:anywhere;max-width:11rem}
.cols .to{grid-column:2/-1;font-size:11px;color:var(--muted);overflow-wrap:anywhere}
.col-key{font:700 9px/1.5 var(--mono);letter-spacing:.02em;border-radius:4px;padding:0 3px;text-align:center;align-self:center}
.col-key.pk{color:var(--key);background:color-mix(in srgb,var(--key) 14%,transparent)}.col-key.fk{color:var(--accent);background:var(--selection)}
.more{margin:6px 0 0;font-size:11px;color:var(--muted)}
.nbrs{list-style:none;margin:6px 0 0;padding:0;display:grid;gap:4px}
.nbrs button{display:grid;grid-template-columns:auto minmax(0,1fr);gap:2px 8px;align-items:center;width:100%;text-align:left;border:1px solid var(--line);border-radius:8px;background:var(--surface);padding:6px 9px;cursor:pointer;font-size:12px}
.nbrs button:hover{border-color:var(--primary);background:var(--selection)}.nbrs .nb-name{overflow-wrap:anywhere;font-weight:500}.nbrs small{grid-column:2}
.map-hint{position:absolute;left:12px;bottom:10px;margin:0;font-size:11px;color:var(--muted);background:color-mix(in srgb,var(--surface) 88%,transparent);border:1px solid var(--line);padding:4px 9px;border-radius:8px;pointer-events:none;max-width:calc(100% - 24px)}
.map-hint kbd{font:inherit;font-weight:600;color:var(--ink)}
.map-foot{display:flex;flex-wrap:wrap;gap:6px 16px;align-items:center;margin:10px 2px 0;font-size:11.5px;color:var(--muted)}
.map-foot span{display:inline-flex;align-items:center;gap:6px}.key-line{width:20px;border-top:1.5px solid var(--edge)}.key-line.dash{border-top-style:dashed}
.key-ring{width:11px;height:11px;border-radius:50%;box-shadow:0 0 0 2px var(--primary);background:var(--surface)}

/* Overview */
.report-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.stat{display:flex;flex-direction:column;gap:4px;padding:14px 16px;border:1px solid var(--line);border-radius:12px;background:var(--surface);box-shadow:var(--shadow);min-width:0}
.stat span{font-size:12px;color:var(--muted)}.stat strong{font-size:24px;font-weight:600;font-variant-numeric:tabular-nums;line-height:1.2}.stat small{font-size:11.5px}
.progress{height:5px;border-radius:5px;background:var(--subtle);overflow:hidden;margin-top:4px}.progress i{display:block;height:100%;background:var(--primary);border-radius:inherit}
.overview-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(280px,1fr);gap:16px;align-items:start}
.starting-source{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin:16px 0 0;padding:12px 14px;border:1px solid color-mix(in srgb,var(--primary) 35%,var(--line));border-radius:10px;background:var(--selection)}
.starting-source a:first-of-type{font-weight:600}.starting-source .utility{margin-left:auto}
.checklist{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.checklist li{display:grid;grid-template-columns:22px minmax(0,1fr);gap:10px;align-items:start}
.status{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:700}
.is-ok .status{background:var(--ok-bg);color:var(--ok)}.is-gap .status{background:var(--warn-bg);color:var(--warn)}
.snapshot{display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px 16px;margin:0 0 12px}.snapshot dt{color:var(--muted)}.snapshot dd{margin:0;overflow-wrap:anywhere;font-weight:500}

/* Relationships tab */
.map,.source-list{list-style:none;margin:0;padding:0}.map{display:grid;gap:8px}
.map li{border:1px solid var(--line);border-radius:10px;padding:12px 14px;background:var(--surface)}.map li p{margin:6px 0 0;color:var(--muted);font-size:12px}
.join-heading{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.join-heading a{font-weight:600}.constraint-name{display:block;margin-top:4px}
.join-code{display:flex;align-items:flex-start;gap:8px;margin-top:8px}.join-code code{flex:1;display:block;background:var(--subtle);padding:7px 10px;border-radius:7px;font-size:11.5px}
.guidance{color:var(--ink)!important}.join-guide{margin:8px 0;color:var(--muted);font-size:12px}
.graph-tools{display:flex;flex-wrap:wrap;align-items:end;gap:10px;margin-block:12px}.graph-tools label{display:grid;gap:4px;min-width:0;color:var(--muted)}
.graph-tools select{min-width:min(34vw,10rem);max-width:min(68vw,30rem)}.graph-tools output{align-self:center;min-width:3rem;text-align:center;color:var(--muted);font-variant-numeric:tabular-nums}
.btn-group{display:inline-flex;gap:4px;flex-wrap:wrap}.graph-tools .zoom-group{margin-left:0}
#graph-search-results{display:flex;gap:6px;flex-wrap:wrap;align-items:center}#graph-search-results p{margin:0;color:var(--muted)}
#graph-focus{font-weight:600;margin:4px 0}
.graph-scroll{height:52vh;max-height:650px;overflow:auto;border:1px solid var(--line);border-radius:10px;background:radial-gradient(circle,var(--dots) 1px,transparent 1.3px) 0 0/18px 18px var(--canvas);margin:10px 0 0;cursor:grab;touch-action:pan-x pan-y}
.graph{display:grid;width:max-content;min-width:100%;grid-template-columns:240px minmax(380px,1fr);padding:20px}
.graph-center{display:flex;align-items:center;border-right:2px solid var(--edge);position:relative;padding-right:16px}
.graph-center::after{content:"";position:absolute;right:0;top:50%;width:16px;border-top:2px solid var(--edge)}
.graph-neighbor{display:grid;grid-template-columns:150px minmax(230px,1fr);gap:12px;align-items:center;padding:4px 0}
.graph-edge{white-space:normal;font-size:11px;border-radius:999px}
.graph-node{display:grid;gap:8px;min-width:0;width:100%;overflow-wrap:anywhere;padding:8px 10px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--ink);box-shadow:var(--shadow)}
.graph-node:hover{border-color:var(--primary)}.graph-node>a{width:fit-content}
.graph-node:has([aria-current=true]){border-color:var(--primary);background:var(--selection)}
.node-focus{border:0;background:none;color:inherit;text-align:left;display:grid;padding:0;cursor:pointer;width:100%}
.node-schema{font-size:11px;color:var(--muted);line-height:1.25}.node-name{font-weight:600;font-size:12.5px;line-height:1.4}
.expanded-branch{margin:12px 0 12px 12px;padding-left:12px;border-left:2px solid var(--edge)}
.all-joins{display:flex;gap:8px;align-items:center;margin:10px 0}.all-joins input{width:auto}
#join-details{margin-top:16px}#join-details>summary{font-weight:600;cursor:pointer;font-size:13px}#join-details>.map{max-height:55vh;overflow:auto}
@media(min-width:1100px){#relationships{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(320px,1fr);gap:20px}#relationships>p,#relationships>.section-heading{grid-column:1/-1}#join-details{margin-top:0;min-width:0;border-left:1px solid var(--line);padding-left:20px}#join-details>.map{max-height:70vh}}

/* Dictionary tab */
.dictionary{display:grid;grid-template-columns:minmax(12rem,18rem) minmax(0,1fr);gap:16px;align-items:start}
.dictionary>nav{position:sticky;top:calc(var(--header-h) + 16px);display:grid;gap:8px;padding:12px}
.source-list{max-height:calc(100vh - var(--header-h) - 200px);min-height:8rem;overflow:auto;margin:0 -4px}
.source-list a{display:block;padding:5px 8px;border-radius:6px;overflow-wrap:anywhere;text-decoration:none;color:var(--muted);font-size:12px}
.source-list a:hover{background:var(--subtle);color:var(--ink)}
.source-list [aria-current=true]{background:var(--selection);color:var(--accent);font-weight:600;box-shadow:inset 2px 0 var(--primary)}
.source-group+.source-group{border-top:1px solid var(--line)}.source-group summary{cursor:pointer;font-weight:600;padding:7px 8px;overflow-wrap:anywhere;font-size:12px}
.source-group ul{list-style:none;margin:0;padding:0 0 6px 8px}
#results{margin:0;font-size:11.5px}#search-matches{max-height:35vh;overflow:auto}#search-matches:empty{display:none}
#search-matches a{display:grid;gap:2px;padding:7px 8px;border-radius:6px;text-decoration:none;overflow-wrap:anywhere}#search-matches a:hover{background:var(--subtle)}
article[data-source]{scroll-margin-top:calc(var(--header-h) + 16px)}article[data-source]:focus{outline:none}
.source-heading{display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:10px;padding-bottom:14px;margin-bottom:14px;border-bottom:1px solid var(--line)}
.source-title{display:flex;align-items:center;gap:8px;min-width:0}.source-title h3{margin:0;font-size:18px}.source-actions{display:flex;flex-wrap:wrap;gap:6px}
.table-wrap{overflow:auto;margin-block:14px;border:1px solid var(--line);border-radius:10px}
table{border-collapse:collapse;width:100%;min-width:480px;text-align:left;font-size:12px}
th{position:sticky;top:0;background:var(--subtle);font-size:11px;font-weight:600;color:var(--muted);letter-spacing:.02em}
th,td{padding:9px 12px;border-bottom:1px solid var(--line);vertical-align:top;overflow-wrap:break-word}th{white-space:nowrap}tbody tr:last-child td{border-bottom:0}tbody tr:hover{background:color-mix(in srgb,var(--subtle) 60%,transparent)}
td:last-child{white-space:pre-wrap}
.col-cell{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.col-name{font-weight:600;font-family:var(--mono);font-size:12px}
.type{color:var(--muted);font-size:11.5px;white-space:nowrap}.col-extra{display:grid;gap:3px;margin-top:6px;font-size:11.5px;color:var(--muted)}.col-extra code{color:var(--ink)}
.reveal{opacity:0}tr:hover .reveal,.reveal:focus-visible{opacity:1}@media(hover:none){.reveal{opacity:1}}
.index-list{display:grid;gap:4px;padding-left:18px;margin:0}
.source-relationships{margin-top:22px}

@media(max-width:62rem){.report-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.overview-grid{grid-template-columns:1fr}}
@media(max-width:42rem){.masthead{position:static}.dictionary{grid-template-columns:1fr}.dictionary>nav{position:static}.source-list{max-height:26vh}.report-summary{gap:8px}.stat{padding:10px 12px}.stat strong{font-size:20px}
.map-inspector{top:auto;left:8px;right:8px;bottom:8px;width:auto;max-height:62%}.map-hint{display:none}.zoom-group{margin-left:0}.panel,article[data-source]{scroll-margin-top:16px}}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
@media print{
:root,:root[data-theme]{color-scheme:light;--page:white;--canvas:white;--surface:white;--subtle:#f3f4f6;--ink:#111827;--muted:#4b5563;--line:#d1d5db;--accent:#3730a3;--selection:#eef2ff;--shadow:none;--shadow-lg:none}
body{background:white;color:black}.masthead{position:static;backdrop-filter:none}
.tabs,.export-tools,.utility,#copy-status,#search-matches,.graph-tools,.dictionary>nav,#relationship-graph,#results,#empty-results,#graph,.all-joins,#graph-detail-label{display:none!important}
.panel[hidden],article[data-source][hidden],.map li[hidden]{display:block!important}
.dictionary,#relationships,.overview-grid{display:block}.report-summary{break-inside:avoid}.card{box-shadow:none;break-inside:auto;margin-bottom:12px}
#join-details{display:block;border:0;padding:0}#join-details>.map{max-height:none;overflow:visible}#join-details::details-content{display:block}
article[data-source]{break-before:page}h2,h3,h4,.source-heading{break-after:avoid}thead{display:table-header-group}tr,.map li{break-inside:avoid}
.table-wrap,pre{overflow:visible}table{min-width:0}pre{white-space:pre-wrap}mark{background:transparent;color:inherit}main,.masthead-inner{padding:0}.panel{margin:16px 0}@page{margin:16mm}}
</style></head>
<body><header class="masthead"><div class="masthead-inner"><div class="topbar"><div class="title-block">
<p class="eyebrow"><span class="brand-mark" aria-hidden="true"></span>DBLuna Reporting Handoff</p><h1>${title}</h1>
<ul class="meta" aria-label="Handoff details">${meta}</ul></div>
<div class="export-tools" hidden><label>Theme <select id="theme"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label><button type="button" class="utility" id="copy-link">${icons.link}Copy link</button><button type="button" class="utility" id="print">${icons.print}Print / PDF</button></div></div>
<p id="copy-status" role="status" aria-live="polite"></p>
<nav class="tabs" role="tablist" aria-label="Reporting handoff" hidden>
<button type="button" role="tab" id="tab-graph" aria-controls="graph" aria-selected="true">${icons.graph}Graph</button>
<button type="button" role="tab" id="tab-overview" aria-controls="overview" aria-selected="false" tabindex="-1">${icons.overview}Overview</button>
<button type="button" role="tab" id="tab-relationships" aria-controls="relationships" aria-selected="false" tabindex="-1">${icons.joins}Relationships <span class="tab-count">${map.length}</span></button>
<button type="button" role="tab" id="tab-dictionary" aria-controls="dictionary" aria-selected="false" tabindex="-1">${icons.dictionary}Data dictionary <span class="tab-count">${sources.length}</span></button>
</nav></div></header>
<main>
<section class="panel" id="graph" role="tabpanel" aria-labelledby="tab-graph" tabindex="-1">
<div class="map-shell">
<div class="map-bar">
<div class="map-find">${icons.search}<input id="map-find" type="search" placeholder="Find a table or view…" aria-label="Find a source in the graph" autocomplete="off" aria-controls="map-find-results"><div id="map-find-results" role="listbox" aria-label="Matching sources" hidden></div></div>
<div id="map-legend" class="legend" aria-label="Filter by schema"></div>
<div class="zoom-group"><button type="button" id="map-zoom-out" aria-label="Zoom out">−</button><output id="map-zoom" aria-live="off">100%</output><button type="button" id="map-zoom-in" aria-label="Zoom in">+</button><button type="button" id="map-fit">Fit</button></div>
</div>
<div class="map-stage" id="map-stage">
<canvas id="map-canvas" tabindex="0" role="img" aria-label="Relationship graph of ${sources.length} sources. Use the search box to find a source; arrow keys pan, plus and minus zoom, 0 fits the graph."></canvas>
<div id="map-tip" class="map-tip" hidden></div>
<aside id="map-inspector" class="map-inspector" aria-label="Source details" hidden></aside>
<p class="map-hint" id="map-hint"><kbd>Hover</kbd> to preview columns · <kbd>Click</kbd> to pin · <kbd>Drag</kbd> to rearrange · <kbd>Scroll</kbd> to zoom</p>
<noscript><p class="card" style="margin:16px">The interactive graph needs JavaScript. The Relationships and Data dictionary sections below list every connection.</p></noscript>
</div></div>
<div class="map-foot"><span><i class="dot" style="--c:var(--edge)"></i>Table</span><span><i class="dot view" style="--c:var(--edge)"></i>View</span><span><i class="key-line"></i>Declared join</span><span><i class="key-line dash"></i>View dependency</span>${primary ? '<span><i class="key-ring"></i>Starting source</span>' : ''}<span>Node size reflects how many sources it connects to. Only declared relationships between included sources are drawn.</span></div>
</section>
<section class="panel stack" id="overview" role="tabpanel" aria-labelledby="tab-overview" tabindex="0">
<div class="report-summary" aria-label="Handoff summary">
<div class="stat"><span>Sources</span><strong>${sources.length}</strong><small>${plural(tableCount, "table")} · ${plural(viewCount, "view")}</small></div>
<div class="stat"><span>Declared connections</span><strong>${map.length}</strong><small>${plural(joins.length, "join")} · ${plural(dependencies.length, "dependency", "dependencies")}</small></div>
<div class="stat"><span>Rows described</span><strong>${describedCount} / ${sources.length}</strong><div class="progress" role="presentation"><i style="width:${describedPct}%"></i></div></div>
<div class="stat"><span>Schemas</span><strong>${groups.size}</strong><small>${escape([...groups.keys()].map(schema => schema ?? "Unqualified").sort().slice(0, 3).join(", ") + (groups.size > 3 ? "…" : ""))}</small></div>
</div>
<div class="overview-grid"><div class="stack">
<div class="card"><h2>Start here</h2>${prose("Report question", brief.question)}${prose("Intended audience", brief.audience)}${prose("Expected output", brief.output)}
${primary ? '<p class="starting-source"><span>Start with ' + link(primary) + '.</span><button type="button" class="utility" data-show-graph="' + primary.anchor + '">Show in graph</button></p>' : '<p class="muted">Use the graph or the data dictionary to explore the selected sources.</p>'}</div>
${brief.rules.trim() || brief.reconciliation.trim() ? '<div class="card"><h2>Reporting rules and reconciliation</h2>' + prose("Business rules", brief.rules) + prose("Validation example", brief.reconciliation) + '</div>' : ''}
</div><div class="stack">
<div class="card"><h2>Context to confirm</h2><p class="muted">These are documentation gaps, not schema errors.</p><ul class="checklist">
${check(Boolean(primary), primary ? "Starting source: " + link(primary) : "No recommended starting source.")}
${check(Boolean(brief.rules.trim()), brief.rules.trim() ? "Reporting rules are documented." : "No reporting rules supplied. Confirm filters, dates, and metric definitions.")}
${check(Boolean(brief.reconciliation.trim()), brief.reconciliation.trim() ? "A validation example is documented." : "No validation example. Agree on a known result before signing off the report.")}
${check(!undescribed, undescribed ? (undescribed === 1 ? "1 source has" : undescribed + " sources have") + " no row description. Review their grain in the data dictionary." : "Every source has a row description.")}
</ul></div>
<div class="card"><h2>Export snapshot</h2><dl class="snapshot">
<dt>Project / diagram</dt><dd>${escape(brief.projectName?.trim() || parsed.project?.name || "Not specified")}</dd>
${brief.owner?.trim() ? '<dt>Owner</dt><dd>' + escape(brief.owner.trim()) + '</dd>' : ''}${brief.version?.trim() ? '<dt>Version</dt><dd>' + escape(brief.version.trim()) + '</dd>' : ''}
<dt>Exported</dt><dd><time datetime="${escape(exportedAt)}">${escape(exportedAt)}</time></dd></dl>
<p class="muted">This is a static schema snapshot, not live data. Share the HTML file alongside its links.</p></div>
</div></div>
</section>
<section class="panel card" id="relationships" role="tabpanel" aria-labelledby="tab-relationships" tabindex="0">
<p class="muted">Relationships below are declared in the schema. Guidance describes reporting considerations; no suggested joins are inferred.</p><div class="section-heading"><h2>Join explorer</h2><p id="graph-summary" aria-live="polite"></p></div>
<div id="relationship-graph" hidden>
<div class="graph-tools"><div class="btn-group"><button class="utility" id="graph-back" type="button">← Back</button><button class="utility" id="graph-forward" type="button">Forward →</button><button class="utility" id="graph-home" type="button">Starting source</button></div><label>Find a source<input id="graph-search" type="search" placeholder="Search all sources"></label><label>Schema<select id="graph-schema"></select></label><label>Focus source<select id="graph-source"></select></label></div>
<div id="graph-search-results" aria-label="Relationship search results"></div><p id="graph-focus" role="status"></p><div class="graph-tools"><div class="zoom-group"><button type="button" id="zoom-out" aria-label="Zoom out">−</button><output id="graph-zoom">100%</output><button type="button" id="zoom-in" aria-label="Zoom in">+</button><button type="button" id="graph-fit">Fit tree</button><button type="button" id="graph-reset">Reset</button></div><span class="muted">Click a source to focus · click a connection for details · drag the background to pan</span></div><p id="graph-limit" role="status" hidden>Showing the first 200 branches. Focus a source to explore its connections.</p><p id="graph-empty" role="status" hidden>No declared relationships to other selected sources.</p>
<div id="graph-scroll" class="graph-scroll" tabindex="0" aria-label="Relationship tree"><div class="graph">
<div class="graph-center" id="graph-center"></div><div id="graph-neighbors"></div></div></div>
</div><details id="join-details" open><summary>Join and dependency details</summary><p id="graph-detail-label" role="status"></p><label class="all-joins"><input id="graph-all" type="checkbox"> Show all declared relationships</label><p class="join-guide" id="join-guide">Check for duplicated rows before aggregating across a one-to-many or many-to-many join.</p>
${map.length ? '<ul class="map" tabindex="0" aria-label="Declared joins and dependencies">' + map.join("") + '</ul>' : '<noscript><p>No declared joins or dependencies among the selected sources.</p></noscript>'}
</details></section>
<section class="panel" id="dictionary" role="tabpanel" aria-labelledby="tab-dictionary" tabindex="0">
<div class="dictionary">
<nav class="card" aria-label="Dictionary sources">
<label for="search">Search sources</label><input id="search" type="search" placeholder="Source, column, or description">
<p id="results" class="muted" role="status"></p><div id="search-matches" aria-label="Search matches"></div>
<div class="source-list">${sourceList}</div></nav>
<div>${dictionary}<p id="empty-results" class="card" hidden>No sources match your search.</p></div></div>
</section></main>
<script type="application/json" id="map-data">${scriptJson(mapData)}</script>
<script>
const search = document.getElementById("search");
const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
const panelIds = tabs.map(tab => tab.getAttribute("aria-controls"));
const masthead = document.querySelector(".masthead");
function syncHeaderHeight() { document.documentElement.style.setProperty("--header-h", masthead.offsetHeight + "px"); }
syncHeaderHeight(); if (window.ResizeObserver) new ResizeObserver(syncHeaderHeight).observe(masthead);
for (const time of document.querySelectorAll("time[datetime]")) {
  const date = new Date(time.dateTime);
  if (!isNaN(date)) time.textContent = date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
const sources = Array.from(document.querySelectorAll(".source-list a"), link => {
  const article = document.getElementById(link.getAttribute("href").slice(1));
  const label = link.getAttribute("aria-label");
  const searchable = article.cloneNode(true);
  for (const node of searchable.querySelectorAll("button, .utility, .context-gap, .source-relationships, thead")) node.remove();
  return { link, article, group: link.closest("details"), label, name: label.toLowerCase(), text: searchable.textContent.toLowerCase() };
});
const groups = Array.from(document.querySelectorAll(".source-group"));
let savedGroupState = null;
const byId = new Map(sources.map(source => [source.article.id, source]));
const graph = document.getElementById("relationship-graph");
const schemaSelect = document.getElementById("graph-schema");
const sourceSelect = document.getElementById("graph-source");
const graphScroll = document.getElementById("graph-scroll");
const graphCenter = document.getElementById("graph-center");
const graphNeighbors = document.getElementById("graph-neighbors");
const edges = Array.from(document.querySelectorAll("#relationships .map li[data-left]"));
const adjacency = new Map(sources.map(source => [source.article.id, []]));
for (const edge of edges) {
  const { left, right } = edge.dataset;
  adjacency.get(left).push(edge);
  if (left !== right) adjacency.get(right).push(edge);
}
let graphFocus = "";
let graphHistory = [];
let graphHistoryIndex = -1;
let expanded = new Set();
let inspectedPair = null;
let graphZoom = 1;
const graphHome = byId.get("${primary?.anchor ?? ""}") ?? sources.find(source => adjacency.get(source.article.id).length) ?? sources[0];
const allJoins = document.getElementById("graph-all");
function makeButton(text, action, label = text) {
  const button = document.createElement("button"); button.type = "button"; button.className = "utility";
  button.textContent = text; button.setAttribute("aria-label", label); button.addEventListener("click", action); return button;
}
function graphNode(id) {
  const source = byId.get(id);
  const card = document.createElement("div"); card.className = "graph-node";
  const focus = makeButton(source.link.textContent, () => { focusGraph(id); graphCenter.querySelector("button")?.focus({preventScroll:true}); }, "Focus " + source.label);
  focus.className = "node-focus";
  const schema = document.createElement("span"); schema.className = "node-schema"; schema.textContent = source.group.querySelector("summary").textContent;
  const name = document.createElement("span"); name.className = "node-name"; name.textContent = source.link.textContent;
  focus.replaceChildren(schema, name);
  if (id === graphFocus) focus.setAttribute("aria-current", "true");
  const dictionary = document.createElement("a"); dictionary.className = "utility"; dictionary.href = "#" + id;
  dictionary.dataset.openDictionary = ""; dictionary.textContent = "View columns"; dictionary.setAttribute("aria-label", "View columns for " + source.label);
  card.append(focus, dictionary); return card;
}
function showJoinDetails() {
  let count = 0;
  for (const edge of edges) {
    const {left, right} = edge.dataset;
    const visible = allJoins.checked || (inspectedPair ?
      (left === inspectedPair[0] && right === inspectedPair[1]) || (right === inspectedPair[0] && left === inspectedPair[1]) : left === graphFocus || right === graphFocus);
    edge.hidden = !visible; if (visible) count++;
  }
  const label = inspectedPair ? inspectedPair.map(id => byId.get(id).label).join(" ↔ ") : byId.get(graphFocus)?.label ?? "No source";
  document.getElementById("graph-detail-label").textContent = (allJoins.checked ? "All declared connections" : label) + " · " + count + (count === 1 ? " connection" : " connections");
}
function drawGraph() {
  let rendered = 0;
  function branches(id, path) {
    const list = document.createElement("div");
    const neighbors = new Map();
    for (const edge of adjacency.get(id) ?? []) {
      const other = edge.dataset.left === id ? edge.dataset.right : edge.dataset.left;
      if (!neighbors.has(other)) neighbors.set(other, []); neighbors.get(other).push(edge);
    }
    for (const [other, connections] of neighbors) {
      if (rendered++ >= 200) break;
      const row = document.createElement("div"); row.className = "graph-neighbor";
      const captions = connections.map(edge => {
        const forward = edge.dataset.left === id;
        const end = value => value === "1" ? "one" : "many";
        return edge.hasAttribute("data-dependency") ? (forward ? "Depends on →" : "← Depends on") :
          end(forward ? edge.dataset.leftEnd : edge.dataset.rightEnd) + " to " + end(forward ? edge.dataset.rightEnd : edge.dataset.leftEnd);
      });
      const connection = makeButton([...new Set(captions)].join(" · "), () => {
        inspectedPair = [id, other]; allJoins.checked = false; showJoinDetails();
        document.getElementById("join-details").open = true;
        document.getElementById("graph-detail-label").scrollIntoView({block:"nearest"});
      }, "Inspect connections between " + byId.get(id).label + " and " + byId.get(other).label);
      connection.className = "graph-edge utility";
      const branch = document.createElement("div"); branch.append(graphNode(other));
      const cycle = path.has(other);
      if (!cycle && (adjacency.get(other)?.length ?? 0) > 1) {
        const toggle = makeButton(expanded.has(other) ? "Collapse branch" : "Expand branch", () => {
          if (expanded.has(other)) expanded.delete(other); else expanded.add(other); drawGraph();
          Array.from(graphNeighbors.querySelectorAll("button[aria-expanded]")).find(button => button.getAttribute("aria-label") === (expanded.has(other) ? "Collapse " : "Expand ") + byId.get(other).label)?.focus({preventScroll:true});
        }, (expanded.has(other) ? "Collapse " : "Expand ") + byId.get(other).label);
        toggle.setAttribute("aria-expanded", String(expanded.has(other))); toggle.style.marginTop = "6px"; branch.append(toggle);
        if (expanded.has(other)) { const children = branches(other, new Set([...path, other])); children.className = "expanded-branch"; branch.append(children); }
      } else if (cycle) { const hint = document.createElement("small"); hint.textContent = other === id ? "Self reference" : "Already on this path"; branch.append(hint); }
      row.append(connection, branch); list.append(row);
    }
    return list;
  }
  graphCenter.replaceChildren(...(graphFocus ? [graphNode(graphFocus)] : []));
  graphNeighbors.replaceChildren(branches(graphFocus, new Set([graphFocus])));
  const count = new Set((adjacency.get(graphFocus) ?? []).map(edge => edge.dataset.left === graphFocus ? edge.dataset.right : edge.dataset.left)).size;
  document.getElementById("graph-empty").hidden = count > 0;
  document.getElementById("graph-limit").hidden = rendered < 200;
  document.getElementById("graph-summary").textContent = count + (count === 1 ? " connected source" : " connected sources");
  document.getElementById("graph-focus").textContent = "Focused source: " + (byId.get(graphFocus)?.label ?? "None");
  document.getElementById("graph-back").disabled = graphHistoryIndex <= 0;
  document.getElementById("graph-forward").disabled = graphHistoryIndex >= graphHistory.length - 1;
  showJoinDetails();
}
function focusGraph(id, remember = true) {
  if (!byId.has(id)) return;
  graphFocus = id; expanded.clear(); inspectedPair = null; allJoins.checked = false;
  if (remember && graphHistory[graphHistoryIndex] !== id) { graphHistory = graphHistory.slice(0, graphHistoryIndex + 1); graphHistory.push(id); graphHistoryIndex++; }
  schemaSelect.value = String(groups.indexOf(byId.get(id).group));
  const available = sources.filter(source => source.group === byId.get(id).group);
  sourceSelect.replaceChildren(...available.map(source => new Option(source.label, source.article.id))); sourceSelect.value = id;
  graphScroll.scrollTo(0, 0); drawGraph();
}
function setGraphZoom(value) {
  graphZoom = Math.max(.35, Math.min(2, value)); graphScroll.querySelector(".graph").style.zoom = graphZoom;
  document.getElementById("graph-zoom").textContent = Math.round(graphZoom * 100) + "%";
}
document.getElementById("zoom-in").addEventListener("click", () => setGraphZoom(graphZoom + .15));
document.getElementById("zoom-out").addEventListener("click", () => setGraphZoom(graphZoom - .15));
document.getElementById("graph-fit").addEventListener("click", () => { const tree = graphScroll.querySelector(".graph"); setGraphZoom(Math.min(1, graphScroll.clientWidth / tree.offsetWidth, graphScroll.clientHeight / tree.offsetHeight)); graphScroll.scrollTo(0,0); });
document.getElementById("graph-reset").addEventListener("click", () => { expanded.clear(); setGraphZoom(1); graphScroll.scrollTo(0,0); drawGraph(); });
document.getElementById("graph-back").addEventListener("click", () => { if (graphHistoryIndex > 0) focusGraph(graphHistory[--graphHistoryIndex], false); });
document.getElementById("graph-forward").addEventListener("click", () => { if (graphHistoryIndex < graphHistory.length - 1) focusGraph(graphHistory[++graphHistoryIndex], false); });
document.getElementById("graph-home").addEventListener("click", () => focusGraph(graphHome?.article.id));
allJoins.addEventListener("change", showJoinDetails);
const graphSearch = document.getElementById("graph-search");
graphSearch.addEventListener("input", () => {
  const results = document.getElementById("graph-search-results"); results.replaceChildren();
  const query = graphSearch.value.trim().toLowerCase(); if (!query) return;
  const matches = sources.filter(source => source.name.includes(query));
  for (const source of matches.slice(0, 30)) results.append(makeButton(source.label, () => { focusGraph(source.article.id); graphSearch.value = ""; results.replaceChildren(); }));
  const status = document.createElement("p"); status.textContent = matches.length ? "Showing " + Math.min(30, matches.length) + " of " + matches.length + " matches" : "No matching sources"; results.append(status);
});
let drag = null;
graphScroll.addEventListener("pointerdown", event => { if (event.button !== 0 || event.target.closest("button,a,input,select")) return; drag = {x:event.clientX,y:event.clientY,left:graphScroll.scrollLeft,top:graphScroll.scrollTop}; graphScroll.setPointerCapture(event.pointerId); });
graphScroll.addEventListener("pointermove", event => { if (drag) { graphScroll.scrollLeft = drag.left + drag.x - event.clientX; graphScroll.scrollTop = drag.top + drag.y - event.clientY; } });
for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) graphScroll.addEventListener(name, () => { drag = null; });
if (sources.length) {
  schemaSelect.replaceChildren(...groups.map((group, index) => new Option(group.querySelector("summary").textContent, String(index))));
  schemaSelect.addEventListener("change", () => { const source = sources.find(source => source.group === groups[Number(schemaSelect.value)]); focusGraph(source?.article.id); });
  sourceSelect.addEventListener("change", () => focusGraph(sourceSelect.value));
  focusGraph(graphHome.article.id); graph.hidden = false;
}
let current = null;
const tabListeners = [];
function openTab(id) {
  for (const tab of tabs) {
    const selected = tab.getAttribute("aria-controls") === id;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    document.getElementById(tab.getAttribute("aria-controls")).hidden = !selected;
  }
  for (const listener of tabListeners) listener(id);
}
function showSource(source) {
  current = source;
  for (const item of sources) {
    item.article.hidden = item !== source;
    if (item === source) item.link.setAttribute("aria-current", "true");
    else item.link.removeAttribute("aria-current");
  }
}
function highlight(node, query) {
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  const texts = []; while (walker.nextNode()) texts.push(walker.currentNode);
  for (const text of texts) {
    const value = text.textContent; const lower = value.toLowerCase(); let start = 0; let at = lower.indexOf(query);
    if (at < 0) continue;
    const fragment = document.createDocumentFragment();
    while (at >= 0) {
      fragment.append(document.createTextNode(value.slice(start, at)));
      const mark = document.createElement("mark"); mark.dataset.match = ""; mark.textContent = value.slice(at, at + query.length); fragment.append(mark);
      start = at + query.length; at = lower.indexOf(query, start);
    }
    fragment.append(document.createTextNode(value.slice(start))); text.replaceWith(fragment);
  }
}
function filterSources(preferred = current) {
  const query = search.value.trim().toLowerCase();
  if (query && !savedGroupState) savedGroupState = new Map(groups.map(group => [group, group.open]));
  if (!query && savedGroupState) {
    for (const [group, open] of savedGroupState) group.open = open;
    savedGroupState = null;
  }
  const resultList = document.getElementById("search-matches");
  resultList.replaceChildren();
  for (const mark of document.querySelectorAll("mark[data-match]")) { mark.replaceWith(document.createTextNode(mark.textContent)); }
  for (const source of sources) source.article.normalize();
  const matchingGroups = new Set();
  const matches = sources.filter(source => {
    const visible = source.text.includes(query);
    source.link.parentElement.hidden = !visible;
    if (visible) {
      matchingGroups.add(source.group);
      if (query) {
        const hit = Array.from(source.article.querySelectorAll("[data-searchable], .prose, .source-heading h3")).find(node => node.textContent.toLowerCase().includes(query));
        const result = document.createElement("a"); result.href = "#" + source.article.id;
        const label = document.createElement("strong"); label.textContent = source.label;
        const snippet = document.createElement("small");
        const text = hit?.textContent ?? source.label;
        const at = text.toLowerCase().indexOf(query);
        snippet.textContent = (at > 45 ? "…" : "") + text.slice(Math.max(0, at - 45), Math.max(0, at - 45) + 150);
        result.append(label, snippet); resultList.append(result);
        for (const node of source.article.querySelectorAll("[data-searchable], .prose, .source-heading h3")) highlight(node, query);
        highlight(snippet, query);
      }
    }
    return visible;
  });
  for (const group of groups) {
    group.hidden = !matchingGroups.has(group);
    if (query && !group.hidden) group.open = true;
  }
  showSource(matches.includes(preferred) ? preferred : matches.find(item => item.name === query) ?? matches[0]);
  document.getElementById("results").textContent = matches.length + " of " + sources.length + " sources";
  document.getElementById("empty-results").hidden = matches.length > 0;
}
function openSource(source, focus) {
  if (!source) return;
  openTab("dictionary");
  if (!source.text.includes(search.value.trim().toLowerCase())) search.value = "";
  filterSources(source);
  source.group.open = true;
  if (focus) source.article.focus();
}
for (const [index, tab] of tabs.entries()) {
  tab.addEventListener("click", () => { const id = tab.getAttribute("aria-controls"); openTab(id); saveHash("#" + id); });
  tab.addEventListener("keydown", event => {
    const next = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: tabs.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const target = tabs[(next + tabs.length) % tabs.length];
    target.click();
    target.focus();
  });
}
search.addEventListener("input", () => filterSources());
document.addEventListener("click", event => {
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  const link = event.target.closest('a[href^="#source-"]');
  if (!link) return;
  const hash = link.getAttribute("href");
  event.preventDefault();
  if (link.closest("#relationships") && !link.hasAttribute("data-open-dictionary")) { focusGraph(hash.slice(1)); return; }
  openSource(byId.get(hash.slice(1)), true);
  saveHash(hash);
});
function restoreLocation() {
  const source = byId.get(location.hash.slice(1));
  if (source) openSource(source, false);
  else openTab(panelIds.includes(location.hash.slice(1)) ? location.hash.slice(1) : "graph");
}
filterSources();
for (const group of groups) group.open = group === current?.group;
restoreLocation();
document.querySelector('[role="tablist"]').hidden = false;
window.addEventListener("hashchange", restoreLocation);
window.addEventListener("popstate", restoreLocation);
function saveHash(hash) { if (window.parent === window && location.hash !== hash) { try { history.pushState(null, "", hash); } catch { location.hash = hash; } } }
let copyTimer = 0;
async function copyText(value) {
  const status = document.getElementById("copy-status");
  clearTimeout(copyTimer); copyTimer = setTimeout(() => { status.textContent = ""; }, 2600);
  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
    await navigator.clipboard.writeText(value); status.textContent = "Copied to clipboard.";
  } catch {
    const previousFocus = document.activeElement;
    const field = document.createElement("textarea"); field.value = value; field.setAttribute("aria-label", "Text to copy");
    document.body.append(field); field.select();
    let copied = false; try { copied = document.execCommand("copy"); } catch {} finally { field.remove(); previousFocus?.focus(); }
    status.textContent = copied ? "Copied to clipboard." : "Copy is unavailable in this browser. Select and copy the displayed text.";
  }
}
document.addEventListener("click", event => { const button = event.target.closest("[data-copy]"); if (button) copyText(button.dataset.copy); });
document.getElementById("copy-link").addEventListener("click", () => {
  const active = tabs.find(tab => tab.getAttribute("aria-selected") === "true").getAttribute("aria-controls");
  const hash = active === "dictionary" && current ? "#" + current.article.id : "#" + active;
  copyText(window.parent === window ? location.href.split("#")[0] + hash : hash);
});
let detailsBeforePrint = true;
window.addEventListener("beforeprint", () => { const details = document.getElementById("join-details"); detailsBeforePrint = details.open; details.open = true; });
window.addEventListener("afterprint", () => { document.getElementById("join-details").open = detailsBeforePrint; });
document.getElementById("print").addEventListener("click", () => window.print());
const theme = document.getElementById("theme");
function setTheme(value) { document.documentElement.dataset.theme = value; theme.value = value; }
try { const saved = localStorage.getItem("dbluna-handoff-theme"); if (["light", "dark", "system"].includes(saved)) setTheme(saved); } catch {}
theme.addEventListener("change", () => { setTheme(theme.value); try { localStorage.setItem("dbluna-handoff-theme", theme.value); } catch {} });
document.querySelector(".export-tools").hidden = false;

/* ── Graph tab: force-directed map of every included source ─────────────── */
{
const canvas = document.getElementById("map-canvas");
const stage = document.getElementById("map-stage");
const mapData = JSON.parse(document.getElementById("map-data").textContent);
const ctx = canvas.getContext && canvas.getContext("2d");
if (ctx && mapData.nodes.length) {
  const tip = document.getElementById("map-tip");
  const inspector = document.getElementById("map-inspector");
  const legend = document.getElementById("map-legend");
  const find = document.getElementById("map-find");
  const findResults = document.getElementById("map-find-results");
  const zoomLabel = document.getElementById("map-zoom");
  const font = getComputedStyle(document.body).fontFamily;
  const palette = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6", "#f97316", "#84cc16", "#ef4444"];
  const schemaNames = Array.from(new Set(mapData.nodes.map(node => node.schema))).sort();
  const schemaColor = new Map(schemaNames.map((name, index) => [name, palette[index % palette.length]]));
  const nodes = mapData.nodes.map(node => Object.assign({}, node, { x: 0, y: 0, vx: 0, vy: 0, fx: null, fy: null, links: [], near: new Set(), color: schemaColor.get(node.schema) }));
  const nodeById = new Map(nodes.map(node => [node.id, node]));
  const links = [];
  for (const edge of mapData.edges) {
    const a = nodeById.get(edge.s), b = nodeById.get(edge.t);
    if (!a || !b) continue;
    const link = Object.assign({}, edge, { a, b });
    links.push(link); a.links.push(link);
    if (a !== b) { b.links.push(link); a.near.add(b); b.near.add(a); }
  }
  for (const node of nodes) node.r = 6 + Math.sqrt(node.near.size) * 2.8;
  for (const link of links) link.strength = 1 / Math.max(1, Math.min(link.a.near.size, link.b.near.size));
  schemaNames.forEach((schema, groupIndex) => {
    const members = nodes.filter(node => node.schema === schema);
    const angle = groupIndex / schemaNames.length * Math.PI * 2;
    const spread = schemaNames.length > 1 ? 34 * Math.sqrt(nodes.length) : 0;
    members.forEach((node, k) => {
      const radius = 16 * Math.sqrt(k + .5), turn = k * 2.399963;
      node.x = Math.cos(angle) * spread + radius * Math.cos(turn);
      node.y = Math.sin(angle) * spread + radius * Math.sin(turn);
    });
  });

  const hiddenSchemas = new Set();
  const shown = node => !hiddenSchemas.has(node.schema);
  const view = { x: 0, y: 0, k: 1 };
  const colors = {};
  let alpha = 1, hovered = null, selected = null, autoFit = true, frame = 0, tween = 0, width = 0, height = 0;
  const reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function readColors() {
    const style = getComputedStyle(document.documentElement);
    for (const name of ["ink", "muted", "edge", "primary", "canvas", "surface", "line"]) colors[name] = style.getPropertyValue("--" + name).trim();
  }
  function tick() {
    const active = nodes.filter(shown);
    const centers = new Map();
    for (const node of active) {
      const center = centers.get(node.schema) || { x: 0, y: 0, n: 0 };
      center.x += node.x; center.y += node.y; center.n++; centers.set(node.schema, center);
    }
    for (let i = 0; i < active.length; i++) {
      const a = active[i];
      for (let j = i + 1; j < active.length; j++) {
        const b = active[j];
        let dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
        if (d2 > 250000) continue;
        if (d2 < 1) { dx = Math.random() - .5; dy = Math.random() - .5; d2 = 1; }
        const force = 520 * alpha / Math.max(d2, 64);
        a.vx -= dx * force; a.vy -= dy * force; b.vx += dx * force; b.vy += dy * force;
      }
    }
    for (const link of links) {
      const a = link.a, b = link.b;
      if (a === b || !shown(a) || !shown(b)) continue;
      let dx = b.x + b.vx - a.x - a.vx, dy = b.y + b.vy - a.y - a.vy;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      const k = (distance - (60 + a.r + b.r)) / distance * alpha * link.strength;
      dx *= k; dy *= k;
      const bias = a.near.size / (a.near.size + b.near.size);
      b.vx -= dx * bias; b.vy -= dy * bias; a.vx += dx * (1 - bias); a.vy += dy * (1 - bias);
    }
    const cluster = schemaNames.length > 1 ? .05 : 0;
    for (const node of active) {
      const center = centers.get(node.schema);
      node.vx += (-node.x * .025 + (center.x / center.n - node.x) * cluster) * alpha;
      node.vy += (-node.y * .025 + (center.y / center.n - node.y) * cluster) * alpha;
    }
    for (const node of active) {
      if (node.fx !== null) { node.x = node.fx; node.y = node.fy; node.vx = node.vy = 0; }
      else { node.vx *= .6; node.vy *= .6; node.x += node.vx; node.y += node.vy; }
    }
    alpha += (0 - alpha) * .0228;
  }
  function pill(x, y, text, px) {
    const w = 14 * px, h = 14 * px;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - w / 2, y - h / 2, w, h, 4 * px); else ctx.rect(x - w / 2, y - h / 2, w, h);
    ctx.fillStyle = colors.surface; ctx.fill(); ctx.lineWidth = 1.2 * px; ctx.strokeStyle = colors.primary; ctx.stroke();
    ctx.fillStyle = colors.primary; ctx.fillText(text, x, y + .5 * px);
  }
  function shape(node, grow) {
    const r = node.r + grow;
    ctx.beginPath();
    if (node.kind === "View") { ctx.moveTo(node.x, node.y - r * 1.2); ctx.lineTo(node.x + r * 1.2, node.y); ctx.lineTo(node.x, node.y + r * 1.2); ctx.lineTo(node.x - r * 1.2, node.y); ctx.closePath(); }
    else ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
  }
  function draw() {
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.translate(view.x, view.y); ctx.scale(view.k, view.k);
    const px = 1 / view.k;
    const focus = hovered || selected;
    const lit = focus ? new Set([focus, ...focus.near]) : null;
    for (const link of links) {
      if (!shown(link.a) || !shown(link.b)) continue;
      const on = focus && (link.a === focus || link.b === focus);
      ctx.globalAlpha = focus ? (on ? .95 : .06) : .55;
      ctx.strokeStyle = on ? colors.primary : colors.edge;
      ctx.lineWidth = (on ? 2 : 1.2) * px;
      ctx.setLineDash(link.dep ? [5 * px, 4 * px] : []);
      ctx.beginPath();
      if (link.a === link.b) ctx.arc(link.a.x + link.a.r, link.a.y - link.a.r, link.a.r * .9, 0, Math.PI * 2);
      else { ctx.moveTo(link.a.x, link.a.y); ctx.lineTo(link.b.x, link.b.y); }
      ctx.stroke();
    }
    ctx.setLineDash([]);
    const ordered = lit ? nodes.filter(node => !lit.has(node)).concat(nodes.filter(node => lit.has(node))) : nodes;
    for (const node of ordered) {
      if (!shown(node)) continue;
      ctx.globalAlpha = lit && !lit.has(node) ? .16 : 1;
      if (node === focus) { shape(node, 6 * px); ctx.fillStyle = node.color; ctx.globalAlpha = .2; ctx.fill(); ctx.globalAlpha = 1; }
      shape(node, 0); ctx.fillStyle = node.color; ctx.fill();
      ctx.lineWidth = 1.5 * px; ctx.strokeStyle = colors.surface; ctx.stroke();
      if (node.primary || node === selected) {
        shape(node, 3.5 * px); ctx.lineWidth = 2 * px; ctx.strokeStyle = node === selected ? colors.ink : colors.primary; ctx.stroke();
      }
    }
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    if (focus && view.k > .4) {
      ctx.globalAlpha = 1; ctx.font = "700 " + 9 * px + "px " + font;
      for (const link of focus.links) {
        if (link.dep || link.a === link.b || !shown(link.a) || !shown(link.b)) continue;
        for (const [node, other, end] of [[link.a, link.b, link.ae], [link.b, link.a, link.be]]) {
          const dx = other.x - node.x, dy = other.y - node.y, d = Math.hypot(dx, dy) || 1;
          const offset = node.r + 12 * px;
          if (d < offset * 2) continue;
          pill(node.x + dx / d * offset, node.y + dy / d * offset, end === "*" ? "N" : "1", px);
        }
      }
    }
    const zoomFade = nodes.length <= 40 ? 1 : Math.max(0, Math.min(1, (view.k - .55) / .45));
    ctx.textBaseline = "top"; ctx.lineJoin = "round";
    for (const node of ordered) {
      if (!shown(node)) continue;
      const emphasis = node === focus || node.primary || (lit && lit.has(node));
      const labelAlpha = lit ? (lit.has(node) ? 1 : zoomFade * .14) : (node.primary ? 1 : zoomFade);
      if (labelAlpha < .02) continue;
      ctx.globalAlpha = labelAlpha;
      ctx.font = (emphasis ? "600 " : "500 ") + 11.5 * px + "px " + font;
      const label = node === focus ? node.name : node.short;
      const y = node.y + node.r * (node.kind === "View" ? 1.2 : 1) + 5 * px;
      ctx.lineWidth = 4 * px; ctx.strokeStyle = colors.canvas; ctx.strokeText(label, node.x, y);
      ctx.fillStyle = emphasis ? colors.ink : colors.muted; ctx.fillText(label, node.x, y);
    }
    ctx.globalAlpha = 1;
    zoomLabel.textContent = Math.round(view.k * 100) + "%";
  }
  function request() { if (!frame) frame = requestAnimationFrame(loop); }
  function loop() {
    frame = 0;
    if (alpha > .004) { tick(); if (autoFit) fit(false); request(); }
    draw();
  }
  function bounds() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const node of nodes) {
      if (!shown(node)) continue;
      x0 = Math.min(x0, node.x - node.r - 40); x1 = Math.max(x1, node.x + node.r + 40);
      y0 = Math.min(y0, node.y - node.r - 16); y1 = Math.max(y1, node.y + node.r + 30);
    }
    return { x0, y0, x1, y1 };
  }
  // Room the pinned inspector takes: a right-hand panel on wide screens, a bottom sheet on phones.
  function insets() {
    if (inspector.hidden) return { right: 0, bottom: 0 };
    return width > 672 ? { right: inspector.offsetWidth + 24, bottom: 0 } : { right: 0, bottom: inspector.offsetHeight + 16 };
  }
  function setView(x, y, k, animate) {
    cancelAnimationFrame(tween);
    if (!animate || reduceMotion) { view.x = x; view.y = y; view.k = k; request(); return; }
    const from = { x: view.x, y: view.y, k: view.k }, start = performance.now();
    const step = now => {
      const t = Math.min(1, (now - start) / 360), e = 1 - Math.pow(1 - t, 3);
      view.x = from.x + (x - from.x) * e; view.y = from.y + (y - from.y) * e; view.k = from.k + (k - from.k) * e;
      draw(); if (t < 1) tween = requestAnimationFrame(step);
    };
    tween = requestAnimationFrame(step);
  }
  function fit(animate) {
    if (!width) return;
    const box = bounds();
    if (!isFinite(box.x0)) return;
    const inset = insets(), usable = width - inset.right;
    const hint = 40 + inset.bottom; // keep the hint bar (and any bottom sheet) from covering labels
    const k = Math.max(.1, Math.min(1.6, (usable - 32) / (box.x1 - box.x0), (height - 32 - hint) / (box.y1 - box.y0)));
    setView(usable / 2 - (box.x0 + box.x1) / 2 * k, (height - hint) / 2 - (box.y0 + box.y1) / 2 * k, k, animate);
  }
  function centerOn(node) {
    const k = Math.max(view.k, 1.1);
    autoFit = false;
    const inset = insets();
    setView((width - inset.right) / 2 - node.x * k, (height - inset.bottom) / 2 - node.y * k, k, true);
  }
  function zoomAt(sx, sy, factor) {
    const k = Math.max(.08, Math.min(4, view.k * factor));
    view.x = sx - (sx - view.x) * (k / view.k); view.y = sy - (sy - view.y) * (k / view.k); view.k = k;
    autoFit = false; request();
  }
  function resize() {
    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = window.devicePixelRatio || 1;
    width = rect.width; height = rect.height;
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    if (autoFit) fit(false);
    draw(); request();
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function headOf(node) {
    const wrap = el("div");
    const meta = el("div", "node-meta");
    const dot = el("i", "dot" + (node.kind === "View" ? " view" : "")); dot.style.setProperty("--c", node.color);
    meta.append(dot, el("span", "", node.schema), el("span", "badge", node.kind));
    wrap.append(meta, el("strong", "node-title", node.short));
    return wrap;
  }
  function columnList(node, limit, detailed) {
    const list = el("ul", "cols");
    for (const column of node.cols.slice(0, limit)) {
      const item = el("li");
      item.append(column.pk ? el("span", "col-key pk", "PK") : column.fk ? el("span", "col-key fk", "FK") : el("span"),
        el("span", "n", column.n), el("span", "t", column.t + (column.nn || column.pk ? "" : "?")));
      if (detailed && (column.fk || column.ref)) item.append(el("span", "to", "→ " + (column.fk || column.ref)));
      list.append(item);
    }
    return list;
  }
  function relationText(node, link) {
    if (link.dep) return link.a === node ? "depends on" : "used by";
    const end = value => value === "1" ? "one" : "many";
    return link.a === node ? end(link.ae) + " to " + end(link.be) : end(link.be) + " to " + end(link.ae);
  }
  function summary(node) {
    return (node.kind === "View" ? "View" : node.cols.length + (node.cols.length === 1 ? " column" : " columns")) +
      " · " + node.near.size + (node.near.size === 1 ? " connection" : " connections");
  }
  function showTip(node, sx, sy) {
    if (node === selected && !inspector.hidden) { hideTip(); return; }
    const parts = [headOf(node), el("div", "insp-stats", summary(node))];
    if (node.rows) parts.push(el("p", "", node.rows.length > 160 ? node.rows.slice(0, 157) + "…" : node.rows));
    if (node.cols.length) parts.push(columnList(node, 8, false));
    if (node.cols.length > 8) parts.push(el("p", "more", "+ " + (node.cols.length - 8) + " more columns"));
    parts.push(el("footer", "", "Click to pin details · double-click to open in the dictionary"));
    tip.replaceChildren(...parts); tip.hidden = false;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let left = sx + 18, top = sy + 18;
    if (left + tw > width - 8) left = sx - tw - 18;
    if (top + th > height - 8) top = height - th - 8;
    tip.style.left = Math.max(8, left) + "px"; tip.style.top = Math.max(8, top) + "px";
  }
  function hideTip() { tip.hidden = true; }
  function openColumns(node) { openSource(byId.get(node.id), true); saveHash("#" + node.id); }
  function select(node, center) {
    selected = node || null;
    hideTip();
    if (!selected) { inspector.hidden = true; request(); return; }
    const head = el("div", "insp-head");
    const top = el("div", "insp-top");
    const close = el("button", "insp-close", "×"); close.type = "button"; close.setAttribute("aria-label", "Close details");
    close.addEventListener("click", () => { select(null); canvas.focus({ preventScroll: true }); });
    top.append(headOf(node), close);
    const actions = el("div", "insp-actions");
    const open = el("a", "utility primary", "View in dictionary"); open.href = "#" + node.id; open.dataset.openDictionary = "";
    const joins = el("button", "utility", "Explore joins"); joins.type = "button";
    joins.addEventListener("click", () => { openTab("relationships"); focusGraph(node.id); saveHash("#relationships"); });
    const copy = el("button", "utility", "Copy name"); copy.type = "button"; copy.dataset.copy = node.name;
    actions.append(open, joins, copy);
    head.append(top, el("div", "insp-stats", summary(node)), actions);
    const body = el("div", "insp-body");
    body.append(el("h4", "", "Row meaning"), node.rows ? el("p", "prose", node.rows) : el("p", "muted", "Not documented yet. Confirm what makes one record distinct before aggregating."));
    if (node.note) body.append(el("h4", "", "Description"), el("p", "prose", node.note));
    if (node.cols.length) body.append(el("h4", "", "Columns (" + node.cols.length + ")"), columnList(node, Infinity, true));
    const neighbours = Array.from(node.near).sort((a, b) => a.name.localeCompare(b.name));
    body.append(el("h4", "", "Connections (" + neighbours.length + ")"));
    if (!neighbours.length) body.append(el("p", "muted", "No declared relationships to other included sources."));
    else {
      const list = el("ul", "nbrs");
      for (const other of neighbours) {
        const button = el("button"); button.type = "button";
        const dot = el("i", "dot" + (other.kind === "View" ? " view" : "")); dot.style.setProperty("--c", other.color);
        const relation = Array.from(new Set(node.links.filter(link => link.a === other || link.b === other).map(link => relationText(node, link)))).join(" · ");
        button.append(dot, el("span", "nb-name", other.name), el("small", "", relation));
        button.addEventListener("click", () => select(other, true));
        const item = el("li"); item.append(button); list.append(item);
      }
      body.append(list);
    }
    inspector.replaceChildren(head, body);
    inspector.hidden = false;
    const inset = insets(), screenX = node.x * view.k + view.x, screenY = node.y * view.k + view.y;
    if (center || screenX > width - inset.right - 24 || screenY > height - inset.bottom - 24) centerOn(node);
    request();
  }

  let press = null;
  function pointFrom(event) {
    const rect = canvas.getBoundingClientRect();
    const sx = event.clientX - rect.left, sy = event.clientY - rect.top;
    return { sx, sy, x: (sx - view.x) / view.k, y: (sy - view.y) / view.k };
  }
  function nodeAt(point) {
    let best = null, bestDistance = Infinity;
    for (const node of nodes) {
      if (!shown(node)) continue;
      const distance = Math.hypot(node.x - point.x, node.y - point.y);
      if (distance < node.r * (node.kind === "View" ? 1.2 : 1) + 5 / view.k && distance < bestDistance) { best = node; bestDistance = distance; }
    }
    return best;
  }
  canvas.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    const point = pointFrom(event), node = nodeAt(point);
    press = { node, sx: point.sx, sy: point.sy, vx: view.x, vy: view.y, moved: false };
    canvas.setPointerCapture(event.pointerId);
    if (node) { node.fx = node.x; node.fy = node.y; }
    hideTip();
  });
  canvas.addEventListener("pointermove", event => {
    const point = pointFrom(event);
    if (press) {
      if (!press.moved && Math.hypot(point.sx - press.sx, point.sy - press.sy) > 4) { press.moved = true; autoFit = false; canvas.classList.add("dragging"); }
      if (!press.moved) return;
      if (press.node) { press.node.fx = point.x; press.node.fy = point.y; alpha = Math.max(alpha, .22); hovered = press.node; }
      else { view.x = press.vx + point.sx - press.sx; view.y = press.vy + point.sy - press.sy; }
      request(); return;
    }
    const node = nodeAt(point);
    if (node !== hovered) { hovered = node; canvas.classList.toggle("over-node", Boolean(node)); request(); }
    if (node && event.pointerType !== "touch") showTip(node, point.sx, point.sy); else hideTip();
  });
  function release(event) {
    if (!press) return;
    const { node, moved } = press;
    press = null; canvas.classList.remove("dragging");
    if (node) { node.fx = null; node.fy = null; }
    if (!moved && event.type === "pointerup") select(node);
    if (event.pointerType === "touch") { hovered = null; request(); }
  }
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("pointerleave", () => { if (!press) { hovered = null; canvas.classList.remove("over-node"); hideTip(); request(); } });
  canvas.addEventListener("dblclick", event => { const node = nodeAt(pointFrom(event)); if (node) openColumns(node); });
  canvas.addEventListener("wheel", event => {
    event.preventDefault();
    const point = pointFrom(event);
    zoomAt(point.sx, point.sy, Math.exp(-event.deltaY * (event.deltaMode === 1 ? 33 : 1) * .0016));
  }, { passive: false });
  canvas.addEventListener("keydown", event => {
    const pan = (dx, dy) => { view.x += dx; view.y += dy; autoFit = false; request(); };
    const actions = {
      "+": () => zoomAt(width / 2, height / 2, 1.25), "=": () => zoomAt(width / 2, height / 2, 1.25), "-": () => zoomAt(width / 2, height / 2, .8),
      "0": () => { autoFit = true; fit(true); }, ArrowLeft: () => pan(60, 0), ArrowRight: () => pan(-60, 0), ArrowUp: () => pan(0, 60), ArrowDown: () => pan(0, -60),
      Escape: () => select(null), Enter: () => { if (selected) openColumns(selected); },
    };
    const action = actions[event.key];
    if (action) { event.preventDefault(); action(); }
  });
  document.getElementById("map-zoom-in").addEventListener("click", () => zoomAt(width / 2, height / 2, 1.25));
  document.getElementById("map-zoom-out").addEventListener("click", () => zoomAt(width / 2, height / 2, .8));
  document.getElementById("map-fit").addEventListener("click", () => { autoFit = true; fit(true); });

  if (schemaNames.length > 1) {
    for (const schema of schemaNames) {
      const button = el("button"); button.type = "button"; button.setAttribute("aria-pressed", "true");
      button.title = "Show or hide the " + schema + " schema";
      const dot = el("i", "dot"); dot.style.setProperty("--c", schemaColor.get(schema));
      button.append(dot, el("span", "", schema), el("small", "", String(nodes.filter(node => node.schema === schema).length)));
      button.addEventListener("click", () => {
        const hide = !hiddenSchemas.has(schema);
        if (hide && hiddenSchemas.size === schemaNames.length - 1) return;
        if (hide) hiddenSchemas.add(schema); else hiddenSchemas.delete(schema);
        button.setAttribute("aria-pressed", String(!hide));
        if (selected && !shown(selected)) select(null);
        alpha = Math.max(alpha, .3); if (autoFit) fit(true); request();
      });
      legend.append(button);
    }
  } else legend.append(el("span", "muted", nodes.length + (nodes.length === 1 ? " source" : " sources") + " · " + links.length + (links.length === 1 ? " connection" : " connections")));

  let matches = [], active = 0;
  function renderFind() {
    const query = find.value.trim().toLowerCase();
    findResults.replaceChildren();
    if (!query) { findResults.hidden = true; return; }
    const rank = node => node.short.toLowerCase().startsWith(query) ? 0 : node.name.toLowerCase().startsWith(query) ? 1 : 2;
    matches = nodes.filter(node => node.name.toLowerCase().includes(query)).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name)).slice(0, 8);
    active = 0;
    if (!matches.length) findResults.append(el("p", "", "No matching sources"));
    matches.forEach((node, index) => {
      const option = el("button"); option.type = "button"; option.setAttribute("role", "option");
      option.setAttribute("aria-selected", String(index === active));
      const dot = el("i", "dot" + (node.kind === "View" ? " view" : "")); dot.style.setProperty("--c", node.color);
      option.append(dot, el("span", "", node.name), el("small", "", node.near.size + " links"));
      option.addEventListener("click", () => pick(node));
      findResults.append(option);
    });
    findResults.hidden = false;
  }
  function pick(node) {
    if (!node) return;
    if (!shown(node)) { hiddenSchemas.delete(node.schema); legend.querySelectorAll("button").forEach(button => { if (button.textContent.startsWith(node.schema)) button.setAttribute("aria-pressed", "true"); }); }
    find.value = ""; findResults.hidden = true;
    select(node, true);
  }
  find.addEventListener("input", renderFind);
  find.addEventListener("keydown", event => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!matches.length) return;
      active = (active + (event.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length;
      Array.from(findResults.querySelectorAll("button")).forEach((button, index) => button.setAttribute("aria-selected", String(index === active)));
    } else if (event.key === "Enter") { event.preventDefault(); pick(matches[active]); }
    else if (event.key === "Escape") { find.value = ""; findResults.hidden = true; }
  });
  document.addEventListener("click", event => { if (!event.target.closest(".map-find")) findResults.hidden = true; });

  document.addEventListener("click", event => {
    const trigger = event.target.closest("[data-show-graph]");
    if (!trigger) return;
    const node = nodeById.get(trigger.dataset.showGraph);
    if (!node) return;
    openTab("graph"); saveHash("#graph"); resize();
    if (!shown(node)) pick(node); else select(node, true);
  });
  tabListeners.push(id => { if (id === "graph") requestAnimationFrame(resize); else hideTip(); });
  theme.addEventListener("change", () => { readColors(); request(); });
  if (window.matchMedia) matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => { readColors(); request(); });
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage); else window.addEventListener("resize", resize);

  readColors();
  const warm = reduceMotion ? 300 : nodes.length > 600 ? 15 : 60;
  for (let i = 0; i < warm && alpha > .004; i++) tick();
  resize();
  document.getElementById("map-hint").hidden = matchMedia && matchMedia("(hover: none)").matches;
}
}
</script></body></html>`;
}
