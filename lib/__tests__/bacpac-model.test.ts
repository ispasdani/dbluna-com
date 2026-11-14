import { Readable } from "node:stream";
import { expect, it } from "vitest";
import { parseBacpacModel } from "@/lib/parser/bacpac-model";
import { generateDbmlFromCanvas } from "@/lib/generator/dbml-generator";
import { parseDbml, parsedRefsToCanvasRelationships, parsedTablesToCanvasTables } from "@/lib/parser/dsl-parser";
import type { Relationship, Table } from "@/store/useCanvasStore";

it("resolves ordered foreign keys and descriptions before their table declarations", async () => {
  const model = await parseBacpacModel(Readable.from([`<DataSchemaModel><Model>
    <Element Type="SqlForeignKeyConstraint" Name="[sales].[FK_Orders]">
      <Property Name="DeleteAction" Value="1"/>
      <Relationship Name="Columns"><Entry><References Name="[sales].[Orders].[Tenant]"/></Entry><Entry><References Name="[sales].[Orders].[Id]"/></Entry></Relationship>
      <Relationship Name="ForeignColumns"><Entry><References Name="[archive].[Orders].[Tenant]"/></Entry><Entry><References Name="[archive].[Orders].[Id]"/></Entry></Relationship>
    </Element>
    <Element Type="SqlPrimaryKeyConstraint" Name="[archive].[PK_Orders]">
      <Relationship Name="ColumnSpecifications"><Entry><Element Type="SqlIndexedColumnSpecification">
        <Relationship Name="Column"><Entry><References Name="[archive].[Orders].[Tenant]"/></Entry></Relationship>
      </Element></Entry><Entry><Element Type="SqlIndexedColumnSpecification">
        <Relationship Name="Column"><Entry><References Name="[archive].[Orders].[Id]"/></Entry></Relationship>
      </Element></Entry></Relationship>
    </Element>
    <Element Type="SqlExtendedProperty" Name="[sales].[Orders].[Id].[MS_Description]">
      <Property Name="Value"><Value><![CDATA[External order identifier]]></Value></Property>
      <Relationship Name="Host"><Entry><References Name="[sales].[Orders].[Id]"/></Entry></Relationship>
    </Element>
    ${["sales", "archive"].map(schema => `<Element Type="SqlTable" Name="[${schema}].[Orders]"><Relationship Name="Columns">
      <Entry><Element Type="SqlSimpleColumn" Name="[${schema}].[Orders].[Id]">
        <Relationship Name="TypeSpecifier"><Entry><Element Type="SqlTypeSpecifier">
          <Property Name="Precision" Value="19"/><Property Name="Scale" Value="4"/>
          <Relationship Name="Type"><Entry><References Name="[decimal]" ExternalSource="BuiltIns"/></Entry></Relationship>
        </Element></Entry></Relationship>
      </Element></Entry>
      <Entry><Element Type="SqlSimpleColumn" Name="[${schema}].[Orders].[Tenant]">
        <Relationship Name="Type"><Entry><References Name="[int]" ExternalSource="BuiltIns"/></Entry></Relationship>
      </Element></Entry></Relationship></Element>`).join("")}
    </Model></DataSchemaModel>`]));

  expect(model.tables[0].columns[0]).toMatchObject({
    name: "Id", type: "decimal(19,4)", description: "External order identifier",
  });
  expect(model.tables[1].primaryKey).toEqual(["Tenant", "Id"]);
  expect(model.relationships[0]).toMatchObject({
    sourceTable: "sales.Orders", targetTable: "archive.Orders",
    sourceColumns: ["Tenant", "Id"], targetColumns: ["Tenant", "Id"],
    onUpdate: "No action", onDelete: "Cascade",
  });

  const tables: Table[] = model.tables.map((table) => ({
    id: table.name, name: table.name, primaryKey: table.primaryKey, x: 0, y: 0, color: "#000",
    columns: table.columns.map(column => ({
      ...column, id: column.name, isPrimaryKey: column.isPk,
    })),
  }));
  const relationship: Relationship = {
    id: "fk", name: "FK_Orders", sourceTableId: "sales.Orders", targetTableId: "archive.Orders",
    sourceColumnId: "Tenant", targetColumnId: "Tenant",
    sourceColumnIds: ["Tenant", "Id"], targetColumnIds: ["Tenant", "Id"],
    cardinality: "One to many", onUpdate: "No action", onDelete: "Cascade",
  };
  const dbml = generateDbmlFromCanvas(tables, [relationship], { includeDescriptions: true });
  expect(dbml).toContain("External order identifier");
  const parsed = parseDbml(dbml);
  expect(parsed).not.toBeNull();
  expect(parsed!.tables.find(table => table.schema?.name === "archive")?.indexes?.[0]?.pk).toBe(true);
  expect(parsedRefsToCanvasRelationships(parsed!.refs, tables, [relationship])).toEqual([relationship]);
});

