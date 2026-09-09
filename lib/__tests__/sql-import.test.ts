import { describe, it, expect } from "vitest";
import {
  importSqlSchema,
  dropPlaceholderTables,
  detectSqlDialect,
  findMissingReferences,
  SqlImportError,
  type SqlImportIssue,
} from "@/lib/parser/sql-import";
import type { Table, Relationship } from "@/store/useCanvasStore";

// ── helpers ───────────────────────────────────────────────────────────────
const table = (tables: Table[], name: string): Table => {
  const found = tables.find((t) => t.name === name);
  if (!found) throw new Error(`no table "${name}" in [${tables.map((t) => t.name).join(", ")}]`);
  return found;
};

/** Renders a relationship as "source.col -> target.col" for readable assertions. */
const describeRel = (rel: Relationship, tables: Table[]): string => {
  const side = (tableId: string, columnId: string) => {
    const t = tables.find((x) => x.id === tableId)!;
    return `${t.name}.${t.columns.find((c) => c.id === columnId)!.name}`;
  };
  return `${side(rel.sourceTableId, rel.sourceColumnId)} -> ${side(rel.targetTableId, rel.targetColumnId)}`;
};

// ── fixtures ──────────────────────────────────────────────────────────────
const SQL_SERVER = `
CREATE SCHEMA [Sales] AUTHORIZATION [dbo];
GO

CREATE TABLE [Sales].[Invoice] (
  [Id] BIGINT IDENTITY(1,1) NOT NULL,
  [CustomerId] BIGINT NOT NULL,
  [Reference] NVARCHAR(50) NOT NULL,
  [Notes] NVARCHAR(MAX) NULL, -- REFERENCES nothing, just a comment
  [Created] DATETIME2(7) NOT NULL CONSTRAINT [DF_Invoice_Created] DEFAULT GETUTCDATE(),

  CONSTRAINT [PK_Invoice] PRIMARY KEY CLUSTERED ([Id] ASC),
  CONSTRAINT [FK_Invoice_Customer] FOREIGN KEY ([CustomerId])
    REFERENCES [Sales].[Customer] ([Id]) ON DELETE SET NULL
);
GO

CREATE TABLE [Sales].[Customer] (
  [Id] BIGINT IDENTITY(1,1) NOT NULL,
  [Email] NVARCHAR(255) NOT NULL,
  CONSTRAINT [PK_Customer] PRIMARY KEY CLUSTERED ([Id] ASC)
);
GO

CREATE UNIQUE INDEX [UX_Customer_Email] ON [Sales].[Customer] ([Email]);
GO
`;

const POSTGRES = `
CREATE TABLE users (
  id serial PRIMARY KEY,
  email text NOT NULL
);

CREATE TABLE posts (
  id serial PRIMARY KEY,
  author_id integer NOT NULL
);

ALTER TABLE ONLY posts
  ADD CONSTRAINT posts_author_fkey FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE;
`;

const MYSQL = `
CREATE TABLE \`orders\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`total\` decimal(10,2) NOT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB;
`;

// ── dialect detection ─────────────────────────────────────────────────────
describe("detectSqlDialect", () => {
  it("recognizes SQL Server by its brackets, GO batches and IDENTITY", () => {
    expect(detectSqlDialect(SQL_SERVER)).toBe("mssql");
  });

  it("recognizes PostgreSQL by serial and ALTER TABLE ONLY", () => {
    expect(detectSqlDialect(POSTGRES)).toBe("postgres");
  });

  it("recognizes MySQL by backticks and AUTO_INCREMENT", () => {
    expect(detectSqlDialect(MYSQL)).toBe("mysql");
  });

  it("falls back to PostgreSQL for plain ANSI DDL", () => {
    expect(detectSqlDialect("CREATE TABLE t (id INT PRIMARY KEY);")).toBe("postgres");
  });

  it("is stable across repeat calls (the signal regexes are module-level)", () => {
    expect(detectSqlDialect(MYSQL)).toBe(detectSqlDialect(MYSQL));
  });
});

