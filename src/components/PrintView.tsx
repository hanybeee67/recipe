import { useEffect } from "react";
import { assetUrl } from "../lib/assets";
import type { Recipe } from "../types";

const BRAND = "Everest Restaurant Group";

function today(): string {
  return new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function RecipeSheet({ recipe, page, total }: { recipe: Recipe; page: number; total: number }) {
  const src = assetUrl(recipe.image);

  return (
    <section className="sheet">
      <header className="sheet__brand">
        <span className="sheet__brand-name">{BRAND}</span>
        <span className="sheet__brand-sub">Recipe Card · {recipe.group}</span>
      </header>

      {src && <img className="sheet__photo" src={src} alt="" />}

      <h1 className="sheet__title">{recipe.name}</h1>
      <p className="sheet__title-en">{recipe.nameEn}</p>

      <div className="sheet__meta">
        <span className="sheet__chip">{recipe.category}</span>
        <span className="sheet__chip">⏱ {recipe.cookTime}</span>
        <span className="sheet__chip">{recipe.serving}</span>
        <span className="sheet__chip">재료 {recipe.ingredients.length}</span>
        <span className="sheet__chip">{recipe.steps.length}단계</span>
      </div>

      <div className="sheet__section">
        <h2 className="sheet__h">재료 Ingredients</h2>
        <table className="sheet__table">
          <thead>
            <tr>
              <th className="num">#</th>
              <th>재료명</th>
              <th className="amt">수량</th>
              <th className="note">비고</th>
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
        <h2 className="sheet__h">조리 방법 Cooking Steps</h2>
        <ol className="sheet__steps">
          {recipe.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </div>

      {recipe.garnish && (
        <div className="sheet__section">
          <h2 className="sheet__h">가니쉬 Garnish</h2>
          <p className="sheet__garnish">{recipe.garnish}</p>
        </div>
      )}

      <footer className="sheet__foot">
        <span>
          {BRAND} · {recipe.name}
        </span>
        <span>
          {page} / {total}
        </span>
      </footer>
    </section>
  );
}

function Cover({ recipes }: { recipes: Recipe[] }) {
  const groups = [...new Set(recipes.map((r) => r.group))];

  return (
    <section className="sheet cover">
      <p className="cover__mark" aria-hidden="true">
        🍛
      </p>
      <p className="cover__eyebrow">{BRAND}</p>
      <h1 className="cover__title">레시피북</h1>
      <p className="cover__sub">
        {recipes.length}개 레시피 · {groups.join(" · ")}
      </p>
      <div className="cover__rule" />
      <p className="cover__date">{today()} 출력</p>
    </section>
  );
}

/** 목차는 표지와 페이지를 나눈다. 표지에 붙이면 A4 한 장을 넘긴다. */
function Contents({ recipes }: { recipes: Recipe[] }) {
  return (
    <section className="sheet">
      <header className="sheet__brand">
        <span className="sheet__brand-name">{BRAND}</span>
        <span className="sheet__brand-sub">Contents</span>
      </header>

      <h2 className="sheet__h">목차 Contents</h2>
      <div className={recipes.length > 40 ? "toc toc--dense" : "toc"}>
        {recipes.map((recipe, i) => (
          <div className="toc__item" key={recipe.id}>
            <span style={{ color: "#a89d92", fontVariantNumeric: "tabular-nums" }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="toc__name">{recipe.name}</span>
            <span className="toc__cat">{recipe.category}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

interface Props {
  recipes: Recipe[];
  backHref: string;
}

export function PrintView({ recipes, backHref }: Props) {
  useEffect(() => {
    const previous = document.title;
    document.title =
      recipes.length === 1 ? `${recipes[0].name} — 레시피 카드` : `에베레스트 레시피북 (${recipes.length}건)`;
    return () => {
      document.title = previous;
    };
  }, [recipes]);

  const withCover = recipes.length >= 2;
  const pageCount = withCover ? recipes.length + 2 : recipes.length;

  if (recipes.length === 0) {
    return (
      <div className="printview">
        <div className="printview__bar">
          <a className="btn btn--sm" href={backHref}>
            ← 돌아가기
          </a>
        </div>
        <div className="empty">
          <p className="empty__icon" aria-hidden="true">
            📄
          </p>
          <p className="empty__title">내보낼 레시피가 없습니다</p>
          <p className="empty__desc">목록에서 카드 우측 상단의 ＋ 버튼으로 레시피를 선택하세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="printview">
      <div className="printview__bar">
        <a className="btn btn--sm" href={backHref}>
          ← 돌아가기
        </a>
        <p className="printview__hint">
          <strong>{recipes.length}개</strong> 레시피 · A4 {pageCount}쪽 — 인쇄 대화상자에서{" "}
          <kbd>대상</kbd>을 <kbd>PDF로 저장</kbd>으로 선택하세요.
        </p>
        <button type="button" className="btn btn--sm btn--primary" onClick={() => window.print()}>
          🖨 인쇄 / PDF 저장
        </button>
      </div>

      <div className="printview__paper">
        {withCover && <Cover recipes={recipes} />}
        {withCover && <Contents recipes={recipes} />}
        {recipes.map((recipe, i) => (
          <RecipeSheet key={recipe.id} recipe={recipe} page={i + 1} total={recipes.length} />
        ))}
      </div>
    </div>
  );
}
