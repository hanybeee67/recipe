/**
 * 앱에서 내보낸 수정 파일을 저장소에 반영한다.
 *
 *   node scripts/apply-edits.mjs <recipe-edits-2026-08-26.json> [--dry-run]
 *   (npm run apply-edits -- <파일>)
 *
 * 한국어 수정분은 recipes/*.md 를, 영어 수정분은 i18n/en/*.json 을 고친다.
 * 한국어 원문이 바뀌면 번역 사전의 키도 함께 옮겨서 기존 영어 문장을 잃지 않는다.
 *
 * 새로 생긴 한국어 문장에 대응하는 영어가 없으면 **지어내지 않는다.** 대신
 * 목록으로 보여주고 i18n/en/_missing.json 에 빈 칸으로 적어 둔다. 그대로 두면
 * npm run build 가 "번역 누락" 으로 실패하므로 영어 화면에 한국어가 새어나가지 않는다.
 */
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const RECIPES_DIR = join(ROOT, "recipes");
const EN_DIR = join(ROOT, "i18n", "en");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const file = args.find((a) => !a.startsWith("--"));

if (!file) {
  console.error(`사용법: npm run apply-edits -- <내보낸-파일.json> [--dry-run]`);
  process.exit(1);
}

const hasHangul = (s) => /[가-힣]/.test(s);

// ------------------------------------------------------------------ 읽기

const payload = JSON.parse(readFileSync(file, "utf8"));
if (payload.format !== "everest-recipe-edits") {
  console.error(`✗ 이 앱에서 내보낸 파일이 아닙니다 (format: ${payload.format ?? "없음"})`);
  process.exit(1);
}

const readJson = (name) => JSON.parse(readFileSync(join(EN_DIR, name), "utf8"));
const terms = readJson("terms.json");
const enIngredients = readJson("ingredients.json");
const enGarnish = readJson("garnish.json");
const enSteps = readJson("steps.json");

const missing = []; // { kind, ko }
const touched = { md: [], i18n: new Set() };
const log = [];

// ------------------------------------------------------------------ md 파싱

function splitFrontMatter(raw) {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
  if (!m) throw new Error("프론트매터를 찾지 못했습니다");
  return { fmLines: m[1].split("\n"), body: m[2] };
}

function fmValue(fmLines, key) {
  const line = fmLines.find((l) => l.startsWith(`${key}: `));
  if (!line) return null;
  const v = line.slice(key.length + 2).trim();
  return v.length > 1 && v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1) : v;
}

/** 값에 따옴표가 필요한지 — 숫자·예약어로 오독되거나 앞뒤 공백이 있을 때. */
function fmQuote(value) {
  const s = String(value);
  if (s === "" || s !== s.trim() || /^(null|true|false|-?\d+)$/.test(s) || s.startsWith('"')) {
    return JSON.stringify(s);
  }
  return s;
}

function setFm(fmLines, key, value) {
  const i = fmLines.findIndex((l) => l.startsWith(`${key}: `));
  const line = `${key}: ${typeof value === "number" ? value : fmQuote(value)}`;
  if (i >= 0) fmLines[i] = line;
  return fmLines;
}

function sectionsOf(body) {
  const out = {};
  let current = null;
  let buffer = [];
  const flush = () => current && (out[current] = buffer.join("\n").trim());
  for (const line of body.split("\n")) {
    const h = /^##\s+(.*)$/.exec(line);
    if (h) {
      flush();
      current = h[1].trim();
      buffer = [];
    } else if (current) buffer.push(line);
  }
  flush();
  return out;
}

function parseTable(section) {
  const lines = section.split("\n").filter((l) => l.trim().startsWith("|"));
  const cells = (line) =>
    line.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
  return lines.slice(2).map((l) => {
    const c = cells(l);
    return { name: c[1] ?? "", amount: c[2] ?? "", note: c[3] ?? "" };
  });
}

function parseSteps(section) {
  const steps = [];
  for (const line of (section ?? "").split("\n")) {
    const m = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (m) steps.push(m[1].trim());
    else if (steps.length && line.trim()) steps[steps.length - 1] += " " + line.trim();
  }
  return steps;
}

const escapeCell = (s) => s.replace(/\|/g, "\\|");

function renderMd(fmLines, ingredients, steps, garnish) {
  const rows = ingredients
    .map((i, n) => `| ${n + 1} | ${escapeCell(i.name)} | ${escapeCell(i.amount)} | ${escapeCell(i.note)} |`)
    .join("\n");
  const stepList = steps.map((s, n) => `${n + 1}. ${s}`).join("\n");
  return (
    `---\n${fmLines.join("\n")}\n---\n\n` +
    `## 재료\n\n| # | 재료명 | 수량 | 비고 |\n|---:|---|---|---|\n${rows}\n\n` +
    `## 조리 방법\n\n${stepList}\n` +
    (garnish ? `\n## 가니쉬\n\n${garnish}\n` : "")
  );
}

