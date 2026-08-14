import { GROUP_EMOJI, assetUrl } from "../lib/assets";
import type { Translate } from "../lib/i18n";
import { detailHref } from "../lib/router";
import type { Filters, LocalizedRecipe } from "../types";
import { Highlight } from "./Highlight";

interface Props {
  recipe: LocalizedRecipe;
  filters: Filters;
  matchedIngredients: string[];
  selected: boolean;
  onToggleSelect: (id: string) => void;
  t: Translate;
}

export function RecipeCard({
  recipe,
  filters,
  matchedIngredients,
  selected,
  onToggleSelect,
  t,
}: Props) {
  const src = assetUrl(recipe.image);
  const isVeg = recipe.tags.includes("채식") || recipe.tags.includes("Vegetarian");

  return (
    <article className="card">
      <div className="card__media">
        {src ? (
          <img
            className="card__img"
            src={src}
            alt={recipe.title}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="card__placeholder">
            <span aria-hidden="true">{GROUP_EMOJI[recipe.groupKey] ?? "🍽️"}</span>
            <span className="card__placeholder-text">{t("list.noPhoto")}</span>
          </div>
        )}

        <span className="card__badge">{recipe.category}</span>
        <span className="card__time">⏱ {recipe.cookTime.replace(/^(약 |About )/, "")}</span>

        <button
          type="button"
          className="card__select"
          aria-pressed={selected}
          aria-label={`${recipe.title} — ${t(selected ? "select.remove" : "select.add")}`}
          onClick={() => onToggleSelect(recipe.id)}
        >
          <span aria-hidden="true">{selected ? "✓" : "＋"}</span>
        </button>
      </div>

      <div className="card__body">
        <h3 className="card__name">
          <a className="card__link" href={detailHref(recipe.id, filters)}>
            <Highlight text={recipe.title} query={filters.q} />
          </a>
        </h3>
        <p className="card__name-en">
          <Highlight text={recipe.subtitle} query={filters.q} />
        </p>

        <div className="card__meta">
          <span>{t("list.ingredients", { n: recipe.ingredients.length })}</span>
          <span className="card__dot" aria-hidden="true" />
          <span>{t("list.steps", { n: recipe.steps.length })}</span>
          {isVeg && (
            <>
              <span className="card__dot" aria-hidden="true" />
              <span>🌱 {t("list.vegetarian")}</span>
            </>
          )}
        </div>

        {matchedIngredients.length > 0 && (
          <p className="card__match">
            {t("list.matchedIngredients")}
            {matchedIngredients.slice(0, 3).map((name, i) => (
              <span key={name}>
                {i > 0 && ", "}
                <Highlight text={name} query={filters.q} />
              </span>
            ))}
            {matchedIngredients.length > 3 &&
              t("list.matchedMore", { n: matchedIngredients.length - 3 })}
          </p>
        )}
      </div>
    </article>
  );
}
