/**
 * 매니저 수정분.
 *
 * 원본(recipes/*.md)은 건드리지 않고, 바뀐 필드만 덮개(patch)로 들고 있다가
 * 화면에 얹는다. 그래서 나중에 원본 엑셀을 다시 변환해도 수정분이 살아남는다.
 *
 * 저장은 이 기기의 localStorage 다. 다른 사람 화면에 반영하려면 「내보내기」로
 * 파일을 받아 저장소에 넣고 `npm run apply-edits` 를 돌려야 한다.
 */
import { useCallback, useState } from "react";
import type { Group, Ingredient, Recipe } from "../types";
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

/**
 * 매니저가 새로 만든 메뉴.
 *
 * 한국어로 입력받고, 영어는 메뉴명·세부 분류만 함께 받는다. 재료·조리 단계의 영어는
 * 처음엔 한국어와 같은 값으로 두고, EN 으로 바꿔 편집 폼에서 채우게 한다.
 * (여기서 한국어를 그대로 영어 사전에 밀어 넣으면 영어 화면이 망가지므로,
 *  `npm run apply-edits` 는 아직 한국어인 값을 번역 누락으로 잡아낸다.)
 */
export interface NewRecipe {
  id: string;
  group: Group;
  groupEn: string;
  category: string;
  categoryEn: string;
  order: number;
  /** data: URI. 사진을 안 넣었으면 null */
  image: string | null;
  ko: NewRecipeSide;
  en: NewRecipeSide;
}

export interface NewRecipeSide {
  name: string;
  cookTime: string;
  ingredients: EditableIngredient[];
  steps: string[];
  garnish: string;
}

/** 이 기기(또는 파일)가 들고 있는 변경 전체. */
export interface EditBundle {
  patches: EditStore;
  added: NewRecipe[];
  deleted: string[];
}

export const EMPTY_BUNDLE: EditBundle = { patches: {}, added: [], deleted: [] };

export const bundleCount = (b: EditBundle) =>
  Object.keys(b.patches).length + b.added.length + b.deleted.length;

/** 예전 파일은 덮개만 담은 평평한 객체였다 — 그 형태도 그대로 읽는다. */
function asBundle(raw: unknown): EditBundle {
  if (!raw || typeof raw !== "object") return { ...EMPTY_BUNDLE };
  const o = raw as Partial<EditBundle> & EditStore;
  if (o.patches || o.added || o.deleted) {
    return {
      patches: o.patches ?? {},
      added: Array.isArray(o.added) ? o.added : [],
      deleted: Array.isArray(o.deleted) ? o.deleted : [],
    };
  }
  return { patches: raw as EditStore, added: [], deleted: [] };
}

const KEY = "everest-recipe:edits";

declare global {
  interface Window {
    /** 「수정본 저장」으로 만들어진 파일에 박혀 오는, 이미 발행된 변경분 */
    __EVEREST_SEED__?: unknown;
  }
}

/**
 * 발행된 변경분. 매니저가 저장해 나눠 준 파일에서 온다.
 * 받은 사람에게는 이것이 곧 "원본"이므로 수정 배지도, 대기 건수도 붙지 않는다.
 */
export const SEED: EditBundle = (() => {
  try {
    return asBundle(window.__EVEREST_SEED__);
  } catch {
    return { ...EMPTY_BUNDLE };
  }
})();

function mergePatch(a: RecipePatch | undefined, b: RecipePatch | undefined): RecipePatch | undefined {
  if (!a) return b;
  if (!b) return a;
  const out: RecipePatch = {};
  if (a.ko || b.ko) out.ko = { ...a.ko, ...b.ko };
  if (a.en || b.en) out.en = { ...a.en, ...b.en };
  return out;
}

/** 발행분 위에 이 기기의 변경분을 얹은 것 — 저장·내보내기가 담는 전체 내용. */
export function mergeBundles(base: EditBundle, extra: EditBundle): EditBundle {
  const patches: EditStore = { ...base.patches };
  for (const [id, patch] of Object.entries(extra.patches)) {
    const merged = mergePatch(patches[id], patch);
    if (merged) patches[id] = merged;
  }

  // 같은 id 가 겹치면 나중 것(이 기기)이 이긴다.
  const byId = new Map(base.added.map((r) => [r.id, r]));
  for (const r of extra.added) byId.set(r.id, r);

  return {
    patches,
    added: [...byId.values()],
    deleted: [...new Set([...base.deleted, ...extra.deleted])],
  };
}

export function loadEdits(): EditStore {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as EditStore) : {};
  } catch {
    return {};
  }
}

function persist(bundle: EditBundle): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(bundle));
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

// -------------------------------------------------- 새 메뉴 -> Recipe