// ------------------------------------------------------------------ 번역 사전

/**
 * 한국어 키가 바뀌었을 때 사전 항목을 옮긴다.
 *   newEn 이 있으면 그 값을 쓴다 (매니저가 영어도 같이 고친 경우)
 *   없으면 기존 영어를 그대로 물려준다
 *   둘 다 없으면 지어내지 않고 목록에 남긴다
 */
function rekey(dict, dictName, kind, oldKo, newKo, newEn) {
  if (newEn !== undefined && newEn !== "") {
    dict[newKo] = newEn;
    touched.i18n.add(dictName);
    return;
  }
  if (oldKo === newKo) {
    if (dict[newKo] === undefined) missing.push({ kind, ko: newKo });
    return;
  }
  if (dict[oldKo] !== undefined) {
    dict[newKo] = dict[oldKo];
    touched.i18n.add(dictName);
  } else if (dict[newKo] === undefined) {
    missing.push({ kind, ko: newKo });
  }
}

/** "약 3~5분" 처럼 규칙으로 옮겨지는 문장은 사전이 없어도 된다. */
const BY_PATTERN = [
  /^1배치 · 완성 [\d,]+g \(수율 \d+%\)$/,
  /^약 \d+~\d+분$/,
  /^약 \d+분$/,
  /^약 \d+~\d+분 \(\+ 하룻밤 불림\)$/,
  /^약 \d+분 \+ 발효 \d+~\d+시간$/,
];
const coveredByPattern = (s) => BY_PATTERN.some((re) => re.test(s));

// ------------------------------------------------------------------ 반영

const ids = Object.keys(payload.edits);
if (ids.length === 0) {
  console.log("반영할 수정 내용이 없습니다.");
  process.exit(0);
}

console.log(`수정 파일: ${file}`);
console.log(`  작성자 ${payload.by} · 내보낸 시각 ${payload.exportedAt}`);
console.log(`  대상 레시피 ${ids.length}건\n`);

for (const id of ids.sort()) {
  const patch = payload.edits[id];
  const path = join(RECIPES_DIR, `${id}.md`);
  if (!existsSync(path)) {
    console.error(`✗ ${id}.md 가 없습니다 — 건너뜁니다`);
    continue;
  }

  const raw = readFileSync(path, "utf8");
  const { fmLines, body } = splitFrontMatter(raw);
  const sec = sectionsOf(body);

  const oldIngredients = parseTable(sec["재료"] ?? "");
  const oldSteps = parseSteps(sec["조리 방법"]);
  const oldGarnish = (sec["가니쉬"] ?? "").trim();
  const oldName = fmValue(fmLines, "name");
  const oldCookTime = fmValue(fmLines, "cookTime");

  const ko = patch.ko ?? {};
  const en = patch.en ?? {};

  const ingredients = ko.ingredients ?? oldIngredients;
  const steps = ko.steps ?? oldSteps;
  const garnish = ko.garnish ?? oldGarnish;
  const name = ko.name ?? oldName;
  const cookTime = ko.cookTime ?? oldCookTime;

  const changes = [];

  // --- 프론트매터
  if (name !== oldName) {
    setFm(fmLines, "name", name);
    changes.push(`메뉴명 "${oldName}" → "${name}"`);
  }
  if (en.name) {
    const before = fmValue(fmLines, "nameEn");
    if (before !== en.name) {
      setFm(fmLines, "nameEn", en.name);
      changes.push(`영문명 "${before}" → "${en.name}"`);
    }
  }
  if (cookTime !== oldCookTime) {
    setFm(fmLines, "cookTime", cookTime);
    const m = /(\d+)\s*~\s*(\d+)/.exec(cookTime) ?? /(\d+)/.exec(cookTime);
    if (m) {
      setFm(fmLines, "cookTimeMin", Number(m[1]));
      setFm(fmLines, "cookTimeMax", Number(m[2] ?? m[1]));
      changes.push(`조리시간 "${oldCookTime}" → "${cookTime}"`);
    } else {
      changes.push(`조리시간 "${oldCookTime}" → "${cookTime}"  ⚠ 분 단위를 못 읽어 정렬값은 그대로 둡니다`);
    }
    if (!coveredByPattern(cookTime)) {
      rekey(terms.cookTimes, "terms.json", "조리시간", oldCookTime, cookTime, en.cookTime);
    }
  } else if (en.cookTime && !coveredByPattern(cookTime)) {
    terms.cookTimes[cookTime] = en.cookTime;
    touched.i18n.add("terms.json");
  }
  setFm(fmLines, "ingredientCount", ingredients.length);
  setFm(fmLines, "stepCount", steps.length);

  // --- 재료
  if (ko.ingredients || en.ingredients) {
    for (let i = 0; i < ingredients.length; i += 1) {
      const old = oldIngredients[i] ?? { name: "", amount: "", note: "" };
      const now = ingredients[i];
      const enRow = en.ingredients?.[i];

      rekey(enIngredients, "ingredients.json", "재료명", old.name, now.name, enRow?.name);
      if (now.note) rekey(terms.notes, "terms.json", "비고", old.note, now.note, enRow?.note);
      if (hasHangul(now.amount)) {
        rekey(terms.amounts, "terms.json", "수량", old.amount, now.amount, enRow?.amount);
      }
    }
    if (ko.ingredients) {
      const before = oldIngredients.length;
      changes.push(
        before === ingredients.length
          ? `재료 ${ingredients.length}개 중 내용 수정`
          : `재료 ${before}개 → ${ingredients.length}개`
      );
    }
    if (en.ingredients) changes.push(`영문 재료 수정`);
  }

  // --- 조리 단계
  if (ko.steps || en.steps) {
    for (let i = 0; i < steps.length; i += 1) {
      rekey(enSteps, "steps.json", "조리 단계", oldSteps[i] ?? "", steps[i], en.steps?.[i]);
    }
    if (ko.steps) {
      changes.push(
        oldSteps.length === steps.length
          ? `조리 단계 ${steps.length}개 중 내용 수정`
          : `조리 단계 ${oldSteps.length}개 → ${steps.length}개`
      );
    }
    if (en.steps) changes.push(`영문 조리 단계 수정`);
  }

  // --- 가니쉬
  if (ko.garnish !== undefined || en.garnish !== undefined) {
    if (garnish) rekey(enGarnish, "garnish.json", "가니쉬", oldGarnish, garnish, en.garnish);
    changes.push("가니쉬 수정");
  }

  if (!dryRun) {
    writeFileSync(path, renderMd(fmLines, ingredients, steps, garnish), "utf8");
  }
  touched.md.push(id);
  log.push(`  ${id}\n${changes.map((c) => `    · ${c}`).join("\n")}`);
}

