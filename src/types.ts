export const GROUPS = [
  "커리",
  "탄두리",
  "스낵",
  "빵류",
  "밥·면",
  "수프·샐러드",
  "디저트·음료",
  "세트",
] as const;

export type Group = (typeof GROUPS)[number];

export interface Ingredient {
  no: number;
  name: string;
  amount: string;
  note: string;
}

export interface Recipe {
  id: string;
  name: string;
  nameEn: string;
  category: string;
  group: Group;
  serving: string;
  cookTime: string;
  cookTimeMin: number;
  cookTimeMax: number;
  image: string | null;
  tags: string[];
  ingredients: Ingredient[];
  steps: string[];
  garnish: string;
}

export type SortKey = "name" | "time" | "ingredients";

export interface Filters {
  q: string;
  group: Group | "전체";
  categories: string[];
  /** 조리 시간 상한(분). 0 = 제한 없음 */
  maxTime: number;
  /** 이 재료를 포함하지 않는 레시피만 */
  exclude: string[];
  sort: SortKey;
}

export const EMPTY_FILTERS: Filters = {
  q: "",
  group: "전체",
  categories: [],
  maxTime: 0,
  exclude: [],
  sort: "name",
};