/** "약 10~15분" 에서 정렬용 분 단위를 뽑는다. 못 읽으면 0(제한 없음)으로 둔다. */
export function parseCookTime(text: string): [number, number] {
  const range = /(\d+)\s*~\s*(\d+)/.exec(text);
  if (range) return [Number(range[1]), Number(range[2])];
  const single = /(\d+)/.exec(text);
  return single ? [Number(single[1]), Number(single[1])] : [0, 0];
}

const numbered = (rows: EditableIngredient[]): Ingredient[] =>
  rows.map((r, i) => ({ no: i + 1, name: r.name, amount: r.amount, note: r.note }));

export function toRecipe(n: NewRecipe): Recipe {
  const [min, max] = parseCookTime(n.ko.cookTime);
  return {
    id: n.id,
    name: n.ko.name,
    nameEn: n.en.name,
    category: n.category,
    group: n.group,
    serving: "1인분 기준",
    cookTime: n.ko.cookTime,
    cookTimeMin: min,
    cookTimeMax: max,
    image: n.image,
    imageNote: null,
    order: n.order,
    tags: [],
    ingredients: numbered(n.ko.ingredients),
    steps: [...n.ko.steps],
    garnish: n.ko.garnish,
    en: {
      group: n.groupEn,
      category: n.categoryEn,
      imageNote: null,
      serving: "Per 1 serving",
      cookTime: n.en.cookTime,
      tags: [],
      ingredients: numbered(n.en.ingredients),
      steps: [...n.en.steps],
      garnish: n.en.garnish,
    },
  };
}

/** 원본 + 변경분 = 화면·검색·PDF 가 보는 최종 목록. 메뉴판 순서로 정렬해 돌려준다. */
export function composeRecipes(base: Recipe[], bundle: EditBundle): Recipe[] {
  const deleted = new Set(bundle.deleted);
  const out = base
    .filter((r) => !deleted.has(r.id))
    .map((r) => applyPatch(r, bundle.patches[r.id]));

  for (const item of bundle.added) {
    if (deleted.has(item.id)) continue;
    out.push(applyPatch(toRecipe(item), bundle.patches[item.id]));
  }

  return out.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "ko"));
}

/** 새 메뉴의 id — 영문명에서 만들고, 이미 쓰는 id 면 뒤에 숫자를 붙인다. */
export function makeId(nameEn: string, taken: Set<string>): string {
  const base =
    nameEn
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "new-menu";
  if (!taken.has(base)) return base;
  for (let i = 2; ; i += 1) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** 새 메뉴를 그 대분류의 맨 뒤에 놓기 위한 order 값. */
export function nextOrder(recipes: Recipe[], group: Group): number {
  const inGroup = recipes.filter((r) => r.group === group);
  if (inGroup.length === 0) {
    // 그 분류에 아직 메뉴가 없으면 전체 뒤에 붙인다.
    return Math.max(0, ...recipes.map((r) => r.order)) + 1;
  }
  return Math.max(...inGroup.map((r) => r.order)) + 1;
}

// ------------------------------------------------------------------ 훅

export function useEdits() {
  const [bundle, setBundle] = useState<EditBundle>(() => {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? asBundle(JSON.parse(raw)) : { ...EMPTY_BUNDLE };
    } catch {
      return { ...EMPTY_BUNDLE };
    }
  });

  const update = useCallback((change: (prev: EditBundle) => EditBundle) => {
    setBundle((prev) => {
      const next = change(prev);
      persist(next);
      return next;
    });
  }, []);

  const save = useCallback(
    (recipe: Recipe, lang: Lang, draft: FieldPatch) => {
      update((prev) => {
        const patches = { ...prev.patches };
        const entry = { ...(patches[recipe.id] ?? {}) };
        const kept = prune(draft, baseFields(recipe, lang));
        if (kept) entry[lang] = kept;
        else delete entry[lang];

        if (Object.keys(entry).length) patches[recipe.id] = entry;
        else delete patches[recipe.id];
        return { ...prev, patches };
      });
    },
    [update]
  );

  /** 되돌리기 — 이 기기에서 새로 만든 메뉴라면 통째로 없앤다. */
  const revert = useCallback(
    (recipeId: string) => {
      update((prev) => {
        const patches = { ...prev.patches };
        delete patches[recipeId];
        return {
          patches,
          added: prev.added.filter((r) => r.id !== recipeId),
          deleted: prev.deleted.filter((id) => id !== recipeId),
        };
      });
    },
    [update]
  );

  const revertAll = useCallback(() => update(() => ({ ...EMPTY_BUNDLE })), [update]);

  const addRecipe = useCallback(
    (recipe: NewRecipe) => update((prev) => ({ ...prev, added: [...prev.added, recipe] })),
    [update]
  );

  /**
   * 메뉴 삭제. 이 기기에서 방금 만든 메뉴면 목록에서 빼기만 하면 되고,
   * 원래 있던 메뉴면 삭제 목록에 올린다 (복구할 수 있게 원본은 건드리지 않는다).
   */
  const removeRecipe = useCallback(
    (recipeId: string) => {
      update((prev) => {
        if (prev.added.some((r) => r.id === recipeId)) {
          const patches = { ...prev.patches };
          delete patches[recipeId];
          return { ...prev, patches, added: prev.added.filter((r) => r.id !== recipeId) };
        }
        if (prev.deleted.includes(recipeId)) return prev;
        return { ...prev, deleted: [...prev.deleted, recipeId] };
      });
    },
    [update]
  );

  const restoreRecipe = useCallback(
    (recipeId: string) =>
      update((prev) => ({ ...prev, deleted: prev.deleted.filter((id) => id !== recipeId) })),
    [update]
  );

  return {
    bundle,
    save,
    revert,
    revertAll,
    addRecipe,
    removeRecipe,
    restoreRecipe,
    count: bundleCount(bundle),
  };
}

