import { useEffect, useMemo, useState } from "react";
import type { Lang, Translate } from "../lib/i18n";
import { baseFields, type EditableIngredient, type FieldPatch } from "../lib/edits";
import type { Recipe } from "../types";

interface Props {
  /** 덮개가 얹히기 **전**의 원본 — 되돌리기 기준 */
  base: Recipe;
  /** 지금 화면에 보이는(덮개가 얹힌) 값 — 폼의 출발점 */
  current: Recipe;
  lang: Lang;
  edited: boolean;
  onSave: (draft: FieldPatch) => void;
  onRevert: () => void;
  onCancel: () => void;
  t: Translate;
}

const blankIngredient = (): EditableIngredient => ({ name: "", amount: "", note: "" });

/** 배열의 한 항목을 위/아래로 옮긴다. */
function move<T>(list: T[], from: number, delta: number): T[] {
  const to = from + delta;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

export function RecipeEditor({ base, current, lang, edited, onSave, onRevert, onCancel, t }: Props) {
  const start = useMemo(() => baseFields(current, lang), [current, lang]);

  const [name, setName] = useState(start.name);
  const [cookTime, setCookTime] = useState(start.cookTime);
  const [ingredients, setIngredients] = useState<EditableIngredient[]>(start.ingredients);
  const [steps, setSteps] = useState<string[]>(start.steps);
  const [garnish, setGarnish] = useState(start.garnish);

  // 레시피나 언어가 바뀌면 폼을 새로 채운다.
  useEffect(() => {
    setName(start.name);
    setCookTime(start.cookTime);
    setIngredients(start.ingredients);
    setSteps(start.steps);
    setGarnish(start.garnish);
  }, [start]);

  const original = useMemo(() => baseFields(base, lang), [base, lang]);
  const dirty =
    name !== start.name ||
    cookTime !== start.cookTime ||
    garnish !== start.garnish ||
    JSON.stringify(ingredients) !== JSON.stringify(start.ingredients) ||
    JSON.stringify(steps) !== JSON.stringify(start.steps);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    onSave({
      name: name.trim(),
      cookTime: cookTime.trim(),
      garnish: garnish.trim(),
      // 빈 행은 저장하지 않는다 — 실수로 추가만 하고 안 채운 경우
      ingredients: ingredients
        .map((i) => ({ name: i.name.trim(), amount: i.amount.trim(), note: i.note.trim() }))
        .filter((i) => i.name || i.amount),
      steps: steps.map((s) => s.trim()).filter(Boolean),
    });
  }

  const changed = (a: string, b: string) => (a !== b ? "field__input field__input--changed" : "field__input");

  return (
    <form className="editor" onSubmit={submit}>
      <div className="editor__head">
        <h2 className="editor__title">
          <span aria-hidden="true">✏️</span> {t("edit.title")}
        </h2>
        <span className="editor__lang">{t(lang === "ko" ? "edit.langKo" : "edit.langEn")}</span>
      </div>
      <p className="editor__hint">{t("edit.hint")}</p>

      {/* --------------------------------------------------------- 기본 */}
      <div className="editor__grid">
        <label className="field">
          <span className="field__label">{t("edit.name")}</span>
          <input className={changed(name, original.name)} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span className="field__label">{t("edit.cookTime")}</span>
          <input
            className={changed(cookTime, original.cookTime)}
            value={cookTime}
            onChange={(e) => setCookTime(e.target.value)}
            placeholder={lang === "ko" ? "약 5~7분" : "About 5–7 min"}
          />
        </label>
      </div>

      {/* --------------------------------------------------------- 재료 */}
      <section className="editor__section">
        <div className="editor__section-head">
          <h3 className="editor__section-title">{t("edit.ingredients", { n: ingredients.length })}</h3>
          <button type="button" className="btn btn--sm" onClick={() => setIngredients((v) => [...v, blankIngredient()])}>
            ＋ {t("edit.addRow")}
          </button>
        </div>

        <div className="editor__rows">
          {ingredients.map((row, i) => (
            <div className="editor__row" key={i}>
              <span className="editor__rowno">{i + 1}</span>
              <input
                className="field__input"
                value={row.name}
                placeholder={t("edit.phName")}
                aria-label={`${t("edit.phName")} ${i + 1}`}
                onChange={(e) =>
                  setIngredients((v) => v.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                }
              />
              <input
                className="field__input editor__amount"
                value={row.amount}
                placeholder={t("edit.phAmount")}
                aria-label={`${t("edit.phAmount")} ${i + 1}`}
                onChange={(e) =>
                  setIngredients((v) => v.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))
                }
              />
              <input
                className="field__input"
                value={row.note}
                placeholder={t("edit.phNote")}
                aria-label={`${t("edit.phNote")} ${i + 1}`}
                onChange={(e) =>
                  setIngredients((v) => v.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))
                }
              />
              <div className="editor__rowbtns">
                <button type="button" className="icon-btn icon-btn--sm" aria-label={t("edit.up")}
                  onClick={() => setIngredients((v) => move(v, i, -1))}>↑</button>
                <button type="button" className="icon-btn icon-btn--sm" aria-label={t("edit.down")}
                  onClick={() => setIngredients((v) => move(v, i, 1))}>↓</button>
                <button type="button" className="icon-btn icon-btn--sm icon-btn--danger" aria-label={t("edit.remove")}
                  onClick={() => setIngredients((v) => v.filter((_, j) => j !== i))}>✕</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------------- 조리 단계 */}
      <section className="editor__section">
        <div className="editor__section-head">
          <h3 className="editor__section-title">{t("edit.steps", { n: steps.length })}</h3>
          <button type="button" className="btn btn--sm" onClick={() => setSteps((v) => [...v, ""])}>
            ＋ {t("edit.addStep")}
          </button>
        </div>

        <div className="editor__rows">
          {steps.map((step, i) => (
            <div className="editor__row editor__row--step" key={i}>
              <span className="editor__rowno">{i + 1}</span>
              <textarea
                className="field__input field__input--area"
                value={step}
                rows={2}
                aria-label={`${t("edit.steps", { n: steps.length })} ${i + 1}`}
                onChange={(e) => setSteps((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
              />
              <div className="editor__rowbtns">
                <button type="button" className="icon-btn icon-btn--sm" aria-label={t("edit.up")}
                  onClick={() => setSteps((v) => move(v, i, -1))}>↑</button>
                <button type="button" className="icon-btn icon-btn--sm" aria-label={t("edit.down")}
                  onClick={() => setSteps((v) => move(v, i, 1))}>↓</button>
                <button type="button" className="icon-btn icon-btn--sm icon-btn--danger" aria-label={t("edit.remove")}
                  onClick={() => setSteps((v) => v.filter((_, j) => j !== i))}>✕</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------------- 가니쉬 */}
      <section className="editor__section">
        <label className="field">
          <span className="field__label">{t("edit.garnish")}</span>
          <textarea
            className={`${changed(garnish, original.garnish)} field__input--area`}
            value={garnish}
            rows={3}
            onChange={(e) => setGarnish(e.target.value)}
          />
        </label>
      </section>

      <p className="editor__locked">{t("edit.locked")}</p>

      <div className="editor__actions">
        <button type="submit" className="btn btn--primary" disabled={!dirty}>
          {t("edit.save")}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          {t("edit.cancel")}
        </button>
        {edited && (
          <button type="button" className="btn btn--ghost-danger" onClick={onRevert}>
            {t("edit.revert")}
          </button>
        )}
      </div>
    </form>
  );
}
