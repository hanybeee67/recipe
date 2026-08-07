import { useEffect, useMemo, useRef, useState } from "react";
import { commonIngredients, type SearchHit, type SearchIndexEntry } from "../lib/search";
import { applyFilters } from "../lib/search";
import { hasActiveFilters, listHref, navigate } from "../lib/router";
import { EMPTY_FILTERS, GROUPS, type Filters, type Group, type Recipe, type SortKey } from "../types";
import { RecipeCard } from "./RecipeCard";

const TIME_OPTIONS = [
  { label: "전체", value: 0 },
  { label: "5분 이내", value: 5 },
  { label: "8분 이내", value: 8 },
  { label: "10분 이내", value: 10 },
];

const SORT_LABEL: Record<SortKey, string> = {
  name: "이름순",
  time: "조리시간 짧은순",
  ingredients: "재료 적은순",
};

interface Props {
  recipes: Recipe[];
  index: SearchIndexEntry[];
  filters: Filters;
  hits: SearchHit[];
  selected: string[];
  onToggleSelect: (id: string) => void;
  onClearSelection: () => void;
  onSelectAll: (ids: string[]) => void;
}

export function ListView({
  recipes,
  index,
  filters,
  hits,
  selected,
  onToggleSelect,
  onClearSelection,
  onSelectAll,
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

  // 대분류 탭 개수는 "대분류를 제외한 나머지 조건" 기준으로 센다.
  const groupCounts = useMemo(() => {
    const base = applyFilters(index, { ...filters, group: "전체" });
    const counts: Record<string, number> = { 전체: base.length };
    for (const g of GROUPS) counts[g] = 0;
    for (const hit of base) counts[hit.recipe.group] += 1;
    return counts;
  }, [index, filters]);

  // 세부 카테고리 후보는 현재 대분류 안에서만 보여준다.
  const categoryOptions = useMemo(() => {
    const pool = filters.group === "전체" ? recipes : recipes.filter((r) => r.group === filters.group);
    return [...new Set(pool.map((r) => r.category))].sort((a, b) => a.localeCompare(b, "ko"));
  }, [recipes, filters.group]);

  const excludeOptions = useMemo(() => commonIngredients(recipes), [recipes]);

  const active = hasActiveFilters(filters);
  const detailFilterCount =
    filters.categories.length + filters.exclude.length + (filters.maxTime ? 1 : 0);

  const visibleIds = hits.map((h) => h.recipe.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));

  return (
    <>
      <section className="hero">
        <p className="hero__eyebrow">Everest Restaurant Group</p>
        <h1 className="hero__title">
          주방의 <em>{recipes.length}가지</em> 레시피,
          <br />
          한 손에.
        </h1>
        <p className="hero__desc">
          네팔·인도 요리 전 메뉴의 재료·계량·조리 순서를 그대로 담았습니다. 메뉴명은 물론 재료명과
          초성으로도 찾을 수 있고, 필요한 만큼 골라 PDF로 인쇄할 수 있습니다.
        </p>
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
          placeholder="메뉴명 · 재료명 · 초성으로 검색 (예: 감자, ㅊㅋ, paneer)"
          aria-label="레시피 검색"
          autoComplete="off"
        />
        {draftQuery && (
          <button
            type="button"
            className="searchbar__clear"
            onClick={() => setDraftQuery("")}
            aria-label="검색어 지우기"
          >
            <span aria-hidden="true">✕</span>
          </button>
        )}
      </div>

      <div ref={sentinel} aria-hidden="true" />

      <div className={`toolbar${stuck ? " toolbar--stuck" : ""}`}>
        <div className="tabs" role="group" aria-label="대분류 필터">
          {(["전체", ...GROUPS] as const).map((group) => (
            <button
              key={group}
              type="button"
              className="tab"
              aria-pressed={filters.group === group}
              onClick={() => update({ group: group as Group | "전체", categories: [] })}
            >
              {group}
              <span className="tab__count">{groupCounts[group] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="toolbar__row">
          <p className="result-count" aria-live="polite">
            <strong>{hits.length}</strong>개 레시피
            {active && " (필터 적용됨)"}
          </p>

          <button
            type="button"
            className="btn btn--sm filter-toggle"
            aria-expanded={panelOpen}
            onClick={() => setPanelOpen((v) => !v)}
          >
            {detailFilterCount > 0 && <span className="filter-toggle__dot" aria-hidden="true" />}
            상세 필터
            {detailFilterCount > 0 && ` ${detailFilterCount}`}
          </button>

          <label className="visually-hidden" htmlFor="sort">
            정렬
          </label>
          <select
            id="sort"
            className="select"
            value={filters.sort}
            onChange={(e) => update({ sort: e.target.value as SortKey })}
          >
            {(Object.keys(SORT_LABEL) as SortKey[]).map((key) => (
              <option key={key} value={key}>
                {SORT_LABEL[key]}
              </option>
            ))}
          </select>

          {active && (
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() => navigate(listHref(EMPTY_FILTERS))}
            >
              초기화
            </button>
          )}
        </div>

        {panelOpen && (
          <div className="panel">
            <div className="panel__group">
              <p className="panel__label">세부 카테고리</p>
              <div className="chips">
                {categoryOptions.map((category) => (
                  <button
                    key={category}
                    type="button"
                    className="chip"
                    aria-pressed={filters.categories.includes(category)}
                    onClick={() => update({ categories: toggleIn(filters.categories, category) })}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            <div className="panel__group">
              <p className="panel__label">조리 시간</p>
              <div className="chips">
                {TIME_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className="chip"
                    aria-pressed={filters.maxTime === option.value}
                    onClick={() => update({ maxTime: option.value })}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="panel__group">
              <p className="panel__label">이 재료를 뺀 레시피만 (알레르기 · 채식 대응)</p>
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
          <p className="empty__title">조건에 맞는 레시피가 없습니다</p>
          <p className="empty__desc">
            검색어를 줄이거나 필터를 해제해 보세요. 초성 검색(예: <code>ㅊㅋ</code>)과 재료명
            검색(예: <code>감자</code>)도 지원합니다.
          </p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => navigate(listHref(EMPTY_FILTERS))}
          >
            필터 초기화
          </button>
        </div>
      ) : (
        <div className="grid">
          {hits.map((hit) => (
            <RecipeCard
              key={hit.recipe.id}
              recipe={hit.recipe}
              filters={filters}
              matchedIngredients={hit.matchedIngredients}
              selectable
              selected={selected.includes(hit.recipe.id)}
              onToggleSelect={onToggleSelect}
            />
          ))}
        </div>
      )}

      {selected.length > 0 && (
        <div className="selectionbar no-print">
          <span className="selectionbar__count">
            <strong>{selected.length}</strong>개 선택됨
          </span>
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => (allVisibleSelected ? onClearSelection() : onSelectAll(visibleIds))}
          >
            {allVisibleSelected ? "선택 해제" : `현재 ${hits.length}개 모두`}
          </button>
          <a className="btn btn--sm btn--primary" href={`#/print?ids=${selected.join(",")}`}>
            📄 PDF 내보내기
          </a>
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={onClearSelection}
            aria-label="선택 모두 해제"
            style={{ color: "inherit" }}
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
