import { useEffect, useMemo, useRef, useState } from "react";
import { applyFilters, commonIngredients, type SearchHit, type SearchIndexEntry } from "../lib/search";
import { localize, type Lang, type Translate } from "../lib/i18n";
import { hasActiveFilters, listHref, navigate } from "../lib/router";
import { EMPTY_FILTERS, GROUPS, type Filters, type Group, type Recipe, type SortKey } from "../types";
import { RecipeCard } from "./RecipeCard";

const TIME_OPTIONS = [
  { key: "time.all", value: 0 },
  { key: "time.under5", value: 5 },
  { key: "time.under8", value: 8 },
  { key: "time.under10", value: 10 },
];

const SORT_KEYS: SortKey[] = ["menu", "name", "time", "ingredients"];

interface Props {
  recipes: Recipe[];
  index: SearchIndexEntry[];
  filters: Filters;
  hits: SearchHit[];
  selected: string[];
  onToggleSelect: (id: string) => void;
  onClearSelection: () => void;
  onSelectAll: (ids: string[]) => void;
  lang: Lang;
  canEdit: boolean;
  onAddRecipe: () => void;
  t: Translate;
}

export function ListView({
  recipes,
  index,
  filters,
  canEdit,
  onAddRecipe,
  hits,
  selected,
  onToggleSelect,
  onClearSelection,
  onSelectAll,
  lang,
  t,
}: Props) {
  const [draftQuery, setDraftQuery] = useState(filters.q);
  const [panelOpen, setPanelOpen] = useState(false);
  const [stuck, setStuck] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  // URL -> 입력창 (뒤로가기 등 외부 변경 반영)
  useEffect(() => setDraftQuery(filters.q), [filters.q]);

  // 입력창 -> URL (디바운스 150ms)
  useEffect(() => {
    if (draftQuery === filters.q) return;
    const timer = setTimeout(() => {
      navigate(listHref({ ...filters, q: draftQuery }), true);
    }, 150);
    return () => clearTimeout(timer);
  }, [draftQuery, filters]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting), {
      threshold: 1,
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const update = (patch: Partial<Filters>) => navigate(listHref({ ...filters, ...patch }));

  const toggleIn = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  /** 원본(한국어) 분류값 -> 화면 표시용 라벨. 데이터에서 직접 만든다. */
  const labels = useMemo(() => {
    const group = new Map<string, string>();
    const category = new Map<string, string>();
    for (const r of recipes) {
      group.set(r.group, lang === "en" ? r.en.group : r.group);
      category.set(r.category, lang === "en" ? r.en.category : r.category);
    }
    return { group, category };
  }, [recipes, lang]);

  // 대분류 탭 개수는 "대분류를 제외한 나머지 조건" 기준으로 센다.
  const groupCounts = useMemo(() => {
    const base = applyFilters(index, { ...filters, group: "전체" }, lang);
    const counts: Record<string, number> = { 전체: base.length };
    for (const g of GROUPS) counts[g] = 0;
    for (const hit of base) counts[hit.recipe.group] += 1;
    return counts;
  }, [index, filters, lang]);

  // 세부 카테고리 후보는 현재 대분류 안에서만, 메뉴판 순서대로 보여준다.
  const categoryOptions = useMemo(() => {
    const pool = filters.group === "전체" ? recipes : recipes.filter((r) => r.group === filters.group);
    return [...new Set([...pool].sort((a, b) => a.order - b.order).map((r) => r.category))];
  }, [recipes, filters.group]);

  const excludeOptions = useMemo(() => commonIngredients(recipes, lang), [recipes, lang]);

  const active = hasActiveFilters(filters);
  const detailFilterCount =
    filters.categories.length + filters.exclude.length + (filters.maxTime ? 1 : 0);

  const visibleIds = hits.map((h) => h.recipe.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));

  return (
    <>
      <section className="hero">
        <p className="hero__eyebrow">{t("hero.eyebrow")}</p>
        <h1 className="hero__title">
          {t("hero.titleA")} <em>{t("hero.titleB", { n: recipes.length })}</em>
          <br />
          {t("hero.titleC")}
        </h1>
        <p className="hero__desc">{t("hero.desc")}</p>
      </section>

      <div className="searchbar">
        <span className="searchbar__icon" aria-hidden="true">
          🔍
        </span>
        <input
          id="search"
          className="searchbar__input"
          type="search"
          value={draftQuery}
          onChange={(e) => setDraftQuery(e.target.value)}
          placeholder={t("search.placeholder")}
          aria-label={t("search.label")}
          autoComplete="off"
        />
        {draftQuery && (
          <button
            type="button"
            className="searchbar__clear"
            onClick={() => setDraftQuery("")}
            aria-label={t("search.clear")}
          >
            <span aria-hidden="true">✕</span>
          </button>
        )}
      </div>

      <div ref={sentinel} aria-hidden="true" />

      <div className={`toolbar${stuck ? " toolbar--stuck" : ""}`}>
        <div className="tabs" role="group" aria-label={t("filter.groupLabel")}>
          {(["전체", ...GROUPS] as const).map((group) => (
            <button
              key={group}
              type="button"
              className="tab"
              aria-pressed={filters.group === group}
              onClick={() => update({ group: group as Group | "전체", categories: [] })}
            >
              {group === "전체" ? t("filter.all") : labels.group.get(group) ?? group}
              <span className="tab__count">{groupCounts[group] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="toolbar__row">
          <p className="result-count" aria-live="polite">
            {t("list.count", { n: hits.length })}
            {active && t("filter.applied")}
          </p>

          {canEdit && (
            <button type="button" className="btn btn--sm btn--primary" onClick={onAddRecipe}>
              ＋ {t("add.button")}
            </button>
          )}

          <button
            type="button"
            className="btn btn--sm filter-toggle"
            aria-expanded={panelOpen}
            onClick={() => setPanelOpen((v) => !v)}
          >
            {detailFilterCount > 0 && <span className="filter-toggle__dot" aria-hidden="true" />}
            {t("filter.detail")}
            {detailFilterCount > 0 && ` ${detailFilterCount}`}
          </button>

          <label className="visually-hidden" htmlFor="sort">
            {t("sort.label")}
          </label>
          <select
            id="sort"
            className="select"
            value={filters.sort}
            onChange={(e) => update({ sort: e.target.value as SortKey })}
          >
            {SORT_KEYS.map((key) => (
              <option key={key} value={key}>
                {t(`sort.${key}`)}
              </option>
            ))}
          </select>

          {active && (
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() => navigate(listHref(EMPTY_FILTERS))}
            >
              {t("filter.reset")}
            </button>
          )}
        </div>

        {panelOpen && (
          <div className="panel">
            <div className="panel__group">
              <p className="panel__label">{t("filter.categories")}</p>
              <div className="chips">
                {categoryOptions.map((category) => (
                  <button
                    key={category}
                    type="button"
                    className="chip"
                    aria-pressed={filters.categories.includes(category)}
                    onClick={() => update({ categories: toggleIn(filters.categories, category) })}
                  >
                    {labels.category.get(category) ?? category}
                  </button>
                ))}
              </div>
            </div>

            <div className="panel__group">
              <p className="panel__label">{t("filter.time")}</p>
              <div className="chips">
                {TIME_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className="chip"
                    aria-pressed={filters.maxTime === option.value}
                    onClick={() => update({ maxTime: option.value })}
                  >
                    {t(option.key)}
                  </button>
                ))}
              </div>
            </div>

            <div className="panel__group">
              <p className="panel__label">{t("filter.exclude")}</p>
              <div className="chips">
                {excludeOptions.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="chip chip--danger"
                    aria-pressed={filters.exclude.includes(name)}
                    onClick={() => update({ exclude: toggleIn(filters.exclude, name) })}
                  >
                    {filters.exclude.includes(name) ? "🚫 " : ""}
                    {name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {hits.length === 0 ? (
        <div className="empty">
          <p className="empty__icon" aria-hidden="true">
            🍽️
          </p>
          <p className="empty__title">{t("empty.title")}</p>
          <p className="empty__desc">{t("empty.desc")}</p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => navigate(listHref(EMPTY_FILTERS))}
          >
            {t("empty.reset")}
          </button>
        </div>
      ) : (
        <div className="grid">
          {hits.map((hit) => (
            <RecipeCard
              key={hit.recipe.id}
              recipe={localize(hit.recipe, lang)}
              filters={filters}
              matchedIngredients={hit.matchedIngredients}
              selected={selected.includes(hit.recipe.id)}
              onToggleSelect={onToggleSelect}
              t={t}
            />
          ))}
        </div>
      )}

      {selected.length > 0 && (
        <div className="selectionbar no-print">
          <span className="selectionbar__count">{t("select.count", { n: selected.length })}</span>
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => (allVisibleSelected ? onClearSelection() : onSelectAll(visibleIds))}
          >
            {allVisibleSelected ? t("select.clear") : t("select.all", { n: hits.length })}
          </button>
          <a className="btn btn--sm btn--primary" href={`#/print?ids=${selected.join(",")}`}>
            📄 {t("select.export")}
          </a>
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={onClearSelection}
            aria-label={t("select.clear")}
            style={{ color: "inherit" }}
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
