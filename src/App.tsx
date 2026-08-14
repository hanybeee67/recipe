import { useCallback, useEffect, useMemo, useState } from "react";
import rawRecipes from "./data/recipes.json";
import { DetailView } from "./components/DetailView";
import { Header } from "./components/Header";
import { ListView } from "./components/ListView";
import { PrintView } from "./components/PrintView";
import { assetUrl } from "./lib/assets";
import { localize, useLang } from "./lib/i18n";
import { listHref, useRoute } from "./lib/router";
import { applyFilters, buildIndex } from "./lib/search";
import { useTheme } from "./lib/storage";
import { EMPTY_FILTERS, type Recipe } from "./types";

const RECIPES = rawRecipes as Recipe[];

export default function App() {
  const route = useRoute();
  const { theme, cycle } = useTheme();
  const { lang, setLang, t } = useLang();
  const [selected, setSelected] = useState<string[]>([]);

  const index = useMemo(() => buildIndex(RECIPES), []);
  const byId = useMemo(() => new Map(RECIPES.map((r) => [r.id, r])), []);
  const hits = useMemo(() => applyFilters(index, route.filters, lang), [index, route.filters, lang]);
  const siblings = useMemo(() => hits.map((h) => localize(h.recipe, lang)), [hits, lang]);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const clearSelection = useCallback(() => setSelected([]), []);

  const selectAll = useCallback((ids: string[]) => {
    setSelected((prev) => [...new Set([...prev, ...ids])]);
  }, []);

  const toggleLang = useCallback(() => setLang(lang === "ko" ? "en" : "ko"), [lang, setLang]);

  // 첫 방문 시 대표 이미지를 미리 받아 두면 스크롤이 매끄럽다.
  useEffect(() => {
    if (route.name !== "list") return;
    const idle = (cb: () => void) =>
      "requestIdleCallback" in window
        ? (window as never as { requestIdleCallback: (c: () => void) => number }).requestIdleCallback(cb)
        : setTimeout(cb, 800);
    idle(() => {
      for (const recipe of RECIPES.slice(0, 12)) {
        const src = assetUrl(recipe.image);
        if (src) new Image().src = src;
      }
    });
  }, [route.name]);

  if (route.name === "print") {
    const list = route.ids
      .map((id) => byId.get(id))
      .filter((r): r is Recipe => Boolean(r))
      .map((r) => localize(r, lang));
    return <PrintView recipes={list} backHref={listHref(EMPTY_FILTERS)} lang={lang} t={t} />;
  }

  const detailRecipe =
    route.name === "detail" ? byId.get(route.id) : undefined;

  return (
    <>
      <a className="skip-link" href="#main">
        {t("skip")}
      </a>

      <Header
        theme={theme}
        onCycleTheme={cycle}
        lang={lang}
        onToggleLang={toggleLang}
        homeHref={listHref(EMPTY_FILTERS)}
        t={t}
      />

      <main className="page" id="main">
        {route.name === "detail" ? (
          <DetailView
            recipe={detailRecipe ? localize(detailRecipe, lang) : undefined}
            filters={route.filters}
            siblings={siblings}
            t={t}
          />
        ) : (
          <ListView
            recipes={RECIPES}
            index={index}
            filters={route.filters}
            hits={hits}
            selected={selected}
            onToggleSelect={toggleSelect}
            onClearSelection={clearSelection}
            onSelectAll={selectAll}
            lang={lang}
            t={t}
          />
        )}

        <footer className="footer">
          <span>© {new Date().getFullYear()} Everest Restaurant Group</span>
          <span>{t("footer.recipes", { n: RECIPES.length })}</span>
          <span>{t("footer.source")}</span>
        </footer>
      </main>
    </>
  );
}
