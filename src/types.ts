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
  "프렙",
] as const;

export type Group = (typeof GROUPS)[number];

export interface Ingredient {
  no: number;
  name: string;
  amount: string;
  note: string;
  /** 이 재료가 자체 제조 프렙이면 그 레시피 id */
  prepId?: string;
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
  /** 영어 번역층. i18n/en/*.json 에서 빌드 시 병합된다. */
  en: RecipeTranslation;
  /** 프렙 레시피일 때, 이 프렙을 쓰는 메뉴들 */
  usedIn?: { id: string; name: string; nameEn: string }[];
}

export interface RecipeTranslation {
  group: string;
  category: string;
  imageNote: string | null;
  serving: string;
  cookTime: string;
  tags: string[];
  ingredients: Ingredient[];
  steps: string[];
  garnish: string;
}

/**
 * 언어가 적용된 레시피. `group`/`category` 등은 표시용 문자열로 덮이므로
 * 필터·정렬에는 원본(`Recipe`)의 값을 쓴다.
 */
export interface LocalizedRecipe extends Omit<Recipe, "group" | "category"> {
  title: string;
  subtitle: string;
  /** 표시용 문자열 */
  group: string;
  category: string;
  /** 필터·이모지 조회에 쓰는 원본(한국어) 값 */
  groupKey: Group;
  categoryKey: string;
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
