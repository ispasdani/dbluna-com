import { expect, it } from "vitest";
import { Script } from "node:vm";
import { parseDbml } from "@/lib/parser/dsl-parser";
import { emptyReportingBrief, generateReportingHandoff, reportingSources } from "@/lib/generator/reporting-handoff";

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