// ── dangling references ───────────────────────────────────────────────────
describe("findMissingReferences", () => {
  it("finds foreign keys whose target table isn't in the script", () => {
    const missing = findMissingReferences(
      `CREATE TABLE a (b_id INT REFERENCES b(id), c_id INT REFERENCES c(id));
       CREATE TABLE c (id INT PRIMARY KEY);`
    );
    expect(missing.map((m) => m.raw)).toEqual(["b"]);
    expect(missing[0].columns).toEqual(["id"]);
  });

  it("matches targets regardless of quoting and case", () => {
    expect(
      findMissingReferences(
        `CREATE TABLE [dbo].[Users] ([Id] INT);
         CREATE TABLE [dbo].[Posts] ([U] INT CONSTRAINT [FK] REFERENCES dbo.users ([Id]));`
      )
    ).toEqual([]);
  });

  it("ignores REFERENCES inside comments and string literals", () => {
    expect(
      findMissingReferences(
        `-- REFERENCES ghost(id)
         /* REFERENCES phantom(id) */
         CREATE TABLE a (note TEXT DEFAULT 'REFERENCES spook(id)');`
      )
    ).toEqual([]);
  });

  it("merges the columns named by several keys onto the same missing table", () => {
    const missing = findMissingReferences(
      `CREATE TABLE a (x INT REFERENCES ext(id), y INT REFERENCES ext(code));`
    );
    expect(missing).toHaveLength(1);
    expect(missing[0].columns).toEqual(["id", "code"]);
  });
});

// ── import ────────────────────────────────────────────────────────────────
describe("importSqlSchema", () => {
  it("imports a SQL Server script, keeping types, keys and identity columns", () => {
    const result = importSqlSchema(SQL_SERVER);

    expect(result.dialect).toBe("mssql");
    expect(result.autoDetected).toBe(true);

    const invoice = table(result.tables, "Sales.Invoice");
    const id = invoice.columns.find((c) => c.name === "Id")!;
    // The PK is declared as a table-level constraint and IDENTITY is folded into
    // the type name — both have to end up on the column.
    expect(id.isPrimaryKey).toBe(true);
    expect(id.isAutoIncrement).toBe(true);
    expect(id.type).toBe("BIGINT");
    expect(invoice.columns.find((c) => c.name === "Notes")!.type).toBe("NVARCHAR(MAX)");
    expect(invoice.columns.find((c) => c.name === "Reference")!.isNotNull).toBe(true);
  });

  it("promotes a single-column unique index onto the column", () => {
    const customer = table(importSqlSchema(SQL_SERVER).tables, "Sales.Customer");
    expect(customer.columns.find((c) => c.name === "Email")!.isUnique).toBe(true);
  });

  it("carries referential actions onto the relationship", () => {
    const result = importSqlSchema(SQL_SERVER);
    const rel = result.relationships[0];
    expect(describeRel(rel, result.tables)).toBe("Sales.Invoice.CustomerId -> Sales.Customer.Id");
    expect(rel.onDelete).toBe("Set null");
  });

  it("reads PostgreSQL, including foreign keys added by a later ALTER", () => {
    const result = importSqlSchema(POSTGRES);
    expect(result.dialect).toBe("postgres");
    expect(result.tables.map((t) => t.name).sort()).toEqual(["posts", "users"]);
    expect(describeRel(result.relationships[0], result.tables)).toBe("posts.author_id -> users.id");
    expect(result.relationships[0].onDelete).toBe("Cascade");
  });

  it("reads MySQL", () => {
    const result = importSqlSchema(MYSQL);
    expect(result.dialect).toBe("mysql");
    const id = table(result.tables, "orders").columns.find((c) => c.name === "id")!;
    expect(id.isPrimaryKey).toBe(true);
    expect(id.isAutoIncrement).toBe(true);
  });

  it("honours an explicit dialect instead of detecting one", () => {
    const result = importSqlSchema(POSTGRES, { dialect: "postgres" });
    expect(result.autoDetected).toBe(false);
  });

  it("gives every table a distinct-ish palette colour rather than one default", () => {
    const colors = new Set(importSqlSchema(SQL_SERVER).tables.map((t) => t.color));
    expect(colors.size).toBeGreaterThan(1);
  });
});

