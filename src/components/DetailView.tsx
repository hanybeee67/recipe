import { useEffect, useState } from "react";
import { GROUP_EMOJI, assetUrl } from "../lib/assets";
import { detailHref, listHref, navigate, printHref } from "../lib/router";
import { MULTIPLIERS, scaleAmount, scaleServing, type Multiplier } from "../lib/scale";
import { useStepProgress } from "../lib/storage";
import { EMPTY_FILTERS, type Filters, type Recipe } from "../types";

interface Props {
  recipe: Recipe | undefined;
  filters: Filters;
  /** 현재 필터 결과 순서 — 이전/다음 이동에 사용 */
  siblings: Recipe[];
}

export function DetailView({ recipe, filters, siblings }: Props) {
  const [multiplier, setMultiplier] = useState<Multiplier>(1);
  const progress = useStepProgress(recipe?.id ?? "", recipe?.steps.length ?? 0);

  useEffect(() => {
    setMultiplier(1);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [recipe?.id]);

  const position = recipe ? siblings.findIndex((r) => r.id === recipe.id) : -1;
  const previous = position > 0 ? siblings[position - 1] : undefined;
  const next = position >= 0 && position < siblings.length - 1 ? siblings[position + 1] : undefined;

  // ← → 로 레시피 이동
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.key === "ArrowLeft" && previous) navigate(detailHref(previous.id, filters));
      if (event.key === "ArrowRight" && next) navigate(detailHref(next.id, filters));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previous, next, filters]);

  if (!recipe) {
    return (
      <div className="notfound">
        <p style={{ fontSize: 44 }} aria-hidden="true">
          🔍
        </p>
        <h1 className="empty__title">레시피를 찾을 수 없습니다</h1>
        <p className="empty__desc">주소가 잘못되었거나 삭제된 레시피입니다.</p>
        <a className="btn btn--primary" href={listHref(EMPTY_FILTERS)}>
          전체 목록으로
        </a>
      </div>
    );
  }

  const src = assetUrl(recipe.image);
  const percent = progress.total ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <article className="detail">
      <a className="backlink no-print" href={listHref(filters)}>
        <span aria-hidden="true">←</span> 목록으로
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
              <img src={src} alt={`${recipe.name} 완성 사진`} />
            ) : (
              <div className="card__placeholder" aria-hidden="true">
                {GROUP_EMOJI[recipe.group] ?? "🍽️"}
              </div>
            )}
          </div>

          <div className="stats">
            <div className="stat">
              <p className="stat__value">{recipe.cookTime.replace("약 ", "")}</p>
              <p className="stat__label">조리 시간</p>
            </div>
            <div className="stat">
              <p className="stat__value">{recipe.ingredients.length}</p>
              <p className="stat__label">재료</p>
            </div>
            <div className="stat">
              <p className="stat__value">{recipe.steps.length}</p>
              <p className="stat__label">조리 단계</p>
            </div>
          </div>

          <div className="detail__actions no-print">
            <a className="btn btn--primary" href={printHref([recipe.id])}>
              📄 이 레시피 PDF로 내보내기
            </a>
            {progress.completed > 0 && (
              <button type="button" className="btn" onClick={progress.reset}>
                조리 진행 초기화
              </button>
            )}
          </div>
        </aside>

        <div className="detail__main">
          <div className="badges">
            <span className="badge badge--accent">{recipe.category}</span>
            {recipe.group !== recipe.category && <span className="badge">{recipe.group}</span>}
            {recipe.tags.includes("채식") && <span className="badge">🌱 채식</span>}
            {recipe.tags.includes("매운맛") && <span className="badge">🌶 매운맛</span>}
          </div>

          <h1 className="detail__title">{recipe.name}</h1>
          <p className="detail__title-en">{recipe.nameEn}</p>

            {/* ---------------------------------------------------- 재료 */}
            <section className="section">
          <div className="section__head">
            <h2 className="section__title">
              <span aria-hidden="true">🥘</span> 재료
            </h2>
            <div className="scaler" role="group" aria-label="분량 배율">
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

          <p
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              marginBottom: 12,
            }}
          >
            {scaleServing(recipe.serving, multiplier)}
            {multiplier > 1 && (
              <span style={{ color: "var(--saffron)", fontWeight: 700 }}>
                {" "}
                · 원본 {recipe.serving} 에서 ×{multiplier} 환산
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
                    {ingredient.name}
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
              <span aria-hidden="true">👨‍🍳</span> 조리 방법
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

          <p style={{ fontSize: 13, color: "var(--text-faint)", marginBottom: 12 }} className="no-print">
            단계를 눌러 완료 표시할 수 있습니다. 진행 상황은 이 기기에 저장됩니다.
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
              <span aria-hidden="true">🌿</span> 가니쉬
            </h2>
            <div className="garnish">
              <span className="garnish__icon" aria-hidden="true">
                🌿
              </span>
              <p className="garnish__text">{recipe.garnish}</p>
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
        <nav className="pager no-print" aria-label="레시피 이동">
          {previous ? (
            <a className="pager__item" href={detailHref(previous.id, filters)}>
              <span className="pager__dir">← 이전</span>
              <span className="pager__name">{previous.name}</span>
            </a>
          ) : (
            <span />
          )}
          {next && (
            <a className="pager__item pager__item--next" href={detailHref(next.id, filters)}>
              <span className="pager__dir">다음 →</span>
              <span className="pager__name">{next.name}</span>
            </a>
          )}
        </nav>
      )}
    </article>
  );
}
