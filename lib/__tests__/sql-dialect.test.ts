import { describe, it, expect } from "vitest";
import { dialectFromDatabaseType, SQL_DIALECTS } from "@/lib/generator/sql-generator";

describe("dialectFromDatabaseType", () => {
  it("resolves every label the Schema tab suggests", () => {
    // The Project section offers SQL_DIALECTS labels in its datalist, so each
    // one must round-trip back to its own dialect.
    for (const { value, label } of SQL_DIALECTS) {
      expect(dialectFromDatabaseType(label), label).toBe(value);
    }
  });

  it("matches on substrings, since database_type is free text", () => {
    expect(dialectFromDatabaseType("Postgres 15")).toBe("postgres");
    expect(dialectFromDatabaseType("Microsoft SQL Server 2022")).toBe("mssql");
    expect(dialectFromDatabaseType("MariaDB")).toBe("mysql");
    expect(dialectFromDatabaseType("Oracle 19c")).toBe("oracle");
  });

  it("is case-insensitive", () => {
    expect(dialectFromDatabaseType("POSTGRESQL")).toBe("postgres");
    expect(dialectFromDatabaseType("mssql")).toBe("mssql");
  });

  it("does not confuse the shared 'sql' substring across dialects", () => {
    // "PostgreSQL", "MySQL" and "SQL Server" all contain "sql"; each must land
    // on its own dialect rather than the first one that happens to match.
    expect(dialectFromDatabaseType("PostgreSQL")).toBe("postgres");
    expect(dialectFromDatabaseType("MySQL")).toBe("mysql");
    expect(dialectFromDatabaseType("SQL Server")).toBe("mssql");
  });

  it("returns null for unset, blank or unrecognized values", () => {
    expect(dialectFromDatabaseType(undefined)).toBeNull();
    expect(dialectFromDatabaseType(null)).toBeNull();
    expect(dialectFromDatabaseType("   ")).toBeNull();
    expect(dialectFromDatabaseType("SQLite")).toBeNull();
    expect(dialectFromDatabaseType("CockroachDB")).toBeNull();
  });
});
