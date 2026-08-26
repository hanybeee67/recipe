#!/usr/bin/env node
/**
 * 매니저 계정 관리.
 *
 *   npm run user list
 *   npm run user add    <아이디> <이름> [비밀번호]   비밀번호 생략 시 임의 생성
 *   npm run user passwd <아이디> [비밀번호]
 *   npm run user remove <아이디>
 *
 * 비밀번호는 저장하지 않는다. PBKDF2-SHA256(20만 회) 해시만 auth/managers.json 에
 * 남는다. 다만 그 파일은 앱 번들에 함께 실리므로, 받아 간 사람이 오프라인에서
 * 대입 공격을 시도할 수는 있다. 다른 곳에서 쓰는 비밀번호를 재사용하지 말 것.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const FILE = fileURLToPath(new URL("../auth/managers.json", import.meta.url));
const ITERATIONS = 200_000;

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

export async function hashPassword(password, saltHex) {
  const salt = Uint8Array.from(saltHex.match(/../g).map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    key,
    256
  );
  return hex(bits);
}

/** 전화로 불러주기 쉬운 임의 비밀번호 — 매장에서 쓰는 낱말 + 네 자리 숫자. */
function generatePassword() {
  const words = ["momo", "naan", "kadai", "tandoor", "masala", "paneer", "chai", "gravy", "sherpa", "annapurna"];
  const pick = (a) => a[crypto.getRandomValues(new Uint32Array(1))[0] % a.length];
  const digits = String(crypto.getRandomValues(new Uint32Array(1))[0] % 9000 + 1000);
  return `${pick(words)}-${pick(words)}-${digits}`;
}

const load = () => JSON.parse(readFileSync(FILE, "utf8"));
const save = (db) => writeFileSync(FILE, JSON.stringify(db, null, 2) + "\n", "utf8");

const [cmd, ...args] = process.argv.slice(2);
const db = load();

function die(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

switch (cmd) {
  case "list": {
    if (!db.users.length) {
      console.log("등록된 계정이 없다. `npm run user add <아이디> <이름>` 으로 만든다.");
      break;
    }
    console.log(`계정 ${db.users.length}개 (PBKDF2-SHA256 ${db.iterations.toLocaleString()}회)`);
    for (const u of db.users) console.log(`  ${u.id.padEnd(14)} ${u.name}`);
    break;
  }

  case "add": {
    const [id, name, given] = args;
    if (!id || !name) die("사용법: npm run user add <아이디> <이름> [비밀번호]");
    if (db.users.some((u) => u.id === id)) die(`이미 있는 아이디: ${id}`);
    const password = given || generatePassword();
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    db.users.push({ id, name, salt, hash: await hashPassword(password, salt) });
    save(db);
    console.log(`✓ 계정 생성: ${id} (${name})`);
    if (!given) console.log(`  비밀번호: ${password}   ← 지금 적어 두세요. 다시 볼 수 없습니다.`);
    break;
  }

  case "passwd": {
    const [id, given] = args;
    const user = db.users.find((u) => u.id === id);
    if (!user) die(`없는 아이디: ${id}`);
    const password = given || generatePassword();
    user.salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    user.hash = await hashPassword(password, user.salt);
    save(db);
    console.log(`✓ 비밀번호 변경: ${id}`);
    if (!given) console.log(`  새 비밀번호: ${password}   ← 지금 적어 두세요.`);
    break;
  }

  case "remove": {
    const [id] = args;
    const before = db.users.length;
    db.users = db.users.filter((u) => u.id !== id);
    if (db.users.length === before) die(`없는 아이디: ${id}`);
    save(db);
    console.log(`✓ 계정 삭제: ${id}`);
    break;
  }

  default:
    console.log(`매니저 계정 관리

  npm run user list
  npm run user add    <아이디> <이름> [비밀번호]
  npm run user passwd <아이디> [비밀번호]
  npm run user remove <아이디>

비밀번호를 생략하면 임의로 만들어 한 번만 보여준다.
계정을 고친 뒤에는 npm run build 로 다시 배포해야 반영된다.`);
}
