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

export type Theme = "system" | "light" | "dark";

export function useTheme() {
  const [theme, setTheme] = usePersistentState<Theme>("theme", "system");

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
  }, [theme]);

  const cycle = useCallback(() => {
    setTheme((t) => (t === "system" ? "light" : t === "light" ? "dark" : "system"));
  }, [setTheme]);

  return { theme, setTheme, cycle };
}
