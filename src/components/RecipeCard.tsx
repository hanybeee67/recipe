import { GROUP_EMOJI, assetUrl } from "../lib/assets";
import { detailHref } from "../lib/router";
import type { Filters, Recipe } from "../types";
import { Highlight } from "./Highlight";

interface Props {
  recipe: Recipe;
  filters: Filters;
  matchedIngredients: string[];
  selectable: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
}

export function RecipeCard({
  recipe,
  filters,
  matchedIngredients,
  selectable,
  selected,
  onToggleSelect,
}: Props) {
  const src = assetUrl(recipe.image);

  return (
    <article className="card">
      <div className="card__media">
        {src ? (
          <img
            className="card__img"
            src={src}
            alt={`${recipe.name} 완성 사진`}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="card__placeholder" aria-hidden="true">
            {GROUP_EMOJI[recipe.group] ?? "🍽️"}
          </div>
        )}

        <span className="card__badge">{recipe.category}</span>
        <span className="card__time">⏱ {recipe.cookTime.replace("약 ", "")}</span>

        {selectable && (
          <button
            type="button"
            className="card__select"
            aria-pressed={selected}
            aria-label={`${recipe.name} ${selected ? "선택 해제" : "인쇄 목록에 추가"}`}
            onClick={() => onToggleSelect(recipe.id)}
          >
            <span aria-hidden="true">{selected ? "✓" : "＋"}</span>
          </button>
        )}
      </div>

      <div className="card__body">
        <h3 className="card__name">
          <a className="card__link" href={detailHref(recipe.id, filters)}>
            <Highlight text={recipe.name} query={filters.q} />
          </a>
        </h3>
        <p className="card__name-en">
          <Highlight text={recipe.nameEn} query={filters.q} />
        </p>

        <div className="card__meta">
          <span>재료 {recipe.ingredients.length}</span>
          <span className="card__dot" aria-hidden="true" />
          <span>{recipe.steps.length}단계</span>
          {recipe.tags.includes("채식") && (
            <>
              <span className="card__dot" aria-hidden="true" />
              <span>🌱 채식</span>
            </>
          )}
        </div>

        {matchedIngredients.length > 0 && (
          <p className="card__match">
            재료 일치 ·{" "}
            {matchedIngredients.slice(0, 3).map((name, i) => (
              <span key={name}>
                {i > 0 && ", "}
                <Highlight text={name} query={filters.q} />
              </span>
            ))}
            {matchedIngredients.length > 3 && ` 외 ${matchedIngredients.length - 3}건`}
          </p>
        )}
      </div>
    </article>
  );
}
