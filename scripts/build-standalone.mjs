/**
 * 단일 HTML 파일 빌드.
 *
 * JS·CSS·사진 84장을 전부 하나의 .html 안에 박아 넣는다. 결과 파일은
 * 인터넷 없이 더블클릭만으로 열리고, 카톡/USB/메일로 그대로 전달할 수 있다.
 *
 *   node scripts/build-standalone.mjs   (npm run standalone)
 *   -> public/everest-recipe-book.html
 *
 * public/ 에 두면 배포 사이트에도 그대로 실려서, 푸터의 「앱 통째로 내려받기」
 * 링크로 누구나 받아 갈 수 있다. (파일명은 ASCII 로 두고, 저장될 때의 이름만
 * download 속성으로 한글을 지정한다 — 정적 호스팅에서 가장 안전하다.)
 *
 * file:// 에서 ES 모듈은 CORS 때문에 막히므로 iife 로 번들한다.
 */
import { build } from "vite";
import react from "@vitejs/plugin-react";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const WORK = path.join(ROOT, ".standalone-build");
const OUT_DIR = path.join(ROOT, "public");
const OUT_FILE = path.join(OUT_DIR, "everest-recipe-book.html");

const kb = (n) => `${(n / 1024).toFixed(0)} kB`;
const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;

// ------------------------------------------------------------------ 1. 번들

await rm(WORK, { recursive: true, force: true });

await build({
  configFile: false,
  root: ROOT,
  base: "./",
  logLevel: "warn",
  plugins: [react()],
  // 사진은 아래에서 직접 data URI 로 박으므로 public/ 을 복사할 필요가 없다.
  publicDir: false,
  define: { __STANDALONE__: "true" },
  build: {
    outDir: WORK,
    emptyOutDir: true,
    assetsInlineLimit: 0,
    cssCodeSplit: false,
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        format: "iife",
        inlineDynamicImports: true,
        entryFileNames: "app.js",
        assetFileNames: "app.[ext]",
      },
    },
  },
});

// ------------------------------------------------------- 2. 사진 -> data URI

const IMG_DIR = path.join(ROOT, "public", "images", "recipes");
const images = new Map();
for (const name of await readdir(IMG_DIR)) {
  if (!name.endsWith(".png")) continue;
  const bytes = await readFile(path.join(IMG_DIR, name));
  images.set(`images/recipes/${name}`, `data:image/png;base64,${bytes.toString("base64")}`);
}

let js = await readFile(path.join(WORK, "app.js"), "utf8");
const rawJs = js.length;

let inlined = 0;
for (const [ref, uri] of images) {
  const before = js;
  js = js.split(`"${ref}"`).join(JSON.stringify(uri));
  if (js !== before) inlined++;
}

// 번들에 남은 상대 경로가 있으면 그 사진은 파일 하나만 열었을 때 깨진다.
const orphans = [...js.matchAll(/images\/recipes\/[a-z0-9-]+\.png/g)].map((m) => m[0]);
if (orphans.length) {
  console.error(`✗ 인라인되지 않은 사진 경로: ${[...new Set(orphans)].join(", ")}`);
  process.exit(1);
}

// ------------------------------------------------------------------ 3. 조립

const css = await readFile(path.join(WORK, "app.css"), "utf8");
const html = await readFile(path.join(WORK, "index.html"), "utf8");

/** 인라인 <script>/<style> 를 조기에 닫아버릴 수 있는 시퀀스만 무해화한다. */
const guard = (s) => s.replace(/<\/(script|style)/gi, "<\\/$1").replace(/<!--/g, "<\\!--");

const head = html.slice(0, html.indexOf("</head>"));
const meta = head
  .replace(/^[\s\S]*?<head>/i, "")
  // 외부 파일을 가리키는 태그는 전부 걷어내고 인라인으로 대체한다.
  .replace(/<script[^>]*><\/script>/gi, "")
  .replace(/<link[^>]*rel="(stylesheet|modulepreload)"[^>]*>/gi, "")
  .trim();

const out = `<!doctype html>
<html lang="ko">
<head>
${meta}
<!--
  에베레스트 레시피북 — 단일 파일 버전
  이 파일 하나에 앱 전체(메뉴 87 + 프렙 11, 사진 84장)가 들어 있습니다.
  인터넷 연결 없이 더블클릭으로 열리며, 그대로 복사해 나눠 주셔도 됩니다.
-->
<style>
${guard(css)}
</style>
</head>
<body>
<div id="root"></div>
<script>
${guard(js)}
</script>
</body>
</html>
`;

await mkdir(OUT_DIR, { recursive: true });
await writeFile(OUT_FILE, out, "utf8");
await rm(WORK, { recursive: true, force: true });

const size = Buffer.byteLength(out, "utf8");
console.log(`✓ ${path.relative(ROOT, OUT_FILE)}`);
console.log(`  사진 ${inlined}/${images.size}장 인라인 · JS ${kb(rawJs)} · CSS ${kb(css.length)}`);
console.log(`  최종 ${mb(size)} — 파일 하나, 외부 요청 0건`);
