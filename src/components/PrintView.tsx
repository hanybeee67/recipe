import { useEffect } from "react";
import { assetUrl } from "../lib/assets";
import type { Lang, Translate } from "../lib/i18n";
import type { LocalizedRecipe } from "../types";

const BRAND = "Everest Restaurant Group";

function today(lang: Lang): string {
  return new Date().toLocaleDateString(lang === "ko" ? "ko-KR" : "en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function RecipeSheet({
  recipe,
  page,
  total,
  t,
}: {
  recipe: LocalizedRecipe;
  page: number;
  total: number;
  t: Translate;
}) {
  const src = assetUrl(recipe.image);

  return (
    <section className="sheet">
      <header className="sheet__brand">
        <span className="sheet__brand-name">{BRAND}</span>
        <span className="sheet__brand-sub">
          {t("print.recipeCard")} · {recipe.group}
        </span>
      </header>

      {src && (
        <figure className="sheet__figure">
          <img className="sheet__photo" src={src} alt="" />
          {recipe.imageNote && <figcaption>※ {recipe.imageNote}</figcaption>}
        </figure>
      )}

      <h1 className="sheet__title">{recipe.title}</h1>
      <p className="sheet__title-en">{recipe.subtitle}</p>

      <div className="sheet__meta">
        <span className="sheet__chip">{recipe.category}</span>
        <span className="sheet__chip">⏱ {recipe.cookTime}</span>
        <span className="sheet__chip">{recipe.serving}</span>
        <span className="sheet__chip">{t("list.ingredients", { n: recipe.ingredients.length })}</span>
        <span className="sheet__chip">{t("list.steps", { n: recipe.steps.length })}</span>
      </div>

      <div className="sheet__section">
        <h2 className="sheet__h">{t("print.sectionIngredients")}</h2>
        <table className="sheet__table">
          <thead>
            <tr>
              <th className="num">{t("table.no")}</th>
              <th>{t("table.name")}</th>
              <th className="amt">{t("table.amount")}</th>
              <th className="note">{t("table.note")}</th>
            </tr>
          </thead>
          <tbody>
            {recipe.ingredients.map((ingredient) => (
              <tr key={ingredient.no}>
                <td className="num">{ingredient.no}</td>
                <td>{ingredient.name}</td>
                <td className="amt">{ingredient.amount}</td>
                <td className="note">{ingredient.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="sheet__section">
        <h2 className="sheet__h">{t("print.sectionSteps")}</h2>
        <ol className="sheet__steps">
          {recipe.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </div>

      {recipe.garnish && (
        <div className="sheet__section">
          <h2 className="sheet__h">{t("print.sectionGarnish")}</h2>
          <p className="sheet__garnish">{recipe.garnish}</p>
        </div>
      )}

      <footer className="sheet__foot">
        <span>
          {BRAND} · {recipe.title}
        </span>
        <span>
          {page} / {total}
        </span>
      </footer>
    </section>
  );
}

function Cover({ recipes, lang, t }: { recipes: LocalizedRecipe[]; lang: Lang; t: Translate }) {
  const groups = [...new Set(recipes.map((r) => r.group))];

  return (
    <section className="sheet cover">
      <p className="cover__mark" aria-hidden="true">
        🍛
      </p>
      <p className="cover__eyebrow">{BRAND}</p>
      <h1 className="cover__title">{t("print.coverTitle")}</h1>
      <p className="cover__sub">
        {t("print.coverSub", { n: recipes.length, groups: groups.join(" · ") })}
      </p>
      <div className="cover__rule" />
      <p className="cover__date">{t("print.printedOn", { date: today(lang) })}</p>
    </section>
  );
}

/** 목차는 표지와 페이지를 나눈다. 표지에 붙이면 A4 한 장을 넘긴다. */
function Contents({ recipes, t }: { recipes: LocalizedRecipe[]; t: Translate }) {
  return (
    <section className="sheet">
      <header className="sheet__brand">
        <span className="sheet__brand-name">{BRAND}</span>
        <span className="sheet__brand-sub">Contents</span>
      </header>

      <h2 className="sheet__h">{t("print.contents")}</h2>
      <div className={recipes.length > 40 ? "toc toc--dense" : "toc"}>
        {recipes.map((recipe, i) => (
          <div className="toc__item" key={recipe.id}>
            <span style={{ color: "#a89d92", fontVariantNumeric: "tabular-nums" }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="toc__name">{recipe.title}</span>
            <span className="toc__cat">{recipe.category}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

interface Props {
  recipes: LocalizedRecipe[];
  backHref: string;
  lang: Lang;
  t: Translate;
}

export function PrintView({ recipes, backHref, lang, t }: Props) {
  const withCover = recipes.length >= 2;
  const pageCount = withCover ? recipes.length + 2 : recipes.length;

  useEffect(() => {
    const previous = document.title;
    document.title =
      recipes.length === 1
        ? `${recipes[0].title} — ${t("print.recipeCard")}`
        : `${t("brand.title")} (${recipes.length})`;
    return () => {
      document.title = previous;
    };
  }, [recipes, t]);

  if (recipes.length === 0) {
    return (
      <div className="printview">
        <div className="printview__bar">
          <a className="btn btn--sm" href={backHref}>
            ← {t("print.back")}
          </a>
        </div>
        <div className="empty">
          <p className="empty__icon" aria-hidden="true">
            📄
          </p>
          <p className="empty__title">{t("print.emptyTitle")}</p>
          <p className="empty__desc">{t("print.emptyDesc")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="printview">
      <div className="printview__bar">
        <a className="btn btn--sm" href={backHref}>
          ← {t("print.back")}
        </a>
        <p className="printview__hint">
          {t("print.hint", { n: recipes.length, pages: pageCount })}
        </p>
        <button type="button" className="btn btn--sm btn--primary" onClick={() => window.print()}>
          🖨 {t("print.button")}
        </button>
      </div>

      <div className="printview__paper">
        {withCover && <Cover recipes={recipes} lang={lang} t={t} />}
        {withCover && <Contents recipes={recipes} t={t} />}
        {recipes.map((recipe, i) => (
          <RecipeSheet key={recipe.id} recipe={recipe} page={i + 1} total={recipes.length} t={t} />
        ))}
      </div>
    </div>
  );
}
