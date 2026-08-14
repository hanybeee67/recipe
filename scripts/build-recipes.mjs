/**
 * recipes/*.md  ->  src/data/recipes.json
 *
 * 레시피_데이터_템플릿.md 6항의 검증 규칙을 강제한다.
 * 위반이 하나라도 있으면 0이 아닌 코드로 종료해 빌드를 실패시킨다.
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RECIPES_DIR = join(ROOT, "recipes");
const PUBLIC_DIR = join(ROOT, "public");
const OUT_FILE = join(ROOT, "src", "data", "recipes.json");

const VALID_GROUPS = ["커리", "탄두리", "스낵", "빵류", "밥·면", "수프·샐러드", "세트", "디저트", "음료", "프렙"];
const TABLE_HEADER = ["#", "재료명", "수량", "비고"];

const errors = [];
const fail = (file, msg) => errors.push(`${file}: ${msg}`);

/** 이 프로젝트가 생성하는 형태만 지원하는 최소 YAML front matter 파서. */
function parseFrontMatter(raw, file) {
  if (!raw.startsWith("---\n")) {
    fail(file, "front matter가 '---' 로 시작하지 않습니다");
    return [null, raw];
  }
  const end = raw.indexOf("\n---", 3);
  if (end === -1) {
    fail(file, "front matter 종료 구분자('---')가 없습니다");
    return [null, raw];
  }
  const head = raw.slice(4, end);
  const body = raw.slice(raw.indexOf("\n", end + 1) + 1);

  const data = {};
  let listKey = null;

  for (const line of head.split("\n")) {
    if (!line.trim()) continue;

    const item = /^\s+-\s+(.*)$/.exec(line);
    if (item && listKey) {
      data[listKey].push(unquote(item[1]));
      continue;
    }

    const kv = /^([A-Za-z][A-Za-z0-9_]*):\s*(.*)$/.exec(line);
    if (!kv) {
      fail(file, `front matter 구문 오류: ${line}`);
      continue;
    }
    const [, key, rawValue] = kv;
    const value = rawValue.trim();

    if (value === "") {
      listKey = key;
      data[key] = [];
    } else if (value === "[]") {
      listKey = null;
      data[key] = [];
    } else {
      listKey = null;
      data[key] = coerce(value);
    }
  }
  return [data, body];
}

function unquote(value) {
  if (value.length > 1 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  return value;
}

function coerce(value) {
  if (value === "null") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+$/.test(value)) return Number(value);
  return unquote(value);
}

/** 본문을 '## 제목' 단위로 쪼갠다. */
function splitSections(body) {
  const sections = {};
  let current = null;
  let buffer = [];

  const flush = () => {
    if (current) sections[current] = buffer.join("\n").trim();
  };

  for (const line of body.split("\n")) {
    const heading = /^##\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      current = heading[1].trim();
      buffer = [];
    } else if (current) {
      buffer.push(line);
    }
  }
  flush();
  return sections;
}

function parseTable(section, file) {
  const lines = section.split("\n").filter((l) => l.trim().startsWith("|"));
  if (lines.length < 2) {
    fail(file, "'## 재료' 섹션에 표가 없습니다");
    return [];
  }

  const cells = (line) =>
    line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split(/(?<!\\)\|/)
      .map((c) => c.trim().replace(/\\\|/g, "|"));

  const header = cells(lines[0]);
  if (header.join("/") !== TABLE_HEADER.join("/")) {
    fail(file, `재료 표 헤더가 '${TABLE_HEADER.join(" / ")}' 가 아닙니다: ${header.join(" / ")}`);
  }

  const rows = [];
  for (const line of lines.slice(2)) {
    const c = cells(line);
    if (c.length < 4) {
      fail(file, `재료 행의 열이 4개가 아닙니다: ${line}`);
      continue;
    }
    rows.push({ no: Number(c[0]) || rows.length + 1, name: c[1], amount: c[2], note: c[3] });
  }
  return rows;
}

function parseSteps(section) {
  if (!section) return [];
  const steps = [];
  for (const line of section.split("\n")) {
    const m = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (m) steps.push(m[1].trim());
    else if (steps.length && line.trim()) steps[steps.length - 1] += " " + line.trim();
  }
  return steps;
}

// ---------------------------------------------------------------------------

const files = readdirSync(RECIPES_DIR)
  .filter((f) => f.endsWith(".md"))
  .sort();

if (files.length === 0) {
  console.error("recipes/ 에 마크다운이 없습니다. 먼저 `npm run convert` 를 실행하세요.");
  process.exit(1);
}

const seen = new Set();
const recipes = [];

