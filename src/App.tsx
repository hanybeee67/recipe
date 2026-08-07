import { useCallback, useEffect, useMemo, useState } from "react";
import rawRecipes from "./data/recipes.json";
import { DetailView } from "./components/DetailView";
import { Header } from "./components/Header";
import { ListView } from "./components/ListView";
import { PrintView } from "./components/PrintView";
import { assetUrl } from "./lib/assets";
import { listHref, useRoute } from "./lib/router";
import { applyFilters, buildIndex } from "./lib/search";
import { useTheme } from "./lib/storage";
import { EMPTY_FILTERS, type Recipe } from "./types";

const RECIPES = rawRecipes as Recipe[];

export default function App() {
  const route = useRoute();
  const { theme, cycle } = useTheme();
  const [selected, setSelected] = useState<string[]>([]);

  const index = useMemo(() => buildIndex(RECIPES), []);
  const byId = useMemo(() => new Map(RECIPES.map((r) => [r.id, r])), []);
  const hits = useMemo(() => applyFilters(index, route.filters), [index, route.filters]);
  const siblings = useMemo(() => hits.map((h) => h.recipe), [hits]);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const clearSelection = useCallback(() => setSelected([]), []);

  const selectAll = useCallback((ids: string[]) => {
    setSelected((prev) => [...new Set([...prev, ...ids])]);
  }, []);

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
    const list = route.ids.map((id) => byId.get(id)).filter((r): r is Recipe => Boolean(r));
    return <PrintView recipes={list} backHref={listHref(EMPTY_FILTERS)} />;
  }

  return (
    <>
      <a className="skip-link" href="#main">
        본문으로 건너뛰기
      </a>

      <Header theme={theme} onCycleTheme={cycle} homeHref={listHref(EMPTY_FILTERS)} />

      <main className="page" id="main">
        {route.name === "detail" ? (
          <DetailView recipe={byId.get(route.id)} filters={route.filters} siblings={siblings} />
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
          />
        )}

        <footer className="footer">
          <span>© {new Date().getFullYear()} Everest Restaurant Group</span>
          <span>레시피 {RECIPES.length}건</span>
          <span>데이터 출처: 에베레스트_레시피_v3.xlsx</span>
        </footer>
      </main>
    </>
  );
}
