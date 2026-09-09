/**
 * 검색어 정규화 · 동의어 사전.
 * 띄어쓰기·기호·대소문자·전각 차이를 없애고, 종류 동의어(막걸리=탁주 등)를 표준 종류로 맞춘다.
 */

/** 공백·구두점 제거, 소문자, 전각→반각, NFC */
export function normalize(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0)) // 전각 영숫자·기호 → 반각
    .replace(/[\s\-_·.,'"“”‘’()\[\]{}!?~/\\|:;+*&%#@^]/g, "")
    .trim();
}

/** 술 종류 동의어 → 데이터 category (탁주·약주·청주·증류주·과실주·리큐르·브랜디·허니와인) */
export const CATEGORY_SYNONYMS: Record<string, string> = {
  막걸리: "탁주", 생막걸리: "탁주", 탁주: "탁주", 탁배기: "탁주", 동동주: "탁주",
  약주: "약주", 청주: "청주", 정종: "청주",
  소주: "증류주", 증류주: "증류주", 증류식소주: "증류주", 전통소주: "증류주", 화요류: "증류주", 안동소주: "증류주",
  과실주: "과실주", 와인: "과실주", 사과주: "과실주", 사과와인: "과실주", 복분자주: "과실주", 매실주: "과실주", 오미자주: "과실주",
  리큐르: "리큐르", 리큐어: "리큐르", 담금주: "리큐르",
  브랜디: "브랜디",
  허니와인: "허니와인", 미드: "허니와인", 벌꿀술: "허니와인", 꿀술: "허니와인",
};
const CATEGORY_KEYS = Object.keys(CATEGORY_SYNONYMS).sort((a, b) => b.length - a.length);

/** 정규화된 검색어가 통째로 종류 동의어이면 표준 종류 반환 */
export function categoryOf(norm: string): string | null {
  return CATEGORY_SYNONYMS[norm] ?? null;
}
/** 문장 안에서 종류 동의어를 찾는다 (긴 단어 우선). 없으면 null */
export function findCategory(norm: string): { category: string; word: string } | null {
  for (const w of CATEGORY_KEYS) if (norm.includes(w)) return { category: CATEGORY_SYNONYMS[w], word: w };
  return null;
}

/** 검색어 뒤의 군더더기 제거: "복순도가 술" → "복순도가", "육회 안주" → "육회" (남는 길이가 2 이상일 때만) */
const SUFFIXES = ["추천해줘", "추천", "맛집", "안주", "술", "찾기", "검색", "어때"];
export function stripSuffix(norm: string): string {
  for (const suf of SUFFIXES) {
    if (norm.length > suf.length + 1 && norm.endsWith(suf)) return norm.slice(0, -suf.length);
  }
  return norm;
}