for (const file of files) {
  const raw = readFileSync(join(RECIPES_DIR, file), "utf8");
  const [fm, body] = parseFrontMatter(raw, file);
  if (!fm) continue;

  const slug = file.replace(/\.md$/, "");

  // 1) id ↔ 파일명
  if (fm.id !== slug) fail(file, `id(${fm.id}) 가 파일명(${slug}) 과 다릅니다`);
  // 2) id 유일성
  if (seen.has(fm.id)) fail(file, `id 중복: ${fm.id}`);
  seen.add(fm.id);

  // 3) 필수 필드 / 타입
  for (const key of ["name", "nameEn", "category", "group", "serving", "cookTime"]) {
    if (typeof fm[key] !== "string") fail(file, `필수 문자열 필드 누락: ${key}`);
  }
  for (const key of ["cookTimeMin", "cookTimeMax", "ingredientCount", "stepCount", "order"]) {
    if (typeof fm[key] !== "number") fail(file, `필수 숫자 필드 누락: ${key}`);
  }
  if (!Array.isArray(fm.tags)) fail(file, "tags 는 배열이어야 합니다");

  // 4) group 고정 9종
  if (!VALID_GROUPS.includes(fm.group)) fail(file, `허용되지 않은 group: ${fm.group}`);

  const sections = splitSections(body);
  const ingredients = parseTable(sections["재료"] ?? "", file);
  const steps = parseSteps(sections["조리 방법"]);
  const garnish = (sections["가니쉬"] ?? "").trim();

  // 5) 파생값 일치
  if (fm.ingredientCount !== ingredients.length)
    fail(file, `ingredientCount(${fm.ingredientCount}) != 실제 재료 수(${ingredients.length})`);
  if (fm.stepCount !== steps.length)
    fail(file, `stepCount(${fm.stepCount}) != 실제 단계 수(${steps.length})`);
  if (steps.length === 0) fail(file, "조리 단계가 없습니다");

  // 6) 이미지 실존
  if (fm.image && !existsSync(join(PUBLIC_DIR, fm.image)))
    fail(file, `image 파일이 없습니다: public/${fm.image}`);

  recipes.push({
    id: fm.id,
    name: fm.name,
    nameEn: fm.nameEn,
    category: fm.category,
    group: fm.group,
    serving: fm.serving,
    cookTime: fm.cookTime,
    cookTimeMin: fm.cookTimeMin,
    cookTimeMax: fm.cookTimeMax,
    image: fm.image ?? null,
    imageNote: fm.imageNote ?? null,
    order: fm.order,
    tags: fm.tags,
    ingredients,
    steps,
    garnish,
  });
}

// ------------------------------------------------------------- 프렙 연결
//
// 레시피북의 재료명과 원가표의 프렙명이 표기가 조금씩 다르다.
// 어느 재료가 어느 프렙인지 여기서 한 번만 정해 두고, 재료 -> 프렙(정방향)과
// 프렙 -> 이 프렙을 쓰는 메뉴(역방향)를 모두 연결한다.
const PREP_BY_INGREDIENT = {
  "커리 그레이비 소스": "prep-curry-gravy",
  "탄두리 소스": "prep-tandoori-marinade",
  "펄럭(시금치) 소스": "prep-palak-base",
  "달머커니 소스": "prep-dal-makhani-base",
  "베이비커리 소스": "prep-baby-curry-base",
  "요거트 소스": "prep-house-yogurt",
  요거트: "prep-house-yogurt",
  "퍼니르 (치즈)": "prep-paneer",
  "퍼니르(치즈)": "prep-paneer",
  "치즈 (퍼니르)": "prep-paneer",
  "탄두리 샐라드": "prep-tandoori-slaw",
  "고수 소스": "prep-coriander-chutney",
  "마늘생강 페이스트": "prep-garlic-ginger-paste",
};

const byId = new Map(recipes.map((r) => [r.id, r]));
const usedIn = new Map();

for (const recipe of recipes) {
  if (recipe.group === "프렙") continue;
  for (const ingredient of recipe.ingredients) {
    const prepId = PREP_BY_INGREDIENT[ingredient.name];
    if (!prepId) continue;
    if (!byId.has(prepId)) {
      fail(`${recipe.id}.md`, `프렙 연결 대상이 없습니다: ${ingredient.name} -> ${prepId}`);
      continue;
    }
    ingredient.prepId = prepId;
    if (!usedIn.has(prepId)) usedIn.set(prepId, []);
    const list = usedIn.get(prepId);
    if (!list.some((r) => r.id === recipe.id)) {
      list.push({ id: recipe.id, name: recipe.name, nameEn: recipe.nameEn });
    }
  }
}

