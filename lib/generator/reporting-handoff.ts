import { qualifySqlServerTable } from "@/lib/schema-namespace";
import type { ParsedDbmlResult, ParsedTable } from "@/lib/parser/dsl-parser";

export interface ReportingBrief {
  title: string;
  question: string;
  rules: string;
  reconciliation: string;
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
  options: { includeNotes: boolean; includeSql: boolean },
) {
  const sources = reportingSources(parsed).filter(source => Object.hasOwn(selected, source.key))
    .map((source, index) => ({ ...source, anchor: "source-" + (index + 1) }));
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
    return [{ left, right, conditions, cardinality, name: ref.name, first: first.relation, second: second.relation }];
  });
  const map = joins.map(({ left, right, conditions, cardinality, name, first, second }) =>
    '<li data-left="' + left.anchor + '" data-right="' + right.anchor + '" data-left-end="' + first +
    '" data-right-end="' + second + '"><div class="join-heading">' + link(left) +
    '<span class="badge">' + cardinality + '</span>' + link(right) + '</div>' +
    (name ? '<small class="constraint-name">' + escape(name) + '</small>' : '') +
    '<code>' + escape(conditions.join(" AND ")) + '</code>' +
    (conditions.length > 1 ? '<p>Composite join. Match every column pair.</p>' : '') + '</li>',
  );
  for (const source of sources) {
    for (const dependency of source.view?.dependencies ?? []) {
      const target = sourcesByName.get(dependency);
      if (target) map.push('<li data-left="' + source.anchor + '" data-right="' + target.anchor +
        '" data-dependency>' + link(source) + ' depends on ' + link(target) + '</li>');
    }
  }

  const dictionary = sources.map(source => {
    const { table, view } = source;
    const columns = table?.fields.map(field => {
      const constraints = [field.pk && "Primary key", field.unique && "Unique", field.not_null && "Required"].filter(Boolean);
      const details = options.includeNotes
        ? [field.description, noteText(field.note)].filter(Boolean).join(" · ") : "";
      return '<tr>' + [field.name, field.type.type_name, constraints.join(", "), details]
        .map(value => '<td>' + escape(value) + '</td>').join("") + '</tr>';
    }).join("");
    const indexes = table?.sqlServerIndexes?.map(index =>
      '<li>' + escape(index.name + " (" + index.columns.join(", ") + ")") +
      (index.unique ? ' · Unique' : '') + '</li>').join("");
    const primaryFields = table?.indexes?.find(index => index.pk)?.columns?.map(column => column.value ?? column.name);
    return '<article id="' + source.anchor + '" data-source class="card" tabindex="-1">' +
      '<header class="source-heading"><span class="badge">' + source.kind + '</span><h3>' + escape(source.name) + '</h3></header>' +
      prose("What one row represents", selected[source.key]) +
      (options.includeNotes ? prose("Imported description", table?.description ?? view?.description) +
        prose("Authored notes", noteText(table?.note)) : "") +
      (primaryFields?.length ? '<p>Primary key <code>' + escape(primaryFields.join(", ")) + '</code></p>' : '') +
      (columns ? '<div class="table-wrap"><table><thead><tr><th>Column</th><th>Type</th><th>Constraints</th><th>Description</th></tr></thead><tbody>' +
        columns + '</tbody></table></div>' : '') +
      (indexes ? '<h4>Indexes and unique constraints</h4><ul>' + indexes + '</ul>' : '') +
      (options.includeSql && view?.definition ? '<h4>View SQL</h4><pre>' + escape(view.definition) + '</pre>' : '') +
      '</article>';
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
</style></head>
<body><header class="masthead"><div class="masthead-inner"><div class="hero"><p>DBLuna Reporting Handoff · ${sources.length} ${sources.length === 1 ? "source" : "sources"}</p><h1>${title}</h1></div>
<nav class="tabs" role="tablist" aria-label="Reporting handoff" hidden>
<button type="button" role="tab" id="tab-overview" aria-controls="overview" aria-selected="true">Overview</button>
<button type="button" role="tab" id="tab-relationships" aria-controls="relationships" aria-selected="false" tabindex="-1">Relationships</button>
<button type="button" role="tab" id="tab-dictionary" aria-controls="dictionary" aria-selected="false" tabindex="-1">Data dictionary</button>
</nav></div></header>
<main>
<section class="panel stack" id="overview" role="tabpanel" aria-labelledby="tab-overview" tabindex="0">
<div class="card"><h2>Start here</h2>${prose("Report question", brief.question)}
${primary ? '<p>Start with ' + link(primary) + '.</p>' : ''}</div>
${brief.rules.trim() || brief.reconciliation.trim() ? '<div class="card"><h2>Reporting rules and reconciliation</h2>' + prose("Business rules", brief.rules) + prose("Validation example", brief.reconciliation) + '</div>' : ''}
</section>
<section class="panel card" id="relationships" role="tabpanel" aria-labelledby="tab-relationships" tabindex="0">
<div class="section-heading"><h2>Relationship map</h2><p id="graph-summary" aria-live="polite"></p></div>
<div id="relationship-graph" hidden>
<div class="graph-tools"><label>Schema<select id="graph-schema"></select></label><label>Focus source<select id="graph-source"></select></label></div>
<p id="graph-empty" role="status" hidden>No declared relationships to other selected sources.</p>
<div id="graph-scroll" class="graph-scroll" tabindex="0" aria-label="Relationship graph"><div class="graph">
<div class="graph-center" id="graph-center"></div><div id="graph-neighbors"></div></div></div>
<div id="join-details"><h3>Join and dependency details</h3><p class="join-guide" id="join-guide">Check for duplicated rows before aggregating across a one-to-many or many-to-many join.</p></div>
</div>
${map.length ? '<ul class="map" tabindex="0" aria-label="Declared joins and dependencies">' + map.join("") + '</ul>' : '<noscript><p>No declared joins or dependencies among the selected sources.</p></noscript>'}
</section>
<section class="panel" id="dictionary" role="tabpanel" aria-labelledby="tab-dictionary" tabindex="0">
<h2>Data dictionary</h2><div class="dictionary">
<nav class="card" aria-label="Dictionary sources">
<label for="search">Search sources</label><input id="search" type="search" placeholder="Table, column, or description">
<p id="results" class="muted" role="status"></p>
<div class="source-list">${sourceList}</div></nav>
<div>${dictionary}<p id="empty-results" class="card" hidden>No sources match your search.</p></div></div>
</section></main>
<script>
const search = document.getElementById("search");
const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
const sources = Array.from(document.querySelectorAll(".source-list a"), link => {
  const article = document.getElementById(link.getAttribute("href").slice(1));
  const label = link.getAttribute("aria-label");
  return { link, article, group: link.closest("details"), label, name: label.toLowerCase(), text: article.textContent.toLowerCase() };
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
const edges = Array.from(document.querySelectorAll(".map li[data-left]"));
const adjacency = new Map(sources.map(source => [source.article.id, []]));
for (const edge of edges) {
  const { left, right } = edge.dataset;
  adjacency.get(left).push(edge);
  if (left !== right) adjacency.get(right).push(edge);
}
function graphNode(id) {
  const node = document.createElement("a");
  const source = byId.get(id);
  node.className = "graph-node";
  node.href = "#" + id;
  const schema = document.createElement("span");
  schema.className = "node-schema";
  const name = document.createElement("span");
  name.className = "node-name";
  const kind = source.article.querySelector(".badge")?.textContent;
  schema.textContent = source.group.querySelector("summary").textContent + (kind === "View" ? " · View" : "");
  name.textContent = source.link.textContent;
  node.setAttribute("aria-label", source.label);
  node.append(schema, name);
  return node;
}
function drawGraph() {
  const id = sourceSelect.value;
  const connected = adjacency.get(id) ?? [];
  const neighbors = new Map();
  for (const edge of edges) edge.hidden = true;
  for (const edge of connected) {
    const { left, right, leftEnd, rightEnd } = edge.dataset;
    const forward = left === id;
    const other = forward ? right : left;
    const end = value => value === "1" ? "one" : "many";
    const label = edge.hasAttribute("data-dependency")
      ? (forward ? "Depends on →" : "← Depends on")
      : end(forward ? leftEnd : rightEnd) + " to " + end(forward ? rightEnd : leftEnd);
    if (!neighbors.has(other)) neighbors.set(other, new Map());
    const labels = neighbors.get(other);
    labels.set(label, (labels.get(label) ?? 0) + 1);
    edge.hidden = false;
  }
  graphCenter.replaceChildren(...(id ? [graphNode(id)] : []));
  graphNeighbors.replaceChildren();
  for (const [other, labels] of neighbors) {
    const branch = document.createElement("div");
    branch.className = "graph-neighbor";
    const connection = document.createElement("span");
    connection.className = "graph-edge";
    const caption = document.createElement("span");
    caption.textContent = (other === id ? "Self join · " : "") +
      Array.from(labels, ([label, count]) => label + (count > 1 ? " (" + count + ")" : "")).join(" · ");
    connection.append(caption);
    branch.append(connection, graphNode(other));
    graphNeighbors.append(branch);
  }
  graphScroll.hidden = !neighbors.size;
  document.getElementById("graph-empty").hidden = Boolean(neighbors.size);
  document.getElementById("join-details").hidden = !neighbors.size;
  document.getElementById("graph-summary").textContent = neighbors.size + (neighbors.size === 1 ? " connected source" : " connected sources");
  document.getElementById("join-guide").hidden = !connected.some(edge =>
    edge.dataset.leftEnd === "*" || edge.dataset.rightEnd === "*");
}
function selectGraphSchema(preferred) {
  const selectedGroup = groups[Number(schemaSelect.value)];
  const available = sources.filter(source => source.group === selectedGroup);
  sourceSelect.replaceChildren(...available.map(source => new Option(source.label, source.article.id)));
  const initial = available.find(source => source.article.id === preferred) ??
    available.find(source => adjacency.get(source.article.id).length) ?? available[0];
  if (initial) sourceSelect.value = initial.article.id;
  drawGraph();
}
if (sources.length) {
  schemaSelect.replaceChildren(...groups.map((group, index) => new Option(group.querySelector("summary").textContent, String(index))));
  const preferred = byId.get("${primary?.anchor ?? ""}") ?? sources.find(source => adjacency.get(source.article.id).length) ?? sources[0];
  schemaSelect.value = String(groups.indexOf(preferred.group));
  schemaSelect.addEventListener("change", () => selectGraphSchema());
  sourceSelect.addEventListener("change", drawGraph);
  selectGraphSchema(preferred.article.id);
  graph.hidden = false;
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
function filterSources(preferred = current) {
  const query = search.value.trim().toLowerCase();
  if (query && !savedGroupState) savedGroupState = new Map(groups.map(group => [group, group.open]));
  if (!query && savedGroupState) {
    for (const [group, open] of savedGroupState) group.open = open;
    savedGroupState = null;
  }
  const matchingGroups = new Set();
  const matches = sources.filter(source => {
    const visible = source.text.includes(query);
    source.link.parentElement.hidden = !visible;
    if (visible) matchingGroups.add(source.group);
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
  tab.addEventListener("click", () => openTab(tab.getAttribute("aria-controls")));
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
  openSource(byId.get(hash.slice(1)), true);
  if (window.parent === window && location.hash !== hash) history.pushState(null, "", hash);
});
function restoreLocation() {
  const source = byId.get(location.hash.slice(1));
  if (source) openSource(source, false);
  else openTab("overview");
}
filterSources();
for (const group of groups) group.open = group === current?.group;
restoreLocation();
document.querySelector('[role="tablist"]').hidden = false;
window.addEventListener("hashchange", restoreLocation);
</script></body></html>`;
}