it("rejects malformed model XML", async () => {
  await expect(parseBacpacModel(Readable.from(["<Model><Element></Model>"]))).rejects.toThrow();
});


it("preserves bracketed schema names and SQL expressions", async () => {
  const model = await parseBacpacModel(Readable.from([`<Model>
    <Element Type="SqlDefaultConstraint" Name="[ops.eu].[DF_Total]">
      <Property Name="DefaultExpressionScript"><Value><![CDATA[((0))]]></Value></Property>
      <Relationship Name="Column"><Entry><References Name="[ops.eu].[Totals]]].[Total]"/></Entry></Relationship>
    </Element>
    <Element Type="SqlTable" Name="[ops.eu].[Totals]]]">
      <Relationship Name="Columns">
        <Entry><Element Type="SqlSimpleColumn" Name="[ops.eu].[Totals]]].[Total]"/></Entry>
        <Entry><Element Type="SqlComputedColumn" Name="[ops.eu].[Totals]]].[Double]">
          <Property Name="ExpressionScript"><Value><![CDATA[([Total]*(2))]]></Value></Property>
        </Element></Entry>
      </Relationship>
    </Element>
    <Element Type="SqlIndex" Name="[ops.eu].[Totals]]].[IX_Total]">
      <Property Name="Unique" Value="True"/>
      <Property Name="FilterPredicate"><Value><![CDATA[([Total]>(0))]]></Value></Property>
      <Relationship Name="Columns"><Entry><Element Type="SqlIndexedColumnSpecification">
        <Relationship Name="Column"><Entry><References Name="[ops.eu].[Totals]]].[Total]"/></Entry></Relationship>
      </Element></Entry></Relationship>
      <Relationship Name="IncludedColumns"><Entry><References Name="[ops.eu].[Totals]]].[Double]"/></Entry></Relationship>
    </Element>
    <Element Type="SqlUniqueConstraint" Name="[ops.eu].[UQ_DoubleTotal]">
      <Relationship Name="Columns">
        <Entry><References Name="[ops.eu].[Totals]]].[Double]"/></Entry>
        <Entry><References Name="[ops.eu].[Totals]]].[Total]"/></Entry>
      </Relationship>
    </Element>
  </Model>`]));
  expect(model.tables).toHaveLength(1);
  expect(model.tables[0].name).toBe("[ops.eu].[Totals]]]");
  expect(model.tables[0].columns).toMatchObject([
    { name: "Total", defaultExpression: "((0))" },
    { name: "Double", computedExpression: "([Total]*(2))" },
  ]);
  const tables: Table[] = model.tables.map(table => ({
    ...table, id: table.name, x: 0, y: 0, color: "#000",
    columns: table.columns.map(column => ({
      ...column, id: column.name, isPrimaryKey: column.isPk,
    })),
  }));
  const parsed = parseDbml(generateDbmlFromCanvas(tables, []));
  expect(parsed?.tables[0]).toMatchObject({ name: "Totals]", schema: { name: "ops.eu" } });
  const restored = parsedTablesToCanvasTables(parsed!.tables, {
    existingTables: tables, originX: 0, originY: 0,
  });
  expect(restored[0].name).toBe(tables[0].name);
  expect(model.tables[0].sqlServerIndexes).toMatchObject([
    { name: "IX_Total", kind: "index", unique: true, columns: ["Total"], includedColumns: ["Double"], filter: "([Total]>(0))" },
    { name: "UQ_DoubleTotal", kind: "unique constraint", unique: true, columns: ["Double", "Total"], includedColumns: [] },
  ]);
  expect(restored[0].sqlServerIndexes).toEqual(model.tables[0].sqlServerIndexes);
  expect(restored[0].columns).toMatchObject([
    { name: "Total", defaultExpression: "((0))" },
    { name: "Double", computedExpression: "([Total]*(2))" },
  ]);
});