for (const [prepId, list] of usedIn) {
  byId.get(prepId).usedIn = list.sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

// ---------------------------------------------------------------- 영어판 병합
//
// 한국어 md 가 원본이고, i18n/en/*.json 이 그 위에 얹히는 번역층이다.
// 번역이 하나라도 비면 영어판이 한국어로 새어나오므로 빌드를 실패시킨다.

const EN_DIR = join(ROOT, "i18n", "en");
const readJson = (name) => JSON.parse(readFileSync(join(EN_DIR, name), "utf8"));

const terms = readJson("terms.json");
const enIngredients = readJson("ingredients.json");
const enGarnish = readJson("garnish.json");
const enSteps = readJson("steps.json");

const hasHangul = (s) => /[가-힣]/.test(s);
const missing = new Map(); // "종류: 원문" -> 사용 레시피

/**
 * 사전에 없어도 형태만 보고 옮길 수 있는 것들.
 * 프렙의 "1배치 · 완성 59,904g (수율 78%)" 나 "약 90~120분" 처럼 값만 다른
 * 문장을 일일이 사전에 넣지 않기 위한 규칙이다.
 */
const PATTERNS = [
  [/^1배치 · 완성 ([\d,]+)g \(수율 (\d+)%\)$/, (m) => `1 batch · yields ${m[1]}g (${m[2]}% yield)`],
  [/^약 (\d+)~(\d+)분$/, (m) => `About ${m[1]}–${m[2]} min`],
  [/^약 (\d+)분$/, (m) => `About ${m[1]} min`],
  [
    /^약 (\d+)~(\d+)분 \(\+ 하룻밤 불림\)$/,
    (m) => `About ${m[1]}–${m[2]} min (+ overnight soak)`,
  ],
  [
    /^약 (\d+)분 \+ 발효 (\d+)~(\d+)시간$/,
    (m) => `About ${m[1]} min + ${m[2]}–${m[3]} h fermenting`,
  ],
];

function byPattern(key) {
  for (const [re, build] of PATTERNS) {
    const m = re.exec(key);
    if (m) return build(m);
  }
  return null;
}

function tr(dict, key, kind, recipeId) {
  const hit = dict[key] ?? byPattern(key);
  if (hit) return hit;
  const slot = `${kind}: ${key}`;
  if (!missing.has(slot)) missing.set(slot, recipeId);
  return key;
}

for (const r of recipes) {
  r.en = {
    group: tr(terms.groups, r.group, "group", r.id),
    category: tr(terms.categories, r.category, "category", r.id),
    serving: tr(terms.servings, r.serving, "serving", r.id),
    cookTime: tr(terms.cookTimes, r.cookTime, "cookTime", r.id),
    imageNote: r.imageNote ? tr(terms.imageNotes ?? {}, r.imageNote, "imageNote", r.id) : null,
    tags: r.tags.map((t) => tr(terms.tags, t, "tag", r.id)),
    ingredients: r.ingredients.map((i) => ({
      no: i.no,
      name: tr(enIngredients, i.name, "ingredient", r.id),
      // 수량은 대부분 "100g" 처럼 언어 중립이라 한글이 든 표기만 바꾼다
      amount: hasHangul(i.amount) ? tr(terms.amounts, i.amount, "amount", r.id) : i.amount,
      note: i.note ? tr(terms.notes, i.note, "note", r.id) : "",
      // 프렙 링크는 언어와 무관하므로 그대로 물려준다
      ...(i.prepId ? { prepId: i.prepId } : {}),
    })),
    steps: r.steps.map((s) => tr(enSteps, s, "step", r.id)),
    garnish: r.garnish ? tr(enGarnish, r.garnish, "garnish", r.id) : "",
  };
}

if (missing.size) {
  for (const [slot, recipeId] of missing) fail(`i18n/en (${recipeId})`, `번역 누락 — ${slot}`);
}

// 메뉴판 순서로 내보낸다 — 앱·PDF 목차가 이 순서를 그대로 쓴다
recipes.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "ko"));

// 7) order 중복 — 두 메뉴의 순서가 같으면 나열 순서가 불안정해진다
for (let i = 1; i < recipes.length; i += 1) {
  if (recipes[i].order === recipes[i - 1].order) {
    fail(`${recipes[i].id}.md`, `order 값이 ${recipes[i - 1].id} 와 중복 (${recipes[i].order})`);
  }
}

if (errors.length) {
  console.error(`\n스키마 검증 실패 — ${errors.length}건\n`);
  for (const e of errors) console.error("  ✗ " + e);
  console.error("");
  process.exit(1);
}

mkdirSync(dirname(OUT_FILE), { recursive: true });
writeFileSync(OUT_FILE, JSON.stringify(recipes, null, 0) + "\n", "utf8");

const byGroup = {};
for (const r of recipes) byGroup[r.group] = (byGroup[r.group] ?? 0) + 1;

console.log(`✓ 레시피 ${recipes.length}건 검증 통과 -> src/data/recipes.json`);
console.log(
  "  " +
    VALID_GROUPS.filter((g) => byGroup[g]).map((g) => `${g} ${byGroup[g]}`).join("  ·  ")
);
