import { useCallback, useEffect, useState } from "react";
import ko from "../../i18n/ko/ui.json";
import en from "../../i18n/en/ui.json";
import type { Recipe, LocalizedRecipe } from "../types";

export const LANGS = ["ko", "en"] as const;
export type Lang = (typeof LANGS)[number];

const DICTS: Record<Lang, Record<string, string>> = { ko, en };
const STORAGE_KEY = "everest-recipe:lang";

export function isLang(value: string | null): value is Lang {
  return value === "ko" || value === "en";
}

/** URL(?lang=) > 저장값 > 브라우저 언어 > ko */
function detectLang(): Lang {
  const fromUrl = new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("lang");
  if (isLang(fromUrl)) return fromUrl;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLang(saved)) return saved;
  } catch {
    /* 저장소 접근 불가 — 무시 */
  }
  return navigator.language?.toLowerCase().startsWith("ko") ? "ko" : "en";
}

export type Translate = (key: string, vars?: Record<string, string | number>) => string;

export function useLang() {
  const [lang, setLangState] = useState<Lang>(() => detectLang());

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* 무시 */
    }
  }, [lang]);

  // 뒤로가기 등으로 ?lang= 이 바뀌면 따라간다
  useEffect(() => {
    const onHash = () => {
      const fromUrl = new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("lang");
      if (isLang(fromUrl)) setLangState(fromUrl);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const t = useCallback<Translate>(
    (key, vars) => {
      const raw = DICTS[lang][key] ?? DICTS.ko[key] ?? key;
      if (!vars) return raw;
      return raw.replace(/\{(\w+)\}/g, (whole, name: string) =>
        name in vars ? String(vars[name]) : whole
      );
    },
    [lang]
  );

  const setLang = useCallback((next: Lang) => setLangState(next), []);

  return { lang, setLang, t };
}

/** 레시피를 선택한 언어의 평평한 형태로 바꾼다. 화면·인쇄가 모두 이것만 본다. */
export function localize(recipe: Recipe, lang: Lang): LocalizedRecipe {
  if (lang === "ko") {
    return {
      ...recipe,
      title: recipe.name,
      subtitle: recipe.nameEn,
      groupKey: recipe.group,
      categoryKey: recipe.category,
      category: recipe.category,
      group: recipe.group,
      serving: recipe.serving,
      cookTime: recipe.cookTime,
      tags: recipe.tags,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      garnish: recipe.garnish,
    };
  }
  return {
    ...recipe,
    title: recipe.nameEn || recipe.name,
    subtitle: recipe.name,
    groupKey: recipe.group,
    categoryKey: recipe.category,
    category: recipe.en.category,
    group: recipe.en.group,
    serving: recipe.en.serving,
    cookTime: recipe.en.cookTime,
    tags: recipe.en.tags,
    ingredients: recipe.en.ingredients,
    steps: recipe.en.steps,
    garnish: recipe.en.garnish,
    imageNote: recipe.en.imageNote,
    usedIn: recipe.usedIn?.map((u) => ({ ...u, name: u.nameEn || u.name })),
  };
}
