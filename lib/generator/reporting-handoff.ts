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

const escape = (value: string) => value.replace(/[&<>"']/g, char =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!,
);
const noteText = (note: string | { value: string } | undefined) =>
  typeof note === "string" ? note : note?.value;
const prose = (label: string, value?: string) => value?.trim()
  ? '<h3>' + escape(label) + '</h3><p class="prose">' + escape(value.trim()) + '</p>'
  : "";

export function generateReportingHandoff(
  parsed: ParsedDbmlResult,
  brief: ReportingBrief,
  selected: Readonly<Record<string, string>>,
  primaryKey: string,
  options: { includeNotes: boolean; includeSql: boolean; exportedAt?: string },
) {
  const sources = reportingSources(parsed).filter(source => Object.hasOwn(selected, source.key))
    .map((source, index) => ({ ...source, anchor: "source-" + (index + 1) }));
  const copyButton = (value: string, label: string) => '<button type="button" class="utility" data-copy="' + escape(value) + '" aria-label="' + escape(label) + '">Copy</button>';
  const exportedAt = options.exportedAt ?? new Date().toISOString();
  const primary = sources.find(source => source.key === primaryKey);
  const link = (source: typeof sources[number]) =>
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
  const joinBody = (join: typeof joins[number]) => {
    const { left, right, conditions, cardinality, name, first, second } = join;
    const guidance = first === "*" && second === "*"
      ? "Many-to-many: rows can multiply on both sides. Confirm the intended grain and aggregate or deduplicate before combining measures."
      : first === "*" || second === "*"
        ? "Joining " + (first === "1" ? left.name : right.name) + " to " + (first === "*" ? left.name : right.name) + " can repeat rows from the one side. Aggregate the many side before summing one-side measures."
        : "Declared one-to-one: verify key uniqueness in the actual data before relying on one row per match.";
    return '<div class="join-heading">' + link(left) + '<span class="badge">' + cardinality + '</span>' + link(right) + '</div><small>Declared relationship · left source to right source</small>' +
      (name ? '<small class="constraint-name">' + escape(name) + '</small>' : '') +
      '<code>' + escape(conditions.join(" AND ")) + '</code>' + copyButton(conditions.join(" AND "), "Copy join condition") +
      (conditions.length > 1 ? '<p>Composite join. Match every column pair.</p>' : '') +
      '<p class="guidance">' + escape(guidance) + '</p><p>Choose INNER JOIN or LEFT JOIN according to whether unmatched records should be excluded or retained. The schema does not decide this reporting rule.</p>';
  };
  const map = joins.map(join => '<li data-left="' + join.left.anchor + '" data-right="' + join.right.anchor + '" data-left-end="' + join.first + '" data-right-end="' + join.second + '">' + joinBody(join) + '</li>');
  for (const source of sources) {
    for (const dependency of source.view?.dependencies ?? []) {
      const target = sourcesByName.get(dependency);
      if (target) map.push('<li data-left="' + source.anchor + '" data-right="' + target.anchor +
        '" data-dependency>' + link(source) + ' depends on ' + link(target) + '</li>');
    }
  }

  const dictionary = sources.map(source => {
    const { table, view } = source;
    const primaryFields = table?.indexes?.find(index => index.pk)?.columns?.map(column => column.value ?? column.name);
    const sourceJoins = joins.filter(join => join.left === source || join.right === source);
    const columns = table?.fields.map(field => {
      const isPrimary = field.pk || primaryFields?.includes(field.name);
      const constraints = [isPrimary && "Primary key", field.unique && "Unique", field.increment && "Auto-increment", (field.not_null || isPrimary) ? "Not nullable" : "Nullable"].filter(Boolean);
      const details = options.includeNotes ? [field.description, noteText(field.note)].filter(Boolean).join(" · ") : "";
      const related = sourceJoins.flatMap(join => {
        const pairs = [];
        if (join.left === source && join.firstFields.includes(field.name)) pairs.push({ target: join.right, column: join.secondFields[join.firstFields.indexOf(field.name)], foreign: join.first === "*" && join.second === "1" });
        if (join.right === source && join.secondFields.includes(field.name)) pairs.push({ target: join.left, column: join.firstFields[join.secondFields.indexOf(field.name)], foreign: join.second === "*" && join.first === "1" });
        return pairs;
      });
      const enumItem = parsed.enums.find(item =>
        field.type.type_name === reportingName(item.schema?.name, item.name) ||
        (field.type.type_name === item.name && (item.schema?.name ?? "public") === (table?.schema?.name ?? "public")));
      const defaultValue = field.defaultExpression ?? field.dbdefault?.value;
      const extra = (defaultValue !== undefined ? '<div>Default: <code>' + escape(String(defaultValue)) + '</code></div>' : '') +
        (field.computedExpression ? '<div>Computed: <code>' + escape(field.computedExpression) + '</code></div>' : '') +
        (enumItem ? '<div>Allowed values: ' + enumItem.values.map(value => '<code>' + escape(value.name) + '</code>').join(', ') + '</div>' : '') +
        related.map(item => '<div>' + (item.foreign ? 'Foreign key → ' : 'Related column → ') + '<a href="#' + item.target.anchor + '">' + escape(item.target.name + '.' + item.column) + '</a></div>').join('');
      return '<tr><td><span data-searchable>' + escape(field.name) + '</span> ' + copyButton(source.name + '.' + field.name, "Copy qualified column name") + '</td><td data-searchable>' + escape(field.type.type_name) + '</td><td data-searchable>' + escape(constraints.join(", ")) + extra + '</td><td data-searchable>' + escape(details) + '</td></tr>';
    }).join("");
    const indexes = table?.sqlServerIndexes?.map(index =>
      '<li>' + escape(index.name + " (" + index.columns.join(", ") + ")") +
      (index.unique ? ' · Unique' : '') + '</li>').join("");

    return '<article id="' + source.anchor + '" data-source class="card" tabindex="-1">' +
      '<header class="source-heading"><span class="badge">' + source.kind + '</span><h3>' + escape(source.name) + '</h3>' + copyButton(source.name, 'Copy qualified source name') + '<a class="utility" href="#' + source.anchor + '">Permalink</a></header>' +
      (selected[source.key]?.trim() ? prose("Row meaning", selected[source.key]) : '<p class="context-gap">Row meaning has not been documented. Confirm what makes one record distinct before aggregating.</p>') +
      (options.includeNotes ? prose("Imported description", table?.description ?? view?.description) +
        prose("Authored notes", noteText(table?.note)) : "") +
      (primaryFields?.length ? '<p>Primary key <code>' + escape(primaryFields.join(", ")) + '</code></p>' : '') +
      (columns ? '<div class="table-wrap"><table><thead><tr><th>Column</th><th>Type</th><th>Constraints</th><th>Description</th></tr></thead><tbody>' +
        columns + '</tbody></table></div>' : '') +
      (indexes ? '<h4>Indexes and unique constraints</h4><ul>' + indexes + '</ul>' : '') +
      (options.includeSql && view?.definition ? '<h4>View SQL</h4><pre>' + escape(view.definition) + '</pre>' : '') +
      '<section class="source-relationships"><h4>Relationships for this source</h4>' +
      (sourceJoins.length ? '<ul class="map">' + sourceJoins.map(join => '<li>' + joinBody(join) + '</li>').join('') + '</ul>' : '<p class="muted">No declared joins to other included sources.</p>') +
      (view?.dependencies?.some(name => sourcesByName.has(name)) ? '<p>Declared dependencies: ' + view.dependencies.filter(name => sourcesByName.has(name)).map(name => link(sourcesByName.get(name)!)).join(', ') + '</p>' : '') + '</section></article>';
  }).join("");
  const groups = new Map<string | undefined, typeof sources>();
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

  const title = escape(brief.title.trim() || "Reporting handoff");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>${title}</title>
<style>
:root{font:15px/1.55 Inter,system-ui,sans-serif;color-scheme:light;--page:#fff;--surface:#fff;--sidebar:#f9fafb;--subtle:#f3f4f6;--ink:#111827;--muted:#5d6471;--line:#e5e7eb;--primary:#6366f1;--accent:#4338ca;--selection:#eef2ff;--canvas:#f4f5f7;--dots:#c9cdd6;--edge:#9599b5;--shadow:0 1px 2px #1118270c;--mono:"Geist Mono",ui-monospace,Consolas,monospace}
@media(prefers-color-scheme:dark){:root{color-scheme:dark;--page:#1a1b26;--surface:#1e1f2e;--sidebar:#1e1f2e;--subtle:#22243a;--ink:#e1e3f0;--muted:#aeb2cb;--line:#35374d;--primary:#818cf8;--accent:#b1b9ff;--selection:#2b2e50;--canvas:#181925;--dots:#34364b;--edge:#747a9a;--shadow:0 1px 2px #0005}}
*,*::before,*::after{box-sizing:border-box}[hidden]{display:none!important}
body{margin:0;background:var(--page);color:var(--ink)}
main,.masthead-inner{width:min(100%,86rem);margin:auto;padding-inline:clamp(1rem,3vw,2.5rem)}
h1,h2,h3,h4{line-height:1.25;margin:0 0 .65rem;overflow-wrap:anywhere;letter-spacing:-.02em}h1{font-size:clamp(1.45rem,3vw,2.15rem);margin:0}h2{font-size:1.25rem}h3{font-size:1rem}p{margin:.4rem 0 1rem}
a{color:var(--accent);text-underline-offset:.2em}button,input{font:inherit}:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
.masthead{background:var(--sidebar);border-bottom:1px solid var(--line)}
.hero{padding-block:1.25rem .95rem}.hero p,.muted,small{color:var(--muted)}.hero p{margin:0 0 .22rem;font-size:.82rem;font-weight:600}
.card{border:1px solid var(--line);border-radius:.65rem;background:var(--surface);padding:clamp(1rem,2vw,1.35rem);box-shadow:var(--shadow)}
.tabs{display:flex;gap:.55rem;overflow-x:auto;padding-inline:.2rem}
.tabs button{flex:none;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--muted);padding:.65rem .7rem;cursor:pointer;font-size:.9rem;font-weight:550}
.tabs button:hover{background:var(--subtle);color:var(--ink)}.tabs button:focus-visible{outline-offset:-2px}
.tabs [aria-selected=true]{border-color:var(--primary);color:var(--accent);font-weight:700}
.panel{margin-block:1.25rem 2rem}.stack{display:grid;gap:1rem}.badge{display:inline-block;background:var(--selection);color:var(--accent);font-size:.76rem;font-weight:650;border-radius:.3rem;padding:.12rem .45rem}
.section-heading{display:flex;align-items:baseline;justify-content:space-between;gap:.65rem;flex-wrap:wrap}
.section-heading h2{margin:0}.section-heading p{margin:0;color:var(--muted);font-size:.85rem}
.map,.source-list{list-style:none;margin:0;padding:0}.map{display:grid;gap:.55rem}
.map li{border:1px solid var(--line);border-radius:.5rem;padding:.75rem .9rem;background:var(--surface)}.map li p{margin:.4rem 0 0;color:var(--muted);font-size:.85rem}
.join-heading{display:flex;align-items:center;gap:.55rem;flex-wrap:wrap}.join-heading a{font-weight:600}.constraint-name{display:block;margin-top:.3rem}
.map li code{background:var(--subtle);padding:.45rem .6rem;border-radius:.3rem}.join-guide{margin:.65rem 0;color:var(--muted);font-size:.86rem}
.graph-tools{display:flex;flex-wrap:wrap;gap:.75rem;margin-block:1rem}.graph-tools label{display:grid;gap:.25rem;min-width:0}
.graph-tools label{font-size:.82rem;font-weight:650}.graph-tools select{font:inherit;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:.4rem;padding:.45rem;min-width:min(34vw,10rem);max-width:min(68vw,30rem)}
.graph-scroll{overflow:auto;border:1px solid var(--line);border-radius:.55rem;background:radial-gradient(circle,var(--dots) .8px,transparent 1px) 0 0/16px 16px var(--canvas);margin:.8rem 0 1.2rem;max-height:55vh}
.graph{display:grid;grid-template-columns:minmax(10rem,1fr) minmax(17rem,2fr);align-items:stretch;min-width:31rem;padding:1.15rem}
.graph-center{display:flex;align-items:center;border-right:2px solid var(--edge);position:relative;padding-right:1rem}
.graph-center::after{content:"";position:absolute;right:0;top:50%;width:1rem;border-top:2px solid var(--edge)}
.graph-neighbor{display:grid;grid-template-columns:minmax(7rem,.7fr) minmax(10rem,1.3fr);align-items:center;padding:.25rem 0}
.graph-edge{display:flex;align-items:center;justify-content:center;color:var(--muted);text-align:center;font-size:.84rem}
.graph-edge::before,.graph-edge::after{content:"";flex:1;min-width:.35rem;border-top:2px solid var(--edge)}
.graph-edge span{padding:.12rem .45rem;border:1px solid var(--line);border-radius:1rem;background:var(--surface);font-size:.74rem;font-weight:600}
.graph-node{display:grid;min-width:0;width:100%;overflow-wrap:anywhere;padding:.42rem .65rem;border:1px solid var(--line);border-radius:.4rem;background:var(--surface);color:var(--ink);text-align:left;text-decoration:none;box-shadow:var(--shadow)}
.node-schema{font-size:.72rem;color:var(--muted);line-height:1.25}.node-name{font:600 .84rem/1.4 var(--mono)}
.graph-center .graph-node{background:var(--selection);border-color:var(--primary);color:var(--accent)}.graph-node:hover{border-color:var(--primary)}
.dictionary{display:grid;grid-template-columns:minmax(12rem,19rem) minmax(0,1fr);gap:1rem;align-items:start}
.source-list{max-height:50vh;overflow:auto;padding:.2rem}.source-list a{display:block;padding:.48rem .55rem;border-radius:.35rem;overflow-wrap:anywhere}
.source-group{border-bottom:1px solid var(--line)}.source-group summary{cursor:pointer;font-weight:650;padding:.48rem .55rem;overflow-wrap:anywhere}
.source-group ul{list-style:none;margin:0;padding:0 0 .4rem 1rem}
.source-list [aria-current=true]{background:var(--subtle);font-weight:650}
.source-heading{display:flex;align-items:baseline;flex-wrap:wrap;gap:.55rem;margin-bottom:1rem}.source-heading h3{margin:0}
.prose,td{white-space:pre-wrap;overflow-wrap:anywhere}code,pre{overflow-wrap:anywhere}li code{display:block;margin-top:.35rem}
code,pre{font-family:var(--mono)}pre{background:var(--subtle);padding:.8rem;border-radius:.4rem}pre,.table-wrap{overflow:auto}.table-wrap{margin-block:1rem}
table{border-collapse:collapse;width:100%;text-align:left;font-size:.93rem}th{background:var(--subtle)}th,td{padding:.65rem;border-bottom:1px solid var(--line);vertical-align:top}tbody tr:nth-child(even){background:var(--page)}
input{width:100%;padding:.55rem;border:1px solid var(--line);border-radius:.4rem;background:var(--surface);color:var(--ink)}
@media(max-width:42rem){.dictionary{grid-template-columns:1fr}.source-list{max-height:26vh}}
/* Shared editor identity: compact controls, quiet surfaces, rounded panels. */
body{background:var(--canvas);font-size:13px}
.masthead{position:sticky;top:0;z-index:10;background:var(--surface);box-shadow:var(--shadow)}
.hero{padding-block:1rem}.hero p{font-size:11px;letter-spacing:.04em}h1{font-size:clamp(1.25rem,2.5vw,1.75rem);font-weight:600}h2{font-size:15px;font-weight:600}h3{font-size:13px}
.tabs{gap:3px;padding:3px;margin-bottom:12px;width:fit-content;max-width:100%;border:1px solid var(--line);border-radius:9px;background:var(--subtle)}
.tabs button{border:0;border-radius:6px;padding:6px 12px;font-size:12px}.tabs [aria-selected=true]{background:var(--surface);color:var(--ink);box-shadow:var(--shadow);font-weight:600}
.card{border-radius:10px}.panel{margin-block:1.5rem 3rem}.stack{gap:16px}.prose{max-width:80ch;line-height:1.7}
.report-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.report-summary>div{display:flex;flex-direction:column;gap:6px;padding:16px;border:1px solid var(--line);border-radius:10px;background:var(--surface);box-shadow:var(--shadow)}.report-summary span{font-size:12px;color:var(--muted)}.report-summary strong{font-size:24px;font-weight:600;font-variant-numeric:tabular-nums}
.starting-source{padding:12px;border:1px solid var(--line);border-radius:8px;background:var(--selection)}
.dictionary>nav{position:sticky;top:145px}.source-list a{text-decoration:none;color:var(--muted);font-size:12px}.source-list a:hover{background:var(--subtle);color:var(--ink)}.source-list [aria-current=true]{background:var(--selection);color:var(--accent);box-shadow:inset 2px 0 var(--primary)}
.source-heading{padding-bottom:14px;border-bottom:1px solid var(--line)}.source-heading h3{font-size:17px;font-weight:600}.badge{border-radius:6px;font-weight:500}
.table-wrap{border:1px solid var(--line);border-radius:8px}table{min-width:440px;font-size:12px}th{font-size:11px;font-weight:500;color:var(--muted)}tbody tr:last-child td{border-bottom:0}tbody tr:hover{background:var(--subtle)}
input,.graph-tools select{border-radius:8px;font-size:12px}label{font-size:12px;font-weight:500}.node-name{font-family:inherit}.graph-node{border-radius:8px}
@media(max-width:42rem){.masthead{position:static}.dictionary>nav{position:static}.report-summary{gap:6px}.report-summary>div{padding:10px}.report-summary strong{font-size:20px}}
@media print{.masthead{position:static}.tabs,.graph-tools,.dictionary>nav,#relationship-graph,#results,#empty-results{display:none!important}.panel[hidden],article[data-source][hidden],.map li[hidden]{display:block!important}.dictionary{display:block}.card{box-shadow:none;break-inside:avoid;margin-bottom:12px}.report-summary{break-inside:avoid}body{background:white;color:black}.table-wrap,pre{overflow:visible}table{min-width:0}main,.masthead-inner{padding:0}.panel{margin:16px 0}}

:root[data-theme="light"]{color-scheme:light;--page:#fff;--surface:#fff;--sidebar:#f9fafb;--subtle:#f3f4f6;--ink:#111827;--muted:#5d6471;--line:#e5e7eb;--primary:#6366f1;--accent:#4338ca;--selection:#eef2ff;--canvas:#f4f5f7;--dots:#c9cdd6;--edge:#9599b5;--shadow:0 1px 2px #1118270c;--mono:"Geist Mono",ui-monospace,Consolas,monospace}
:root[data-theme="dark"]{color-scheme:dark;--page:#1a1b26;--surface:#1e1f2e;--sidebar:#1e1f2e;--subtle:#22243a;--ink:#e1e3f0;--muted:#aeb2cb;--line:#35374d;--primary:#818cf8;--accent:#b1b9ff;--selection:#2b2e50;--canvas:#181925;--dots:#34364b;--edge:#747a9a;--shadow:0 1px 2px #0005}
.export-tools{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:12px}.utility,.export-tools select{border:1px solid var(--line);border-radius:7px;padding:4px 8px;background:var(--surface);color:var(--ink);font:inherit;font-size:11px;cursor:pointer;text-decoration:none}.utility:hover{background:var(--selection)}.export-tools label{display:flex;gap:6px;align-items:center}#copy-status:empty{display:none}#copy-status{margin:8px 0 0}.context-gap{border-left:2px solid var(--primary);padding:10px;background:var(--subtle);color:var(--muted)}.source-relationships{margin-top:20px}.guidance{color:var(--ink)!important}#search-matches{max-height:35vh;overflow:auto}#search-matches a{display:grid;gap:4px;padding:8px;border-bottom:1px solid var(--line);text-decoration:none;overflow-wrap:anywhere}mark{background:#fde68a;color:#422006;border-radius:2px}.dictionary>nav{top:205px}article{scroll-margin-top:210px}
@media print{:root,:root[data-theme]{color-scheme:light;--page:white;--canvas:white;--sidebar:white;--surface:white;--subtle:#f3f4f6;--ink:#111827;--muted:#4b5563;--line:#d1d5db;--accent:#3730a3;--selection:#eef2ff;--shadow:none}.export-tools,.utility,#copy-status,#search-matches{display:none!important}.card{break-inside:auto}article[data-source]{break-before:page}h2,h3,h4,.source-heading{break-after:avoid}thead{display:table-header-group}tr,.map li{break-inside:avoid}.table-wrap{overflow:visible}pre{white-space:pre-wrap}mark{background:transparent;color:inherit}@page{margin:16mm}}

.graph-scroll{height:52vh;max-height:650px;cursor:grab;touch-action:pan-x pan-y}.graph{width:max-content;min-width:100%;grid-template-columns:240px minmax(380px,1fr)}.graph-neighbor{grid-template-columns:150px minmax(230px,1fr);gap:12px}.node-focus{border:0;background:none;color:inherit;text-align:left;display:grid;padding:4px 0;cursor:pointer;width:100%}.graph-node{gap:8px}.graph-node>a{width:fit-content}.expanded-branch{margin:12px 0 12px 12px;padding-left:12px;border-left:2px solid var(--edge)}.graph-edge{white-space:normal;font-size:11px;cursor:pointer}.graph-edge::before,.graph-edge::after{display:none}.graph-node:has([aria-current=true]){border-color:var(--primary);background:var(--selection)}#graph-search-results{display:flex;gap:6px;flex-wrap:wrap}#graph-focus{font-weight:600}.graph-tools{align-items:end}.all-joins{display:flex;gap:8px;align-items:center;margin:12px 0}.all-joins input{width:auto}#join-details>summary{font-weight:600;cursor:pointer}#join-details{margin-top:16px}#join-details>.map{max-height:55vh;overflow:auto}.graph-tools output{align-self:center}
@media print{#join-details{display:block}#join-details>.map{max-height:none;overflow:visible}#join-details::details-content{display:block}.all-joins,#graph-detail-label{display:none!important}}

@media(min-width:1100px){#relationships{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(300px,1fr);gap:16px}#relationships>p,#relationships>.section-heading{grid-column:1/-1}#join-details{margin-top:0;min-width:0;border-left:1px solid var(--line);padding-left:16px}#join-details>.map{max-height:68vh}}@media print{#relationships{display:block}#join-details{border:0;padding:0}}
.panel,#graph-detail-label{scroll-margin-top:220px}@media(max-width:42rem){.panel,#graph-detail-label{scroll-margin-top:16px}}
</style></head>
<body><header class="masthead"><div class="masthead-inner"><div class="hero"><p>DBLuna Reporting Handoff · ${sources.length} ${sources.length === 1 ? "source" : "sources"}</p><h1>${title}</h1><div class="export-tools" hidden><label>Appearance <select id="theme"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label><button type="button" class="utility" id="print">Print / Save PDF</button><button type="button" class="utility" id="copy-link">Copy section link</button></div><p id="copy-status" role="status" aria-live="polite"></p></div>
<nav class="tabs" role="tablist" aria-label="Reporting handoff" hidden>
<button type="button" role="tab" id="tab-overview" aria-controls="overview" aria-selected="true">Overview</button>
<button type="button" role="tab" id="tab-relationships" aria-controls="relationships" aria-selected="false" tabindex="-1">Relationships</button>
<button type="button" role="tab" id="tab-dictionary" aria-controls="dictionary" aria-selected="false" tabindex="-1">Data dictionary</button>
</nav></div></header>
<main>
<section class="panel stack" id="overview" role="tabpanel" aria-labelledby="tab-overview" tabindex="0">
<div class="report-summary" aria-label="Handoff summary"><div><span>Sources</span><strong>${sources.length}</strong></div><div><span>Declared connections</span><strong>${map.length}</strong></div><div><span>Rows described</span><strong>${sources.filter(source => selected[source.key]?.trim()).length} / ${sources.length}</strong></div></div>
<div class="card"><h2>Start here</h2>${prose("Report question", brief.question)}${prose("Intended audience", brief.audience)}${prose("Expected output", brief.output)}
${primary ? '<p class="starting-source">Start with ' + link(primary) + '.</p>' : '<p class="muted">Use the data dictionary to explore the selected sources.</p>'}</div>
${brief.rules.trim() || brief.reconciliation.trim() ? '<div class="card"><h2>Reporting rules and reconciliation</h2>' + prose("Business rules", brief.rules) + prose("Validation example", brief.reconciliation) + '</div>' : ''}
<div class="card"><h2>Context to confirm</h2><p class="muted">These are documentation gaps, not schema errors.</p><ul>
${!primary ? '<li>No recommended starting source.</li>' : ''}
${!brief.reconciliation.trim() ? '<li>No validation example. Agree on a known result before signing off the report.</li>' : ''}
${!brief.rules.trim() ? '<li>No reporting rules supplied. Confirm filters, dates, and metric definitions.</li>' : ''}
${sources.filter(source => !selected[source.key]?.trim()).length ? '<li>' + sources.filter(source => !selected[source.key]?.trim()).length + ' sources have no row description. Review their grain in the data dictionary.</li>' : ''}
${primary && brief.reconciliation.trim() && brief.rules.trim() && sources.every(source => selected[source.key]?.trim()) ? '<li>The starting source, row descriptions, rules, and validation example are documented.</li>' : ''}
</ul></div>
<div class="card"><h2>Export snapshot</h2>${prose("Project / diagram", brief.projectName || parsed.project?.name || "Not specified")}${prose("Owner", brief.owner)}${prose("Version", brief.version)}<p>Exported <time datetime="${escape(exportedAt)}">${escape(exportedAt)}</time></p><p class="muted">This is a static schema snapshot, not live data. Share the HTML file alongside its links.</p></div>
</section>
<section class="panel card" id="relationships" role="tabpanel" aria-labelledby="tab-relationships" tabindex="0">
<p class="muted">Relationships below are declared in the schema. Guidance describes reporting considerations; no suggested joins are inferred.</p><div class="section-heading"><h2>Relationship map</h2><p id="graph-summary" aria-live="polite"></p></div>
<div id="relationship-graph" hidden>
<div class="graph-tools"><button class="utility" id="graph-back" type="button">Back</button><button class="utility" id="graph-forward" type="button">Forward</button><button class="utility" id="graph-home" type="button">Starting source</button><label>Find a source<input id="graph-search" type="search" placeholder="Search all sources"></label><label>Schema<select id="graph-schema"></select></label><label>Focus source<select id="graph-source"></select></label></div>
<div id="graph-search-results" aria-label="Relationship search results"></div><p id="graph-focus" role="status"></p><div class="graph-tools"><button class="utility" type="button" id="zoom-out" aria-label="Zoom out">−</button><output id="graph-zoom">100%</output><button class="utility" type="button" id="zoom-in" aria-label="Zoom in">+</button><button class="utility" type="button" id="graph-fit">Fit tree</button><button class="utility" type="button" id="graph-reset">Reset view</button><span class="muted">Click a source to focus · click a connection for details · drag the background to pan</span></div><p id="graph-limit" role="status" hidden>Showing the first 200 branches. Focus a source to explore its connections.</p><p id="graph-empty" role="status" hidden>No declared relationships to other selected sources.</p>
<div id="graph-scroll" class="graph-scroll" tabindex="0" aria-label="Relationship graph"><div class="graph">
<div class="graph-center" id="graph-center"></div><div id="graph-neighbors"></div></div></div>
</div><details id="join-details" open><summary>Join and dependency details</summary><p id="graph-detail-label" role="status"></p><label class="all-joins"><input id="graph-all" type="checkbox"> Show all declared relationships</label><p class="join-guide" id="join-guide">Check for duplicated rows before aggregating across a one-to-many or many-to-many join.</p>
${map.length ? '<ul class="map" tabindex="0" aria-label="Declared joins and dependencies">' + map.join("") + '</ul>' : '<noscript><p>No declared joins or dependencies among the selected sources.</p></noscript>'}
</details></section>
<section class="panel" id="dictionary" role="tabpanel" aria-labelledby="tab-dictionary" tabindex="0">
<h2>Data dictionary</h2><div class="dictionary">
<nav class="card" aria-label="Dictionary sources">
<label for="search">Search sources</label><input id="search" type="search" placeholder="Search by source, column, or description">
<p id="results" class="muted" role="status"></p><div id="search-matches" aria-label="Search matches"></div>
<div class="source-list">${sourceList}</div></nav>
<div>${dictionary}<p id="empty-results" class="card" hidden>No sources match your search.</p></div></div>
</section></main>
<script>
const search = document.getElementById("search");
const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
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
        toggle.setAttribute("aria-expanded", String(expanded.has(other))); branch.append(toggle);
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
function openTab(id) {
  for (const tab of tabs) {
    const selected = tab.getAttribute("aria-controls") === id;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    document.getElementById(tab.getAttribute("aria-controls")).hidden = !selected;
  }
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
  else openTab(["overview", "relationships", "dictionary"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "overview");
}
filterSources();
for (const group of groups) group.open = group === current?.group;
restoreLocation();
document.querySelector('[role="tablist"]').hidden = false;
window.addEventListener("hashchange", restoreLocation);
window.addEventListener("popstate", restoreLocation);
function saveHash(hash) { if (window.parent === window && location.hash !== hash) { try { history.pushState(null, "", hash); } catch { location.hash = hash; } } }
async function copyText(value) {
  const status = document.getElementById("copy-status");
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
</script></body></html>`;
}
