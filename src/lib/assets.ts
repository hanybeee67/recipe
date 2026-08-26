/** public/ 하위 자산의 실제 URL. base 가 상대 경로('./')여도 동작한다. */
export function assetUrl(path: string | null): string | null {
  if (!path) return null;
  // 단일 파일 빌드에서는 사진이 data: URI 로 박혀 있다 — base 를 붙이면 안 된다.
  if (path.startsWith("data:")) return path;
  const base = import.meta.env.BASE_URL || "/";
  return base.endsWith("/") ? base + path : `${base}/${path}`;
}

/** 대분류별 대표 이모지 — 사진이 없는 레시피의 플레이스홀더. */
export const GROUP_EMOJI: Record<string, string> = {
  커리: "🍛",
  탄두리: "🍢",
  스낵: "🥟",
  빵류: "🫓",
  "밥·면": "🍚",
  "수프·샐러드": "🥣",
  "디저트·음료": "🍮",
  세트: "🍽️",
};
