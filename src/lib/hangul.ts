/** 한글 초성 검색 유틸. "ㅊㅋ" 로 "치킨 커리" 를 찾기 위한 것. */

const CHOSEONG = [
  "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
  "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
] as const;

const SYLLABLE_START = 0xac00;
const SYLLABLE_END = 0xd7a3;
const JAMO_PER_CHOSEONG = 588; // 21 중성 × 28 종성

/** 겹자음 입력을 홑자음으로 정규화 (ㄳ→ㄱ 등 키보드 입력 편의). */
const COMPAT_FOLD: Record<string, string> = {
  "ㄳ": "ㄱ", "ㄵ": "ㄴ", "ㄶ": "ㄴ", "ㄺ": "ㄹ", "ㄻ": "ㄹ",
  "ㄼ": "ㄹ", "ㄽ": "ㄹ", "ㄾ": "ㄹ", "ㄿ": "ㄹ", "ㅀ": "ㄹ", "ㅄ": "ㅂ",
};

/** 문자열이 초성 자모로만 이루어졌는지. */
export function isChoseongQuery(query: string): boolean {
  const compact = query.replace(/\s+/g, "");
  if (compact.length === 0) return false;
  return [...compact].every((ch) => CHOSEONG.includes(fold(ch) as never));
}

function fold(ch: string): string {
  return COMPAT_FOLD[ch] ?? ch;
}

/** 문자열의 초성 시퀀스를 뽑는다. 한글이 아닌 문자는 그대로 둔다. */
export function toChoseong(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code >= SYLLABLE_START && code <= SYLLABLE_END) {
      out += CHOSEONG[Math.floor((code - SYLLABLE_START) / JAMO_PER_CHOSEONG)];
    } else {
      out += ch;
    }
  }
  return out;
}

export function normalizeChoseongQuery(query: string): string {
  return [...query.replace(/\s+/g, "")].map(fold).join("");
}
