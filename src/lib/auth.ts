/**
 * 매니저 로그인.
 *
 * 서버가 없는 정적 앱이라 검증이 브라우저 안에서 일어난다. 비밀번호 자체는
 * 어디에도 없고 PBKDF2-SHA256(20만 회) 해시만 번들에 실리지만, 받아 간 사람이
 * 오프라인에서 대입을 시도하는 것까지 막지는 못한다.
 *
 * 즉 이 잠금의 목적은 **주방에서 지나가다 실수로 레시피를 고치는 일을 막는 것**
 * 이지, 작정한 사람으로부터 데이터를 지키는 보안이 아니다. 계정은
 * auth/managers.json 에 있고 `npm run user` 로 관리한다.
 */
import { useCallback, useEffect, useState } from "react";
import managers from "../../auth/managers.json";

export interface Manager {
  id: string;
  name: string;
}

interface Account extends Manager {
  salt: string;
  hash: string;
}

// 계정이 하나도 없을 때 users 가 never[] 로 추론되므로 형태를 명시한다.
const db = managers as { version: number; iterations: number; users: Account[] };

interface Session extends Manager {
  /** 로그인 시각(ms). 공용 태블릿이 계속 수정 가능 상태로 남지 않도록 만료시킨다. */
  at: number;
}

const KEY = "everest-recipe:session";
const MAX_AGE = 12 * 60 * 60 * 1000; // 12시간

const toBytes = (hex: string) =>
  Uint8Array.from((hex.match(/../g) ?? []).map((h) => parseInt(h, 16)));

const toHex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function derive(password: string, saltHex: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: toBytes(saltHex), iterations: db.iterations, hash: "SHA-256" },
    key,
    256
  );
  return toHex(bits);
}

/** 길이가 같은 문자열끼리 상수 시간 비교 — 타이밍으로 정답을 좁히지 못하게. */
function equals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type LoginResult = { ok: true; manager: Manager } | { ok: false; reason: "bad" | "unsupported" };

export async function login(id: string, password: string): Promise<LoginResult> {
  if (!crypto?.subtle) return { ok: false, reason: "unsupported" };
  const user = db.users.find((u) => u.id === id.trim());
  // 아이디가 없어도 같은 시간을 쓰도록 더미 해시를 한 번 돌린다.
  const salt = user?.salt ?? "00000000000000000000000000000000";
  const computed = await derive(password, salt);
  if (!user || !equals(computed, user.hash)) return { ok: false, reason: "bad" };
  return { ok: true, manager: { id: user.id, name: user.name } };
}

export const hasAccounts = db.users.length > 0;

function readSession(): Manager | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (!s?.id || Date.now() - s.at > MAX_AGE) {
      localStorage.removeItem(KEY);
      return null;
    }
    // 계정이 지워졌다면 세션도 무효로 본다.
    if (!db.users.some((u) => u.id === s.id)) return null;
    return { id: s.id, name: s.name };
  } catch {
    return null;
  }
}

export function useAuth() {
  const [manager, setManager] = useState<Manager | null>(() => readSession());

  // 만료되면 스스로 수정 모드에서 빠져나온다.
  useEffect(() => {
    if (!manager) return;
    const timer = setInterval(() => {
      if (!readSession()) setManager(null);
    }, 60_000);
    return () => clearInterval(timer);
  }, [manager]);

  const signIn = useCallback(async (id: string, password: string): Promise<LoginResult> => {
    const result = await login(id, password);
    if (result.ok) {
      try {
        localStorage.setItem(KEY, JSON.stringify({ ...result.manager, at: Date.now() }));
      } catch {
        /* 저장 못 해도 이번 세션 동안은 수정할 수 있다 */
      }
      setManager(result.manager);
    }
    return result;
  }, []);

  const signOut = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* 무시 */
    }
    setManager(null);
  }, []);

  return { manager, signIn, signOut, canEdit: manager !== null };
}