console.log(log.join("\n"));

// ------------------------------------------------------------------ 저장

const write = (name, data) =>
  writeFileSync(join(EN_DIR, name), JSON.stringify(sortKeys(data), null, 2) + "\n", "utf8");

/** 사전은 키 순서로 정렬해 둔다 — 나중에 diff 가 읽기 쉬워진다. */
function sortKeys(obj) {
  if (Array.isArray(obj) || typeof obj !== "object" || obj === null) return obj;
  const out = {};
  for (const k of Object.keys(obj).sort((a, b) => a.localeCompare(b, "ko"))) {
    out[k] = typeof obj[k] === "object" && obj[k] !== null ? sortKeys(obj[k]) : obj[k];
  }
  return out;
}

if (!dryRun) {
  if (touched.i18n.has("terms.json")) write("terms.json", terms);
  if (touched.i18n.has("ingredients.json")) write("ingredients.json", enIngredients);
  if (touched.i18n.has("garnish.json")) write("garnish.json", enGarnish);
  if (touched.i18n.has("steps.json")) write("steps.json", enSteps);
}

console.log(
  `\n${dryRun ? "[미리보기] " : "✓ "}레시피 ${touched.md.length}건` +
    (touched.i18n.size ? ` · 번역 사전 ${[...touched.i18n].join(", ")}` : "")
);

// ------------------------------------------------------------------ 번역 누락

const MISSING_FILE = join(EN_DIR, "_missing.json");

if (missing.length) {
  const scaffold = {};
  for (const { kind, ko } of missing) {
    scaffold[kind] ??= {};
    scaffold[kind][ko] = "";
  }
  if (!dryRun) writeFileSync(MISSING_FILE, JSON.stringify(scaffold, null, 2) + "\n", "utf8");

  console.log(`\n⚠ 영어 번역이 없는 문장 ${missing.length}개`);
  for (const { kind, ko } of missing.slice(0, 12)) console.log(`   ${kind}: ${ko}`);
  if (missing.length > 12) console.log(`   … 외 ${missing.length - 12}개`);
  console.log(`
   빈 칸으로 i18n/en/_missing.json 에 적어 두었습니다.
   영어를 채운 뒤 각 항목을 알맞은 사전에 옮기세요.
     재료명 → i18n/en/ingredients.json
     조리 단계 → i18n/en/steps.json
     가니쉬 → i18n/en/garnish.json
     비고 · 수량 · 조리시간 → i18n/en/terms.json 의 notes / amounts / cookTimes

   채우기 전에는 npm run build 가 "번역 누락" 으로 실패합니다.
   (영어 화면에 한국어가 그대로 나가지 않게 하려는 장치입니다.)

   앱에서 EN 으로 바꾼 뒤 같은 자리를 고쳐서 다시 내보내면 이 단계를 건너뜁니다.`);
} else if (existsSync(MISSING_FILE) && !dryRun) {
  unlinkSync(MISSING_FILE);
}

console.log(`\n다음: npm run build 로 검증하고, 문제가 없으면 커밋해서 배포하세요.`);
