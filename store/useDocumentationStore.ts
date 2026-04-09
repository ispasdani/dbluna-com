import { create } from "zustand";
import type { ParsedDbmlResult, ParsedTable, ParsedEnum, ParsedTableGroup, ParsedProject } from "@/lib/parser/dsl-parser";

interface DocumentationState {
  // The full parsed result from the DBML parser
  parsedDbml: ParsedDbmlResult | null;

  // Derived, convenience accessors (kept in sync by setParsedDbml)
  project: ParsedProject | null;
  tables: ParsedTable[];
  enums: ParsedEnum[];
  tableGroups: ParsedTableGroup[];

  // Selection state
  selectedTableId: number | null;
  selectedEnumId: number | null;
  searchQuery: string;

  // Actions
  setParsedDbml: (dbml: ParsedDbmlResult | null) => void;
  setSelectedTableId: (id: number | null) => void;
  setSelectedEnumId: (id: number | null) => void;
  setSearchQuery: (query: string) => void;
}

export const useDocumentationStore = create<DocumentationState>((set) => ({
  parsedDbml: null,
  project: null,
  tables: [],
  enums: [],
  tableGroups: [],

  selectedTableId: null,
  selectedEnumId: null,
  searchQuery: "",

  setParsedDbml: (dbml) =>
    set({
      parsedDbml: dbml,
      project: dbml?.project ?? null,
      tables: dbml?.tables ?? [],
      enums: dbml?.enums ?? [],
      tableGroups: dbml?.tableGroups ?? [],
    }),

  setSelectedTableId: (id) => set({ selectedTableId: id, selectedEnumId: null }),
  setSelectedEnumId: (id) => set({ selectedEnumId: id, selectedTableId: null }),
  setSearchQuery: (query) => set({ searchQuery: query }),
}));
