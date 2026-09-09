/**
 * 한글 처리 — 초성 추출, 자모 분해.
 * 검색 엔진(search/)의 기반. 조합 중인 입력("복순ㄷ")과 오타 허용 매칭에 쓴다.
 */

export const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const JUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ";
const JONG = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
/** 겹받침을 낱자모로 (검색 편집거리용) */
const JONG_SPLIT: Record<string, string> = { "ㄳ": "ㄱㅅ", "ㄵ": "ㄴㅈ", "ㄶ": "ㄴㅎ", "ㄺ": "ㄹㄱ", "ㄻ": "ㄹㅁ", "ㄼ": "ㄹㅂ", "ㄽ": "ㄹㅅ", "ㄾ": "ㄹㅌ", "ㄿ": "ㄹㅍ", "ㅀ": "ㄹㅎ", "ㅄ": "ㅂㅅ" };

export const isSyllable = (c: number) => c >= 0xac00 && c <= 0xd7a3;
export const isJamo = (ch: string) => /^[ㄱ-ㅎㅏ-ㅣ]$/.test(ch);
export const isChoseong = (ch: string) => CHO.includes(ch);

/** 문자열의 초성만 (한글 음절 → 초성, 그 외 문자는 그대로) */
export function choseong(str: string): string {
  let out = "";
  for (const ch of str) {
    const c = ch.charCodeAt(0);
    out += isSyllable(c) ? CHO[Math.floor((c - 0xac00) / 588)] : ch;
  }
  return out;
}

/** 음절 하나를 자모열로. 겹받침은 낱자모로 펼친다. 한글이 아니면 그대로 */
export function decomposeChar(ch: string): string {
  const c = ch.charCodeAt(0);
  if (!isSyllable(c)) return ch;
  const i = c - 0xac00;
  const cho = CHO[Math.floor(i / 588)];
  const jung = JUNG[Math.floor((i % 588) / 28)];
  const jong = JONG[i % 28];
  return cho + jung + (JONG_SPLIT[jong] ?? jong);
}

/** 문자열 전체를 자모열로 ("복순" → "ㅂㅗㄱㅅㅜㄴ") */
export function toJamo(str: string): string {
  let out = "";
  for (const ch of str) out += decomposeChar(ch);
  return out;
}

/** 입력이 초성만으로 이뤄졌는지 ("ㅂㅅㄷㄱ") */
export const isChoseongOnly = (s: string) => s.length > 0 && [...s].every(isChoseong);
