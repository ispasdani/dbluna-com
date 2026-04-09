import { create } from "zustand";

interface DocumentationState {
  parsedDbml: any | null;
  selectedTableId: number | null;
  selectedEnumId: number | null;
  searchQuery: string;
  
  setParsedDbml: (dbml: any | null) => void;
  setSelectedTableId: (id: number | null) => void;
  setSelectedEnumId: (id: number | null) => void;
  setSearchQuery: (query: string) => void;
}

export const useDocumentationStore = create<DocumentationState>((set) => ({
  parsedDbml: null,
  selectedTableId: null,
  selectedEnumId: null,
  searchQuery: "",
  
  setParsedDbml: (dbml) => set({ parsedDbml: dbml }),
  setSelectedTableId: (id) => set({ selectedTableId: id, selectedEnumId: null }),
  setSelectedEnumId: (id) => set({ selectedEnumId: id, selectedTableId: null }),
  setSearchQuery: (query) => set({ searchQuery: query }),
}));
