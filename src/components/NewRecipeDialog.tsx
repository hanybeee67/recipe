import { useEffect, useMemo, useState } from "react";
import type { Translate } from "../lib/i18n";
import {
  makeId,
  nextOrder,
  readPhoto,
  type EditableIngredient,
  type NewRecipe,
} from "../lib/edits";
import { GROUPS, type Group, type Recipe } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (recipe: NewRecipe) => void;
  /** 지금 화면에 있는 전체 메뉴 — id 중복 방지와 순서 계산에 쓴다 */
  recipes: Recipe[];
  t: Translate;
}

/** 사전에 없어도 형태만 보고 옮길 수 있는 조리시간. build-recipes 의 규칙과 같다. */
function cookTimeEn(ko: string): string {
  const range = /^약 (\d+)~(\d+)분$/.exec(ko);
  if (range) return `About ${range[1]}–${range[2]} min`;
  const single = /^약 (\d+)분$/.exec(ko);
  if (single) return `About ${single[1]} min`;
  return ko;
}

const blank = (): EditableIngredient => ({ name: "", amount: "", note: "" });

function move<T>(list: T[], from: number, delta: number): T[] {
  const to = from + delta;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

export function NewRecipeDialog({ open, onClose, onCreate, recipes, t }: Props) {
  const [group, setGroup] = useState<Group>("커리");
  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [category, setCategory] = useState("");
  const [categoryEn, setCategoryEn] = useState("");
  const [cookTime, setCookTime] = useState("약 10~15분");
  const [image, setImage] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState<EditableIngredient[]>([blank(), blank(), blank()]);
  const [steps, setSteps] = useState<string[]>(["", ""]);
  const [garnish, setGarnish] = useState("");

  useEffect(() => {
    if (!open) return;
    setGroup("커리");
    setName("");
    setNameEn("");
    setCategory("");
    setCategoryEn("");
    setCookTime("약 10~15분");
    setImage(null);
    setPhotoError(null);
    setIngredients([blank(), blank(), blank()]);
    setSteps(["", ""]);
    setGarnish("");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  /** 고른 대분류에 이미 있는 세부 분류 — 새로 만들기보다 고르는 편이 낫다. */
  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of recipes) {
      if (r.group === group && !seen.has(r.category)) seen.set(r.category, r.en.category);
    }
    return [...seen.entries()];
  }, [recipes, group]);

  const groupEn = useMemo(
    () => recipes.find((r) => r.group === group)?.en.group ?? group,
    [recipes, group]
  );

  if (!open) return null;

  async function pickPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoError(null);
    try {
      setImage(await readPhoto(file));
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : String(error));
    }
  }

  const cleanIngredients = ingredients
    .map((i) => ({ name: i.name.trim(), amount: i.amount.trim(), note: i.note.trim() }))
    .filter((i) => i.name || i.amount);
  const cleanSteps = steps.map((s) => s.trim()).filter(Boolean);

  const ready =
    name.trim() !== "" &&
    nameEn.trim() !== "" &&
    category.trim() !== "" &&
    categoryEn.trim() !== "" &&
    cleanIngredients.length > 0 &&
    cleanSteps.length > 0;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) return;

    const taken = new Set(recipes.map((r) => r.id));
    const ko = {
      name: name.trim(),
      cookTime: cookTime.trim(),
      ingredients: cleanIngredients,
      steps: cleanSteps,
      garnish: garnish.trim(),
    };

    onCreate({
      id: makeId(nameEn, taken),
      group,
      groupEn,
      category: category.trim(),
      categoryEn: categoryEn.trim(),
      order: nextOrder(recipes, group),
      image,
      ko,
      // 영어는 이름·분류·조리시간만 채워지고, 나머지는 EN 으로 바꿔 편집 폼에서 채운다.
      en: { ...ko, name: nameEn.trim(), cookTime: cookTimeEn(cookTime.trim()) },
    });
    onClose();
  }

  return (
    <div className="modal no-print" role="presentation" onMouseDown={onClose}>
      <form
        className="modal__panel modal__panel--wide"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <h2 className="modal__title">
          <span aria-hidden="true">🍽️</span> {t("add.title")}
        </h2>
        <p className="modal__desc">{t("add.desc")}</p>

        <div className="editor__grid">
          <label className="field">
            <span className="field__label">{t("add.group")}</span>
            <select className="field__input" value={group} onChange={(e) => setGroup(e.target.value as Group)}>
              {GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">{t("add.cookTime")}</span>
            <input className="field__input" value={cookTime} onChange={(e) => setCookTime(e.target.value)} />
          </label>
        </div>

        <div className="editor__grid">
          <label className="field">
            <span className="field__label">{t("add.category")}</span>
            <input
              className="field__input"
              list="everest-categories"
              value={category}
              placeholder="치킨 커리"
              onChange={(e) => {
                setCategory(e.target.value);
                const hit = categories.find(([ko]) => ko === e.target.value);
                if (hit) setCategoryEn(hit[1]);
              }}
              required
            />
            <datalist id="everest-categories">
              {categories.map(([ko]) => (
                <option key={ko} value={ko} />
              ))}
            </datalist>
          </label>
          <label className="field">
            <span className="field__label">{t("add.categoryEn")}</span>
            <input
              className="field__input"
              value={categoryEn}
              placeholder="Chicken Curry"
              onChange={(e) => setCategoryEn(e.target.value)}
              required
            />
          </label>
        </div>

        <div className="editor__grid">
          <label className="field">
            <span className="field__label">{t("add.name")}</span>
            <input className="field__input" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="field">
            <span className="field__label">{t("add.nameEn")}</span>
            <input className="field__input" value={nameEn} onChange={(e) => setNameEn(e.target.value)} required />
          </label>
        </div>

        {/* ------------------------------------------------------- 사진 */}
        <div className="field">
          <span className="field__label">{t("add.photo")}</span>
          <div className="photopick">
            {image ? (
              <img className="photopick__preview" src={image} alt="" />
            ) : (
              <div className="photopick__empty" aria-hidden="true">
                🍽️
              </div>
            )}
            <div className="photopick__side">
              <input
                className="photopick__input"
                type="file"
                accept="image/*"
                onChange={pickPhoto}
                aria-label={t("add.photo")}
              />
              {image && (
                <button type="button" className="btn btn--sm" onClick={() => setImage(null)}>
                  {t("add.photoClear")}
                </button>
              )}
              <p className="photopick__hint">{photoError ?? t("add.photoHint")}</p>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------- 재료 */}
        <section className="editor__section">
          <div className="editor__section-head">
            <h3 className="editor__section-title">{t("edit.ingredients", { n: ingredients.length })}</h3>
            <button type="button" className="btn btn--sm" onClick={() => setIngredients((v) => [...v, blank()])}>
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
                  onChange={(e) => setIngredients((v) => v.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                />
                <input
                  className="field__input editor__amount"
                  value={row.amount}
                  placeholder={t("edit.phAmount")}
                  aria-label={`${t("edit.phAmount")} ${i + 1}`}
                  onChange={(e) => setIngredients((v) => v.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))}
                />
                <input
                  className="field__input"
                  value={row.note}
                  placeholder={t("edit.phNote")}
                  aria-label={`${t("edit.phNote")} ${i + 1}`}
                  onChange={(e) => setIngredients((v) => v.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))}
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

        {/* ------------------------------------------------------- 조리 단계 */}
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

        <label className="field editor__section">
          <span className="field__label">{t("edit.garnish")}</span>
          <textarea
            className="field__input field__input--area"
            value={garnish}
            rows={2}
            onChange={(e) => setGarnish(e.target.value)}
          />
        </label>

        <p className="editor__locked">{t("add.enHint")}</p>

        <div className="modal__actions">
          <button type="button" className="btn" onClick={onClose}>
            {t("edit.cancel")}
          </button>
          <button type="submit" className="btn btn--primary" disabled={!ready}>
            {t("add.submit")}
          </button>
        </div>
        {!ready && <p className="modal__note">{t("add.required")}</p>}
      </form>
    </div>
  );
}
