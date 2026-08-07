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

const VALID_GROUPS = ["커리", "탄두리", "스낵", "빵류", "밥·면", "수프·샐러드", "디저트·음료", "세트"];
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
  for (const key of ["cookTimeMin", "cookTimeMax", "ingredientCount", "stepCount"]) {
    if (typeof fm[key] !== "number") fail(file, `필수 숫자 필드 누락: ${key}`);
  }
  if (!Array.isArray(fm.tags)) fail(file, "tags 는 배열이어야 합니다");

  // 4) group 고정 8종
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
    tags: fm.tags,
    ingredients,
    steps,
    garnish,
  });
}

if (errors.length) {
  console.error(`\n스키마 검증 실패 — ${errors.length}건\n`);
  for (const e of errors) console.error("  ✗ " + e);
  console.error("");
  process.exit(1);
}

recipes.sort((a, b) => a.name.localeCompare(b.name, "ko"));

mkdirSync(dirname(OUT_FILE), { recursive: true });
writeFileSync(OUT_FILE, JSON.stringify(recipes, null, 0) + "\n", "utf8");

const byGroup = {};
for (const r of recipes) byGroup[r.group] = (byGroup[r.group] ?? 0) + 1;

console.log(`✓ 레시피 ${recipes.length}건 검증 통과 -> src/data/recipes.json`);
console.log(
  "  " +
    VALID_GROUPS.filter((g) => byGroup[g]).map((g) => `${g} ${byGroup[g]}`).join("  ·  ")
);