// ------------------------------------------------------------------ 내보내기

export interface EditExport {
  format: "everest-recipe-edits";
  version: 2;
  exportedAt: string;
  by: string;
  edits: EditStore;
  added: NewRecipe[];
  deleted: string[];
}

export function buildExport(bundle: EditBundle, by: string): EditExport {
  return {
    format: "everest-recipe-edits",
    version: 2,
    exportedAt: new Date().toISOString(),
    by,
    edits: bundle.patches,
    added: bundle.added,
    deleted: bundle.deleted,
  };
}

/** 브라우저에 파일로 내려준다. file:// 로 연 단일 파일에서도 동작한다. */
function download(filename: string, blob: Blob): string {
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

export function downloadExport(data: EditExport): string {
  return download(
    `recipe-edits-${data.exportedAt.slice(0, 10)}.json`,
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
  );
}

const today = () => new Date().toISOString().slice(0, 10);

/** 인라인 <script> 안에서 태그가 일찍 닫히지 않도록 '<' 를 이스케이프한다. */
const inlineJson = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");

/**
 * 수정 내용을 박아 넣은 **새 단일 HTML 파일**을 저장한다.
 *
 * 이게 일반 사용자용 저장 경로다. 받은 사람은 더블클릭만 하면 고쳐진 내용을 본다 —
 * 저장소도, 명령어도, 서버도 필요 없다.
 *
 * 단일 파일에서는 지금 열려 있는 문서를 복제해 쓰고, 배포 사이트에서는 같은 폴더의
 * 단일 파일을 받아와 쓴다. 어느 쪽이든 결과물은 외부 요청이 없는 자기완결 파일이다.
 *
 * 문자열을 잘라 붙이지 않고 DOM 으로 다룬다. 번들 JS 안에도 "</head>" 같은 문자열이
 * 들어 있어서, 텍스트로 찾으면 자바스크립트 한복판에 끼워 넣게 된다.
 */
export async function saveStandalone(published: EditBundle): Promise<string> {
  let doc: Document;

  if (__STANDALONE__) {
    // file:// 에서는 fetch 가 막히므로 열려 있는 문서를 복제한다.
    doc = document.cloneNode(true) as Document;
  } else {
    const res = await fetch(new URL("everest-recipe-book.html", location.href));
    if (!res.ok) throw new Error(`앱 파일을 받지 못했습니다 (${res.status})`);
    doc = new DOMParser().parseFromString(await res.text(), "text/html");
  }

  const root = doc.getElementById("root");
  if (root) root.innerHTML = "";
  // 이전에 박아 둔 발행분은 걷어내고 새것으로 갈아 끼운다.
  doc.querySelectorAll("script[data-everest-seed]").forEach((tag) => tag.remove());
  // 만든 사람의 테마·언어 선택이 파일에 굳지 않도록 지운다.
  doc.documentElement.removeAttribute("data-theme");
  doc.documentElement.setAttribute("lang", "ko");

  const seed = doc.createElement("script");
  seed.setAttribute("data-everest-seed", "1");
  seed.textContent = `window.__EVEREST_SEED__=${inlineJson(published)};`;
  doc.head.appendChild(seed);

  const html = `<!doctype html>\n${doc.documentElement.outerHTML}\n`;
  return download(`everest-recipe-book-${today()}.html`, new Blob([html], { type: "text/html" }));
}

// ------------------------------------------------------------------ 사진

/**
 * 고른 사진을 data URI 로 바꾼다.
 *
 * 원본을 그대로 넣으면 몇 MB 짜리가 붙어 localStorage 한도(약 5MB)를 넘기고 저장 파일도
 * 무거워진다. 긴 변 900px, JPEG 82% 로 줄이면 대체로 100KB 안쪽이 된다.
 */
export function readPhoto(file: File, maxSide = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("사진을 읽지 못했습니다"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("사진 형식을 알아보지 못했습니다"));
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("사진을 줄이지 못했습니다"));
        // 요리 사진은 흰 배경 컷아웃이라 투명 부분을 흰색으로 채운다.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
