/** 메뉴판 순서. 목록 탭·정렬·PDF 목차가 모두 이 순서를 따른다. */
export const GROUPS = [
  "커리",
  "탄두리",
  "스낵",
  "빵류",
  "밥·면",
  "수프·샐러드",
  "세트",
  "디저트",
  "음료",
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
  /** 원본 사진이 아닐 때 그 출처 설명 (예: 다른 메뉴 사진을 빌려온 경우) */
  imageNote: string | null;
  /** 메뉴판 정렬 키 — 대분류 → 세부 카테고리 → 개별 메뉴 */
  order: number;
  tags: string[];
  ingredients: Ingredient[];
  steps: string[];
  garnish: string;
}

export type SortKey = "menu" | "name" | "time" | "ingredients";

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
  sort: "menu",
};
