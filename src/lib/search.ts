import type { Filters, Recipe, SortKey } from "../types";
import { isChoseongQuery, normalizeChoseongQuery, toChoseong } from "./hangul";

/** 검색 대상 텍스트를 레시피마다 한 번만 만들어 둔다. */
export interface SearchIndexEntry {
  recipe: Recipe;
  haystack: string;
  /** 초성 검색용. 필드마다 어절 단위로 쪼개 둔다 (3항 참고) */
  choseongFields: string[][];
  ingredientNames: string[];
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export function buildIndex(recipes: Recipe[]): SearchIndexEntry[] {
  return recipes.map((recipe) => {
    const parts = [
      recipe.name,
      recipe.nameEn,
      recipe.category,
      recipe.group,
      ...recipe.tags,
      ...recipe.ingredients.map((i) => i.name),
    ];

    // 초성은 필드를 섞지 않는다. "모듬 야채 커리" 와 "치킨 커리" 를 이어 붙이면
    // 존재하지 않는 초성열이 만들어져 오탐이 난다.
    const choseongFields = [recipe.name, recipe.category, ...recipe.tags]
      .concat(recipe.ingredients.map((i) => i.name))
      .map((field) =>
        toChoseong(field)
          .split(/[\s()/·,]+/)
          .filter(Boolean)
      );

    return {
      recipe,
      haystack: norm(parts.join(" ")),
      choseongFields,
      ingredientNames: recipe.ingredients.map((i) => norm(i.name)),
    };
  });
}

/**
 * 초성 매칭. 어절 시작점에서만 매칭을 허용하되 어절 경계는 넘을 수 있다.
 * "ㅊㅋㅋㄹ" -> "치킨 커리" O,  "ㅋㄹ" -> "치킨 커리" O,
 * "ㅊㅋ" -> "모듬 야채 커리" X (야'채'는 어절 중간)
 */
function matchesChoseong(fields: string[][], query: string): boolean {
  for (const words of fields) {
    for (let i = 0; i < words.length; i += 1) {
      if (words.slice(i).join("").startsWith(query)) return true;
    }
  }
  return false;
}

export interface SearchHit {
  recipe: Recipe;
  /** 재료명으로 걸렸을 때 그 재료명 (목록 카드에 표시) */
  matchedIngredients: string[];
  score: number;
}

function scoreOf(entry: SearchIndexEntry, query: string): number {
  const { recipe } = entry;
  const name = norm(recipe.name);
  const nameEn = norm(recipe.nameEn);
  if (name === query || nameEn === query) return 0;
  if (name.startsWith(query) || nameEn.startsWith(query)) return 1;
  if (name.includes(query) || nameEn.includes(query)) return 2;
  if (norm(recipe.category).includes(query)) return 3;
  if (recipe.tags.some((t) => norm(t).includes(query))) return 4;
  return 5;
}

export function search(index: SearchIndexEntry[], rawQuery: string): SearchHit[] {
  const query = norm(rawQuery);
  if (!query) {
    return index.map((e) => ({ recipe: e.recipe, matchedIngredients: [], score: 0 }));
  }

  const choseongMode = isChoseongQuery(rawQuery);
  const choseongQuery = choseongMode ? normalizeChoseongQuery(rawQuery) : "";

  const hits: SearchHit[] = [];
  for (const entry of index) {
    const matched = choseongMode
      ? matchesChoseong(entry.choseongFields, choseongQuery)
      : entry.haystack.includes(query);
    if (!matched) continue;
    const matchedIngredients = choseongMode
      ? []
      : entry.recipe.ingredients.filter((i) => norm(i.name).includes(query)).map((i) => i.name);
    hits.push({
      recipe: entry.recipe,
      matchedIngredients,
      score: choseongMode ? 2 : scoreOf(entry, query),
    });
  }
  return hits;
}

const SORTERS: Record<SortKey, (a: Recipe, b: Recipe) => number> = {
  name: (a, b) => a.name.localeCompare(b.name, "ko"),
  time: (a, b) => a.cookTimeMax - b.cookTimeMax || a.name.localeCompare(b.name, "ko"),
  ingredients: (a, b) =>
    a.ingredients.length - b.ingredients.length || a.name.localeCompare(b.name, "ko"),
};

export function applyFilters(index: SearchIndexEntry[], filters: Filters): SearchHit[] {
  const byId = new Map(index.map((e) => [e.recipe.id, e]));
  let hits = search(index, filters.q);

  if (filters.group !== "전체") {
    hits = hits.filter((h) => h.recipe.group === filters.group);
  }
  if (filters.categories.length) {
    const set = new Set(filters.categories);
    hits = hits.filter((h) => set.has(h.recipe.category));
  }
  if (filters.maxTime > 0) {
    hits = hits.filter((h) => h.recipe.cookTimeMax <= filters.maxTime);
  }
  if (filters.exclude.length) {
    const banned = filters.exclude.map(norm);
    hits = hits.filter((h) => {
      const names = byId.get(h.recipe.id)!.ingredientNames;
      return !banned.some((b) => names.some((n) => n.includes(b)));
    });
  }

  const sorter = SORTERS[filters.sort];
  const useRelevance = filters.q.trim().length > 0 && filters.sort === "name";
  hits.sort((a, b) =>
    useRelevance ? a.score - b.score || sorter(a.recipe, b.recipe) : sorter(a.recipe, b.recipe)
  );
  return hits;
}

/** 검색어에 걸린 구간을 [before, match, after] 로 쪼갠다. 초성 검색에는 적용하지 않는다. */
export function highlight(text: string, rawQuery: string): [string, string, string] | null {
  const query = norm(rawQuery);
  if (!query || isChoseongQuery(rawQuery)) return null;
  const at = text.toLowerCase().indexOf(query);
  if (at === -1) return null;
  return [text.slice(0, at), text.slice(at, at + query.length), text.slice(at + query.length)];
}

/** 재료 제외 필터의 후보 목록 — 여러 레시피에 쓰이는 재료를 빈도순으로. */
export function commonIngredients(recipes: Recipe[], limit = 24): string[] {
  const counts = new Map<string, number>();
  for (const r of recipes) {
    const unique = new Set(r.ingredients.map((i) => i.name));
    for (const name of unique) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
    .slice(0, limit)
    .map(([name]) => name);
}
