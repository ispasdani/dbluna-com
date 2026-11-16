import { expect, it } from "vitest";
import { Script } from "node:vm";
import { parseDbml } from "@/lib/parser/dsl-parser";
import { emptyReportingBrief, generateReportingHandoff, reportingSources, type HandoffMapData } from "@/lib/generator/reporting-handoff";

it("exports only the chosen sources, preserving composite joins and escaping authored content", () => {
  const parsed = parseDbml(`
    Table sales.Orders {
      tenant int
      id int
      Indexes { (tenant, id) [pk] }
    }
    Table sales.Lines {
      tenant int
      order_id int
    }
    Table private.Customers {
      id int
    }
    Ref: sales.Lines.(tenant, order_id) > sales.Orders.(tenant, id)
    Ref: sales.Orders.id > private.Customers.id
  `)!;
  const sources = reportingSources(parsed);
  const lines = sources.find(source => source.name === "sales.Lines")!;
  const orders = sources.find(source => source.name === "sales.Orders")!;
  orders.table!.description = "Internal description";
  const html = generateReportingHandoff(parsed, {
    ...emptyReportingBrief, title: "Sales <img src=x onerror=alert(1)>", question: "Monthly totals",
  }, { [lines.key]: "One row per order line", [orders.key]: "" }, lines.key, { includeNotes: false, includeSql: false });

  expect(html).toContain("sales.Lines.tenant = sales.Orders.tenant AND sales.Lines.order_id = sales.Orders.id");
  expect(html).toContain("One row per order line");
  expect(html).toContain('id="graph-schema"');
  expect(html).toContain('id="graph-source"');
  expect(html).toMatch(/data-left="source-\d+" data-right="source-\d+" data-left-end="\*" data-right-end="1"/);
  expect(html).toContain("Start with <a");
  expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  expect(html).not.toContain("<img");
  expect(html).not.toContain("private.Customers");
  expect(html).not.toContain("Internal description");
  for (const panel of ["overview", "relationships", "dictionary"]) {
    expect(html).toContain('aria-controls="' + panel + '"');
    expect(html).toContain('id="' + panel + '" role="tabpanel"');
  }
  expect(html.match(/data-source class="card"/g)).toHaveLength(2);
  expect(html).toContain('<details class="source-group" open><summary>sales</summary>');
  expect(html).toMatch(/aria-label="sales\.Orders">Orders<\/a>/);
  expect(html).toMatch(/aria-label="sales\.Lines">Lines<\/a>/);
  const script = html.match(/<script>([\s\S]+)<\/script>/)?.[1];
  expect(script).toBeDefined();
  expect(() => new Script(script!)).not.toThrow();
});

it("includes selected view definitions and descriptions only when requested", () => {
  const parsed = parseDbml(`Project "Reporting" { database_type: 'SQL Server' }`)!;
  parsed.project = {
    name: "Reporting",
    sqlServerObjects: [{
      schema: "sales", name: "Summary", description: "Reviewed description",
      definition: "SELECT 1 WHERE 2 > 1", dependencies: ["private.Hidden"],
    }],
  };
  const [view] = reportingSources(parsed);
  const selected = { [view.key]: "One row per customer" };
  const minimal = generateReportingHandoff(parsed, emptyReportingBrief, selected, "", { includeNotes: false, includeSql: false });
  const detailed = generateReportingHandoff(parsed, emptyReportingBrief, selected, "", { includeNotes: true, includeSql: true });

  expect(minimal).not.toContain("SELECT 1");
  expect(minimal).not.toContain("Reviewed description");
  expect(detailed).toContain("SELECT 1 WHERE 2 &gt; 1");
  expect(detailed).toContain("Reviewed description");
  expect(detailed).not.toContain("private.Hidden");
});

it("documents column semantics, scoped relationships, context gaps, and export provenance", () => {
  const parsed = parseDbml(`
    Enum sales.State {
      open
      closed
    }
    Table sales.Parent {
      id int [pk]
    }
    Table sales.Child {
      id int [pk, increment]
      parent_id int [not null]
      state sales.State [default: 'open']
      score int [default: 0]
    }
    Ref: sales.Child.parent_id > sales.Parent.id
  `)!;
  const sources = reportingSources(parsed);
  const selected = Object.fromEntries(sources.map(source => [source.key, ""]));
  const html = generateReportingHandoff(parsed, {
    ...emptyReportingBrief, title: "Review", question: "Which records need review?",
    audience: "Operations <team>", output: "Weekly counts", owner: "Schema owner", version: "v2", projectName: "Action model",
  }, selected, "", { includeNotes: false, includeSql: false, exportedAt: "2026-11-15T12:00:00.000Z" });
  expect(html).toContain("Not nullable");
  expect(html).toContain("Nullable");
  expect(html).toContain("Auto-increment");
  expect(html).toContain("Default: <code>0</code>");
  expect(html).toContain("Allowed values: <code>open</code>, <code>closed</code>");
  expect(html).toContain('Foreign key → <a href="#source-1">sales.Parent.id</a>');
  expect(html).toContain("can repeat rows from the one side");
  expect(html).toContain("No validation example");
  expect(html).toContain("2 sources have no row description");
  expect(html).toContain("Operations &lt;team&gt;");
  expect(html).toContain("Action model");
  expect(html).toContain('datetime="2026-11-15T12:00:00.000Z"');
  expect(html).toContain('data-copy="sales.Child.parent_id"');
  expect(html).toContain('id="theme"');
  expect(html).toContain('id="search-matches"');
  expect(() => new Script(html.match(/<script>([\s\S]+)<\/script>/)![1])).not.toThrow();
});

it("opens on a Graph tab whose embedded data carries columns, keys, and cardinality", () => {
  const parsed = parseDbml(`
    Table sales.Parent {
      id int [pk]
    }
    Table sales.Child {
      id int [pk]
      parent_id int [not null]
    }
    Table hr.Other {
      id int
    }
    Ref: sales.Child.parent_id > sales.Parent.id
  `)!;
  const sources = reportingSources(parsed);
  const child = sources.find(source => source.name === "sales.Child")!;
  const parent = sources.find(source => source.name === "sales.Parent")!;
  const html = generateReportingHandoff(parsed, { ...emptyReportingBrief, title: "Graph" },
    { [child.key]: "One row per </script><b>child</b>", [parent.key]: "" }, parent.key, { includeNotes: false, includeSql: false });

  expect(html.indexOf('aria-controls="graph"')).toBeLessThan(html.indexOf('aria-controls="overview"'));
  expect(html).toContain('id="graph" role="tabpanel"');
  const island = html.match(/<script type="application\/json" id="map-data">([\s\S]*?)<\/script>/)?.[1];
  expect(island).toBeDefined();
  expect(island).not.toContain("<");
  const data = JSON.parse(island!) as HandoffMapData;
  expect(data.nodes.map(node => node.name).sort()).toEqual(["sales.Child", "sales.Parent"]);
  const childNode = data.nodes.find(node => node.name === "sales.Child")!;
  expect(childNode.rows).toBe("One row per </script><b>child</b>");
  expect(childNode.cols).toContainEqual({ n: "parent_id", t: "int", nn: true, fk: "sales.Parent.id" });
  expect(data.nodes.find(node => node.name === "sales.Parent")!.primary).toBe(true);
  expect(data.edges).toEqual([{ s: childNode.id, t: data.nodes.find(node => node.name === "sales.Parent")!.id, ae: "*", be: "1", on: "sales.Child.parent_id = sales.Parent.id" }]);
  expect(() => new Script(html.match(/<script>([\s\S]+)<\/script>/)![1])).not.toThrow();
});
