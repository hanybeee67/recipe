/**
 * 매니저 수정분.
 *
 * 원본(recipes/*.md)은 건드리지 않고, 바뀐 필드만 덮개(patch)로 들고 있다가
 * 화면에 얹는다. 그래서 나중에 원본 엑셀을 다시 변환해도 수정분이 살아남는다.
 *
 * 저장은 이 기기의 localStorage 다. 다른 사람 화면에 반영하려면 「내보내기」로
 * 파일을 받아 저장소에 넣고 `npm run apply-edits` 를 돌려야 한다.
 */
import { useCallback, useMemo, useState } from "react";
import type { Ingredient, Recipe } from "../types";
import type { Lang } from "./i18n";

export interface EditableIngredient {
  name: string;
  amount: string;
  note: string;
}

/** 한 언어에서 바뀐 필드만. 없는 키는 "안 고쳤다"는 뜻이다. */
export interface FieldPatch {
  name?: string;
  cookTime?: string;
  garnish?: string;
  ingredients?: EditableIngredient[];
  steps?: string[];
}

export interface RecipePatch {
  ko?: FieldPatch;
  en?: FieldPatch;
}

export type EditStore = Record<string, RecipePatch>;

const KEY = "everest-recipe:edits";

export function loadEdits(): EditStore {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as EditStore) : {};
  } catch {
    return {};
  }
}

function persist(edits: EditStore): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(edits));
  } catch {
    /* 저장 실패해도 화면에는 반영된 상태로 둔다 */
  }
}

// ------------------------------------------------------------------ 비교

const sameIngredients = (a: EditableIngredient[], b: EditableIngredient[]) =>
  a.length === b.length &&
  a.every((x, i) => x.name === b[i].name && x.amount === b[i].amount && x.note === b[i].note);

const sameSteps = (a: string[], b: string[]) => a.length === b.length && a.every((s, i) => s === b[i]);

/** 원본과 같아진 필드는 덮개에서 빼서, 되돌리면 흔적이 남지 않게 한다. */
function prune(draft: FieldPatch, base: FieldPatch): FieldPatch | undefined {
  const out: FieldPatch = {};
  if (draft.name !== undefined && draft.name !== base.name) out.name = draft.name;
  if (draft.cookTime !== undefined && draft.cookTime !== base.cookTime) out.cookTime = draft.cookTime;
  if (draft.garnish !== undefined && draft.garnish !== base.garnish) out.garnish = draft.garnish;
  if (draft.ingredients && !sameIngredients(draft.ingredients, base.ingredients ?? []))
    out.ingredients = draft.ingredients;
  if (draft.steps && !sameSteps(draft.steps, base.steps ?? [])) out.steps = draft.steps;
  return Object.keys(out).length ? out : undefined;
}

// ------------------------------------------------------------------ 적용

/** 그 언어의 원본 값 — 편집 폼의 출발점이자 비교 기준. */
export function baseFields(recipe: Recipe, lang: Lang): Required<FieldPatch> {
  const src = lang === "ko" ? recipe : recipe.en;
  return {
    name: lang === "ko" ? recipe.name : recipe.nameEn,
    cookTime: src.cookTime,
    garnish: src.garnish,
    ingredients: src.ingredients.map((i) => ({ name: i.name, amount: i.amount, note: i.note })),
    steps: [...src.steps],
  };
}

/** 원본 재료의 프렙 링크는 유지하고, 새로 추가된 행에는 링크가 없다. */
function mergeIngredients(base: Ingredient[], patch: EditableIngredient[]): Ingredient[] {
  return patch.map((p, i) => ({
    no: i + 1,
    name: p.name,
    amount: p.amount,
    note: p.note,
    ...(base[i]?.prepId && base[i].name === p.name ? { prepId: base[i].prepId } : {}),
  }));
}

/** 덮개를 얹은 레시피. 덮개가 없으면 원본 객체를 그대로 돌려준다. */
export function applyPatch(recipe: Recipe, patch: RecipePatch | undefined): Recipe {
  if (!patch || (!patch.ko && !patch.en)) return recipe;

  const ko = patch.ko ?? {};
  const en = patch.en ?? {};

  const ingredients = ko.ingredients ? mergeIngredients(recipe.ingredients, ko.ingredients) : recipe.ingredients;
  const steps = ko.steps ?? recipe.steps;

  return {
    ...recipe,
    name: ko.name ?? recipe.name,
    nameEn: en.name ?? recipe.nameEn,
    cookTime: ko.cookTime ?? recipe.cookTime,
    garnish: ko.garnish ?? recipe.garnish,
    ingredients,
    steps,
    en: {
      ...recipe.en,
      cookTime: en.cookTime ?? recipe.en.cookTime,
      garnish: en.garnish ?? recipe.en.garnish,
      ingredients: en.ingredients
        ? mergeIngredients(recipe.en.ingredients, en.ingredients)
        : // 한국어 쪽에서 행이 늘거나 줄었으면 영어도 길이를 맞춰 준다
          alignLength(recipe.en.ingredients, ingredients),
      steps: en.steps ?? alignSteps(recipe.en.steps, steps),
    },
  };
}

/** 한국어에서 재료 행이 늘면 영어에는 아직 번역이 없다 — 한국어 값을 그대로 보여준다. */
function alignLength(enList: Ingredient[], koList: Ingredient[]): Ingredient[] {
  if (enList.length === koList.length) return enList;
  return koList.map((k, i) => enList[i] ?? { ...k });
}

function alignSteps(enSteps: string[], koSteps: string[]): string[] {
  if (enSteps.length === koSteps.length) return enSteps;
  return koSteps.map((k, i) => enSteps[i] ?? k);
}

// ------------------------------------------------------------------ 훅

export function useEdits() {
  const [edits, setEdits] = useState<EditStore>(() => loadEdits());

  const save = useCallback((recipe: Recipe, lang: Lang, draft: FieldPatch) => {
    setEdits((prev) => {
      const next = { ...prev };
      const entry = { ...(next[recipe.id] ?? {}) };
      const kept = prune(draft, baseFields(recipe, lang));
      if (kept) entry[lang] = kept;
      else delete entry[lang];

      if (Object.keys(entry).length) next[recipe.id] = entry;
      else delete next[recipe.id];

      persist(next);
      return next;
    });
  }, []);

  const revert = useCallback((recipeId: string) => {
    setEdits((prev) => {
      const next = { ...prev };
      delete next[recipeId];
      persist(next);
      return next;
    });
  }, []);

  const revertAll = useCallback(() => {
    setEdits({});
    persist({});
  }, []);

  const count = useMemo(() => Object.keys(edits).length, [edits]);

  return { edits, save, revert, revertAll, count };
}

// ------------------------------------------------------------------ 내보내기

export interface EditExport {
  format: "everest-recipe-edits";
  version: 1;
  exportedAt: string;
  by: string;
  edits: EditStore;
}

export function buildExport(edits: EditStore, by: string): EditExport {
  return {
    format: "everest-recipe-edits",
    version: 1,
    exportedAt: new Date().toISOString(),
    by,
    edits,
  };
}

/** 브라우저에 파일로 내려준다. file:// 로 연 단일 파일에서도 동작한다. */
export function downloadExport(data: EditExport): string {
  const stamp = data.exportedAt.slice(0, 10);
  const filename = `recipe-edits-${stamp}.json`;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return filename;
}
