/**
 * 분량 배율기.
 * 원본 레시피는 전부 "1인분 기준" 이므로 수치를 배수로 환산한다.
 * 숫자로 시작하는 표기만 스케일하고, 그 외("적당량", "약간")는 원문을 유지한다.
 */

const NUMBER = /^(\d+(?:\.\d+)?)(?:\s*[~-]\s*(\d+(?:\.\d+)?))?/;

function pretty(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, "");
}

/**
 * "100g" ×2 -> "200g",  "1~2개" ×3 -> "3~6개",  "적당량" -> "적당량"
 */
export function scaleAmount(amount: string, multiplier: number): string {
  if (multiplier === 1) return amount;
  const trimmed = amount.trim();
  const m = NUMBER.exec(trimmed);
  if (!m) return amount;

  const rest = trimmed.slice(m[0].length);
  const low = pretty(Number(m[1]) * multiplier);
  if (m[2] !== undefined) {
    return `${low}~${pretty(Number(m[2]) * multiplier)}${rest}`;
  }
  return `${low}${rest}`;
}

/** "1인분 기준" ×3 -> "3인분 기준" */
export function scaleServing(serving: string, multiplier: number): string {
  if (multiplier === 1) return serving;
  return serving.replace(/(\d+(?:\.\d+)?)\s*인분/, (_, n: string) => `${pretty(Number(n) * multiplier)}인분`);
}

export const MULTIPLIERS = [1, 2, 3, 4] as const;
export type Multiplier = (typeof MULTIPLIERS)[number];