// ── placeholders ──────────────────────────────────────────────────────────
describe("placeholder tables", () => {
  // The common real-world case: one schema pasted out of a larger database, so
  // its foreign keys point at tables that aren't in the paste at all.
  const PARTIAL = `
CREATE TABLE [App].[Order] (
  [Id] BIGINT IDENTITY(1,1) NOT NULL,
  [CustomerId] BIGINT NOT NULL,
  CONSTRAINT [PK_Order] PRIMARY KEY CLUSTERED ([Id] ASC),
  CONSTRAINT [FK_Order_Customer] FOREIGN KEY ([CustomerId]) REFERENCES [Crm].[Customer] ([Id])
);
GO
`;

  it("stubs out unresolved foreign key targets instead of failing the whole script", () => {
    const result = importSqlSchema(PARTIAL);
    expect(result.tables.map((t) => t.name).sort()).toEqual(["App.Order", "Crm.Customer"]);
    expect(result.placeholderTableIds).toHaveLength(1);
    expect(table(result.tables, "Crm.Customer").id).toBe(result.placeholderTableIds[0]);
    expect(result.relationships).toHaveLength(1);
  });

  it("drops the stubs and their relationships on request", () => {
    const trimmed = dropPlaceholderTables(importSqlSchema(PARTIAL));
    expect(trimmed.tables.map((t) => t.name)).toEqual(["App.Order"]);
    expect(trimmed.relationships).toEqual([]);
  });

  it("leaves a fully self-contained script untouched", () => {
    const result = importSqlSchema(POSTGRES);
    expect(result.placeholderTableIds).toEqual([]);
    expect(dropPlaceholderTables(result)).toBe(result);
  });
});

// ── failure modes ─────────────────────────────────────────────────────────
describe("failures", () => {
  it("rejects an empty script", () => {
    expect(() => importSqlSchema("   ")).toThrow(SqlImportError);
  });

  it("rejects a script with no tables in it", () => {
    expect(() => importSqlSchema("SELECT 1;")).toThrow(SqlImportError);
  });

  it("reports the failing dialect and any located syntax errors", () => {
    try {
      importSqlSchema("CREATE TABLE (((;", { dialect: "postgres" });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(SqlImportError);
      expect((err as SqlImportError).dialect).toBe("postgres");
    }
  });

  // `@dbml/core` leaves antlr4's default listener on its SQL lexers, so a
  // character no token covers is written straight to the console and left out
  // of the thrown error — in dev that reads as a crash for a failure we handle.
  it("locates a stray character instead of logging it to the console", () => {
    const logged: unknown[][] = [];
    const consoleError = console.error;
    console.error = (...args: unknown[]) => void logged.push(args);

    const script = `${SQL_SERVER}
  • pasted bullet
`;
    let issues: SqlImportIssue[] = [];
    try {
      importSqlSchema(script, { dialect: "mssql" });
      expect.unreachable("should have thrown");
    } catch (err) {
      issues = (err as SqlImportError).issues;
    } finally {
      console.error = consoleError;
    }

    const bulletLine = script.split("\n").findIndex((l) => l.includes("•")) + 1;
    expect(logged).toEqual([]);
    expect(issues[0]).toMatchObject({
      line: bulletLine,
      message: "token recognition error at: '•'",
    });
  });

  // The lexer quotes the whole run it failed on, so a stray character sitting
  // at the end of a line sweeps that line's newline into the message with it.
  it("locates a stray character that runs to the end of its line", () => {
    const logged: unknown[][] = [];
    const consoleError = console.error;
    console.error = (...args: unknown[]) => void logged.push(args);

    const script = `CREATE OR REPLACE TABLE customer (
  id NUMBER NOT NULL PRIMARY KEY,
  email VARCHAR(255) NOT NULL
);

  a |
`;
    let issues: SqlImportIssue[] = [];
    try {
      importSqlSchema(script, { dialect: "snowflake" });
      expect.unreachable("should have thrown");
    } catch (err) {
      issues = (err as SqlImportError).issues;
    } finally {
      console.error = consoleError;
    }

    expect(logged).toEqual([]);
    expect(issues[0]).toMatchObject({
      line: script.split("\n").findIndex((l) => l.includes("|")) + 1,
      // The swept-up newline is spelled out rather than breaking the row.
      message: "token recognition error at: '|\\n'",
    });
  });

  it("condenses ANTLR's list of expected tokens", () => {
    try {
      importSqlSchema("CREATE TABLE [x] (", { dialect: "mssql" });
      expect.unreachable("should have thrown");
    } catch (err) {
      const messages = (err as SqlImportError).issues.map((i) => i.message);
      const expecting = messages.find((m) => m.includes("expecting {"));
      expect(expecting).toBeDefined();
      // The raw T-SQL message spells out a few thousand keywords here.
      expect(expecting!.length).toBeLessThan(200);
      expect(expecting).toMatch(/\+\d+ more\}/);
    }
  });
});
