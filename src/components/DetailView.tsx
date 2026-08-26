import { useEffect, useState } from "react";
import { GROUP_EMOJI, assetUrl } from "../lib/assets";
import type { FieldPatch } from "../lib/edits";
import type { Lang, Translate } from "../lib/i18n";
import { detailHref, listHref, navigate, printHref } from "../lib/router";
import { MULTIPLIERS, scaleAmount, scaleServing, type Multiplier } from "../lib/scale";
import { useStepProgress } from "../lib/storage";
import { EMPTY_FILTERS, type Filters, type LocalizedRecipe, type Recipe } from "../types";
import { RecipeEditor } from "./RecipeEditor";

interface Props {
  recipe: LocalizedRecipe | undefined;
  filters: Filters;
  /** 현재 필터 결과 순서 — 이전/다음 이동에 사용 */
  siblings: LocalizedRecipe[];
  /** 덮개가 얹힌 값과 원본 — 편집 폼에 넘긴다 */
  raw: Recipe | undefined;
  base: Recipe | undefined;
  lang: Lang;
  canEdit: boolean;
  edited: boolean;
  onSaveEdit: (draft: FieldPatch) => void;
  onRevertEdit: () => void;
  t: Translate;
}

export function DetailView({
  recipe,
  filters,
  siblings,
  raw,
  base,
  lang,
  canEdit,
  edited,
  onSaveEdit,
  onRevertEdit,
  t,
}: Props) {
  const [multiplier, setMultiplier] = useState<Multiplier>(1);
  const [editing, setEditing] = useState(false);
  const progress = useStepProgress(recipe?.id ?? "", recipe?.steps.length ?? 0);

  useEffect(() => {
    setMultiplier(1);
    setEditing(false);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [recipe?.id]);

  // 로그아웃하면 편집 폼도 닫는다.
  useEffect(() => {
    if (!canEdit) setEditing(false);
  }, [canEdit]);

  const position = recipe ? siblings.findIndex((r) => r.id === recipe.id) : -1;
  const previous = position > 0 ? siblings[position - 1] : undefined;
  const next = position >= 0 && position < siblings.length - 1 ? siblings[position + 1] : undefined;

  // ← → 로 레시피 이동
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (editing) return;
      if (event.key === "ArrowLeft" && previous) navigate(detailHref(previous.id, filters));
      if (event.key === "ArrowRight" && next) navigate(detailHref(next.id, filters));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previous, next, filters, editing]);

  if (!recipe) {
    return (
      <div className="notfound">
        <p style={{ fontSize: 44 }} aria-hidden="true">
          🔍
        </p>
        <h1 className="empty__title">{t("detail.notFound")}</h1>
        <p className="empty__desc">{t("detail.notFoundDesc")}</p>
        <a className="btn btn--primary" href={listHref(EMPTY_FILTERS)}>
          {t("detail.toList")}
        </a>
      </div>
    );
  }

  const src = assetUrl(recipe.image);
  const percent = progress.total ? Math.round((progress.completed / progress.total) * 100) : 0;
  const isVeg = recipe.tags.includes("채식") || recipe.tags.includes("Vegetarian");
  const isSpicy = recipe.tags.includes("매운맛") || recipe.tags.includes("Spicy");

  return (
    <article className="detail">
      <a className="backlink no-print" href={listHref(filters)}>
        <span aria-hidden="true">←</span> {t("detail.back")}
        {position >= 0 && (
          <span style={{ color: "var(--text-faint)" }}>
            {" "}
            ({position + 1} / {siblings.length})
          </span>
        )}
      </a>

      <div className="detail__layout">
        <aside className="detail__aside">
          <div className="detail__media">
            {src ? (
              <img src={src} alt={recipe.title} />
            ) : (
              <div className="card__placeholder">
                <span aria-hidden="true">{GROUP_EMOJI[recipe.groupKey] ?? "🍽️"}</span>
                <span className="card__placeholder-text">{t("list.noPhoto")}</span>
              </div>
            )}
          </div>
          {recipe.imageNote && <p className="detail__media-note">※ {recipe.imageNote}</p>}

          <div className="stats">
            <div className="stat">
              <p className="stat__value">{recipe.cookTime.replace(/^(약 |About )/, "")}</p>
              <p className="stat__label">{t("detail.cookTime")}</p>
            </div>
            <div className="stat">
              <p className="stat__value">{recipe.ingredients.length}</p>
              <p className="stat__label">{t("detail.ingredients")}</p>
            </div>
            <div className="stat">
              <p className="stat__value">{recipe.steps.length}</p>
              <p className="stat__label">{t("detail.steps")}</p>
            </div>
          </div>

          <div className="detail__actions no-print">
            <a className="btn btn--primary" href={printHref([recipe.id])}>
              📄 {t("detail.export")}
            </a>
            {canEdit && !editing && (
              <button type="button" className="btn" onClick={() => setEditing(true)}>
                ✏️ {t("edit.button")}
              </button>
            )}
            {progress.completed > 0 && (
              <button type="button" className="btn" onClick={progress.reset}>
                {t("detail.resetProgress")}
              </button>
            )}
          </div>
        </aside>

        <div className="detail__main">
          <div className="badges">
            <span className="badge badge--accent">{recipe.category}</span>
            {recipe.group !== recipe.category && <span className="badge">{recipe.group}</span>}
            {isVeg && <span className="badge">🌱 {t("list.vegetarian")}</span>}
            {isSpicy && (
              <span className="badge">
                🌶 {recipe.tags.find((x) => x === "매운맛" || x === "Spicy")}
              </span>
            )}
          </div>

          <h1 className="detail__title">{recipe.title}</h1>
          <p className="detail__title-en">{recipe.subtitle}</p>

          {edited && (
            <p className="edited-flag no-print">
              <span aria-hidden="true">✏️</span> {t("edit.flag")}
            </p>
          )}

          {editing && raw && base && (
            <RecipeEditor
              base={base}
              current={raw}
              lang={lang}
              edited={edited}
              onSave={(draft) => {
                onSaveEdit(draft);
                setEditing(false);
              }}
              onRevert={() => {
                onRevertEdit();
                setEditing(false);
              }}
              onCancel={() => setEditing(false)}
              t={t}
            />
          )}

          {/* ---------------------------------------------------- 재료 */}
          <section className="section">
            <div className="section__head">
              <h2 className="section__title">
                <span aria-hidden="true">🥘</span> {t("detail.ingredientsTitle")}
              </h2>
              <div className="scaler" role="group" aria-label={t("detail.scalerLabel")}>
                {MULTIPLIERS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className="scaler__btn"
                    aria-pressed={multiplier === m}
                    onClick={() => setMultiplier(m)}
                  >
                    ×{m}
                  </button>
                ))}
              </div>
            </div>

            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
              {scaleServing(recipe.serving, multiplier)}
              {multiplier > 1 && (
                <span style={{ color: "var(--saffron)", fontWeight: 700 }}>
                  {t("detail.scaledFrom", { n: multiplier, base: recipe.serving })}
                </span>
              )}
            </p>

            <div className="ingredients">
              {recipe.ingredients.map((ingredient) => {
                const scaled = scaleAmount(ingredient.amount, multiplier);
                return (
                  <div className="ing-row" key={ingredient.no}>
                    <span className="ing-row__no">{ingredient.no}</span>
                    <span className="ing-row__name">
                      {ingredient.prepId ? (
                        <a className="ing-row__prep" href={detailHref(ingredient.prepId, filters)}>
                          {ingredient.name}
                          <span className="ing-row__prep-tag">{t("prep.badge")}</span>
                        </a>
                      ) : (
                        ingredient.name
                      )}
                      {ingredient.note && <span className="ing-row__note">{ingredient.note}</span>}
                    </span>
                    <span className="ing-row__amount">
                      {scaled}
                      {multiplier > 1 && scaled !== ingredient.amount && <s>{ingredient.amount}</s>}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ---------------------------------------------------- 조리 방법 */}
          <section className="section">
            <div className="section__head">
              <h2 className="section__title">
                <span aria-hidden="true">👨‍🍳</span> {t("detail.stepsTitle")}
              </h2>
              <div className="progress no-print">
                <div className="progress__track">
                  <div className="progress__fill" style={{ width: `${percent}%` }} />
                </div>
                <span>
                  {progress.completed} / {progress.total}
                </span>
              </div>
            </div>

            <p
              style={{ fontSize: 13, color: "var(--text-faint)", marginBottom: 12 }}
              className="no-print"
            >
              {t("detail.stepHint")}
            </p>

            <ol className="steps">
              {recipe.steps.map((step, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className="step"
                    data-done={progress.isDone(i)}
                    aria-pressed={progress.isDone(i)}
                    onClick={() => progress.toggle(i)}
                  >
                    <span className="step__no" aria-hidden="true">
                      {progress.isDone(i) ? "✓" : i + 1}
                    </span>
                    <span className="step__text">{step}</span>
                  </button>
                </li>
              ))}
            </ol>
          </section>

          {/* ---------------------------------------------------- 가니쉬 */}
          {recipe.garnish && (
            <section className="section">
              <h2 className="section__title" style={{ marginBottom: 16 }}>
                <span aria-hidden="true">🌿</span> {t("detail.garnishTitle")}
              </h2>
              <div className="garnish">
                <span className="garnish__icon" aria-hidden="true">
                  🌿
                </span>
                <p className="garnish__text">{recipe.garnish}</p>
              </div>
            </section>
          )}

          {recipe.usedIn && recipe.usedIn.length > 0 && (
            <section className="section">
              <h2 className="section__title" style={{ marginBottom: 6 }}>
                <span aria-hidden="true">🔗</span>{" "}
                {t("prep.usedIn", { n: recipe.usedIn.length })}
              </h2>
              <p style={{ fontSize: 13, color: "var(--text-faint)", marginBottom: 14 }}>
                {t("prep.usedInHint")}
              </p>
              <div className="usedin">
                {recipe.usedIn.map((item) => (
                  <a key={item.id} className="usedin__item" href={detailHref(item.id, filters)}>
                    {item.name}
                  </a>
                ))}
              </div>
            </section>
          )}

          {recipe.tags.length > 0 && (
            <div className="taglist no-print">
              {recipe.tags.map((tag) => (
                <a key={tag} className="taglink" href={listHref({ ...EMPTY_FILTERS, q: tag })}>
                  #{tag}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------- 이전 / 다음 */}
      {(previous || next) && (
        <nav className="pager no-print" aria-label={t("detail.back")}>
          {previous ? (
            <a className="pager__item" href={detailHref(previous.id, filters)}>
              <span className="pager__dir">← {t("detail.prev")}</span>
              <span className="pager__name">{previous.title}</span>
            </a>
          ) : (
            <span />
          )}
          {next && (
            <a className="pager__item pager__item--next" href={detailHref(next.id, filters)}>
              <span className="pager__dir">{t("detail.next")} →</span>
              <span className="pager__name">{next.title}</span>
            </a>
          )}
        </nav>
      )}
    </article>
  );
}
