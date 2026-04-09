import { Parser } from "@dbml/core";

/**
 * Parses a DBML string into a Database AST.
 * Handles errors gracefully and returns null if parsing fails.
 */
export const parseDbml = (dbmlString: string) => {
  if (!dbmlString || dbmlString.trim() === "") return null;
  
  try {
    const database = Parser.parse(dbmlString, 'dbml');
    return database;
  } catch (error) {
    console.error("Failed to parse DBML:", error);
    // In a future step, we can return the error directly to feed into Monaco markers
    return null;
  }
};
