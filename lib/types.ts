export type Slot = "top" | "outerwear" | "dress" | "shoes" | "bag" | "accessory";
export type Gender = "male" | "female" | "unisex";

export interface Product {
  id: number;
  title: string;
  description: string;
  category: string;
  brand?: string;
  price: number; // USD
  rating: number;
  thumbnail: string;
  images: string[];
  slot: Slot;
  gender: Gender;
  formality: number; // 1 (very casual) – 5 (very formal)
  styleWords: string[];
  embedding?: number[];
}

export interface ParsedQuery {
  searchText: string; // descriptive rewrite used for embedding
  gender: "male" | "female" | null;
  budget: number | null; // USD
  budgetOriginal: string | null; // e.g. "₹5000"
  slotsNeeded: Slot[] | null; // null = full outfit
  occasion: string | null;
  timeOfDay: string | null;
  formality: number | null;
}

export interface RankedProduct extends Omit<Product, "embedding"> {
  score: number;
}

export interface Outfit {
  id: string;
  gender: Gender;
  items: RankedProduct[];
  total: number;
  score: number;
  withinBudget: boolean | null; // null = no budget given
  reason: string;
}
