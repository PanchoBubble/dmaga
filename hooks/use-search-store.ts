import { create } from "zustand";

import type { MediaCategory } from "@/lib/mock-media";

type SearchState = {
  query: string;
  category: MediaCategory;
  setQuery: (query: string) => void;
  setCategory: (category: MediaCategory) => void;
};

export const useSearchStore = create<SearchState>((set) => ({
  query: "",
  category: "all",
  setQuery: (query) => set({ query }),
  setCategory: (category) => set({ category }),
}));
