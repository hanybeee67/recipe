import { useCallback, useEffect, useState } from "react";

const PREFIX = "everest-recipe:";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* 사파리 프라이빗 모드 등 — 저장 실패는 무시 */
  }
}

export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => read(key, initial));
  useEffect(() => write(key, value), [key, value]);
  return [value, setValue] as const;
}

// ---------------------------------------------------------------- 조리 단계 체크

export function useStepProgress(recipeId: string, stepCount: number) {
  const key = `steps:${recipeId}`;
  const [done, setDone] = useState<number[]>(() => read<number[]>(key, []));

  useEffect(() => {
    setDone(read<number[]>(`steps:${recipeId}`, []));
  }, [recipeId]);

  const toggle = useCallback(
    (index: number) => {
      setDone((prev) => {
        const next = prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index];
        write(`steps:${recipeId}`, next);
        return next;
      });
    },
    [recipeId]
  );

  const reset = useCallback(() => {
    setDone([]);
    write(`steps:${recipeId}`, []);
  }, [recipeId]);

  return {
    done,
    toggle,
    reset,
    isDone: (i: number) => done.includes(i),
    completed: done.length,
    total: stepCount,
  };
}

// -------------------------------------------------------------------- 테마

export type Theme = "light" | "dark";

/**
 * 라이트가 기본이다. 시스템 다크 모드를 자동으로 따라가면 카카오톡 인앱
 * 브라우저처럼 다크가 켜진 환경에서 검은 화면으로 열려버리므로, 다크는
 * 사용자가 직접 켰을 때만 적용한다.
 */
export function useTheme() {
  const [theme, setTheme] = usePersistentState<Theme>("theme", "light");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const cycle = useCallback(() => {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  }, [setTheme]);

  return { theme, setTheme, cycle };
}
