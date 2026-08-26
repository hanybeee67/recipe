import { useCallback, useEffect, useMemo, useState } from "react";
import rawRecipes from "./data/recipes.json";
import { DetailView } from "./components/DetailView";
import { EditBar } from "./components/EditBar";
import { Header } from "./components/Header";
import { ListView } from "./components/ListView";
import { LoginDialog } from "./components/LoginDialog";
import { PrintView } from "./components/PrintView";
import { assetUrl } from "./lib/assets";
import { useAuth } from "./lib/auth";
import { SEED, applyPatch, mergeStores, useEdits } from "./lib/edits";
import { localize, useLang } from "./lib/i18n";
import { listHref, useRoute } from "./lib/router";
import { applyFilters, buildIndex } from "./lib/search";
import { useTheme } from "./lib/storage";
import { EMPTY_FILTERS, type Recipe } from "./types";

const BASE_RECIPES = rawRecipes as Recipe[];

export default function App() {
  const route = useRoute();
  const { theme, cycle } = useTheme();
  const { lang, setLang, t } = useLang();
  const { manager, signIn, signOut, canEdit } = useAuth();
  const { edits, save: saveEdit, revert, revertAll, count: editCount } = useEdits();
  const [selected, setSelected] = useState<string[]>([]);
  const [loginOpen, setLoginOpen] = useState(false);

  /**
   * 발행분(파일에 박혀 온 수정분)까지 얹은 것이 "이 파일 기준의 원본"이다.
   * 받은 사람에게는 이게 그냥 레시피이므로 수정 배지도 붙지 않는다.
   */
  const PUBLISHED = useMemo(
    () =>
      Object.keys(SEED).length === 0
        ? BASE_RECIPES
        : BASE_RECIPES.map((r) => applyPatch(r, SEED[r.id])),
    []
  );

  // 그 위에 이 기기에서 방금 고친 것을 다시 얹은 값이 화면·검색·PDF가 보는 값이다.
  const RECIPES = useMemo(
    () => (editCount === 0 ? PUBLISHED : PUBLISHED.map((r) => applyPatch(r, edits[r.id]))),
    [PUBLISHED, edits, editCount]
  );

  const index = useMemo(() => buildIndex(RECIPES), [RECIPES]);
  const byId = useMemo(() => new Map(RECIPES.map((r) => [r.id, r])), [RECIPES]);
  const baseById = useMemo(() => new Map(PUBLISHED.map((r) => [r.id, r])), [PUBLISHED]);
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

  const detailId = route.name === "detail" ? route.id : undefined;

  const handleSaveEdit = useCallback(
    (draft: Parameters<typeof saveEdit>[2]) => {
      const target = detailId ? baseById.get(detailId) : undefined;
      if (target) saveEdit(target, lang, draft);
    },
    [detailId, baseById, saveEdit, lang]
  );

  const handleRevertEdit = useCallback(() => {
    if (detailId) revert(detailId);
  }, [detailId, revert]);

  // 첫 방문 시 대표 이미지를 미리 받아 두면 스크롤이 매끄럽다.
  useEffect(() => {
    if (route.name !== "list") return;
    const idle = (cb: () => void) =>
      "requestIdleCallback" in window
        ? (window as never as { requestIdleCallback: (c: () => void) => number }).requestIdleCallback(cb)
        : setTimeout(cb, 800);
    idle(() => {
      for (const recipe of PUBLISHED.slice(0, 12)) {
        const src = assetUrl(recipe.image);
        if (src) new Image().src = src;
      }
    });
  }, [route.name, PUBLISHED]);

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
        manager={manager}
        onLogin={() => setLoginOpen(true)}
        onLogout={signOut}
        t={t}
      />

      <main className="page" id="main">
        {route.name === "detail" ? (
          <DetailView
            recipe={detailRecipe ? localize(detailRecipe, lang) : undefined}
            filters={route.filters}
            siblings={siblings}
            raw={detailRecipe}
            base={detailId ? baseById.get(detailId) : undefined}
            lang={lang}
            canEdit={canEdit}
            edited={Boolean(detailId && edits[detailId])}
            onSaveEdit={handleSaveEdit}
            onRevertEdit={handleRevertEdit}
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
          {/* 단일 파일 안에서는 내려받을 대상이 자기 자신이라 링크를 감춘다. */}
          {!__STANDALONE__ && (
            <a
              className="footer__download"
              href={assetUrl("everest-recipe-book.html") ?? "#"}
              // 저장될 이름. 한글 파일명은 브라우저·OS 조합에 따라 통째로
              // 무시되고 "download" 로 떨어지는 경우가 있어 ASCII 로 둔다.
              download="everest-recipe-book.html"
            >
              ⬇ {t("footer.download")}
            </a>
          )}
        </footer>
      </main>

      {/* 로그아웃해도 이미 만든 수정분이 갇히지 않도록 막대는 남겨 둔다 */}
      {editCount > 0 && (
        <EditBar
          manager={manager}
          published={mergeStores(SEED, edits)}
          count={editCount}
          onRevertAll={revertAll}
          t={t}
        />
      )}

      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} onSubmit={signIn} t={t} />
    </>
  );
}
