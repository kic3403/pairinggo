/**
 * 목록 가나다 바로가기(2026-09-29 사용자 요청 — 술 558종을 60종씩 넘기면 뒤쪽 술을 찾으려 여러 번 눌러야 한다).
 * 이름 첫 글자로 ㄱ~ㅎ(된소리는 예사소리 칸: ㄲ→ㄱ), 영문 A–Z, 숫자·기호 0–9 칸에 넣는다. 목록 위 칸을 누르면 그 글자로 시작하는 술만.
 */
import { choseong } from "./hangul";

export const NAME_INDEX_KEYS = ["ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ", "ㅂ", "ㅅ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ", "A-Z", "0-9"] as const;
export type NameIndexKey = (typeof NAME_INDEX_KEYS)[number];
const TENSE: Record<string, string> = { "ㄲ": "ㄱ", "ㄸ": "ㄷ", "ㅃ": "ㅂ", "ㅆ": "ㅅ", "ㅉ": "ㅈ" };

/** 이름 → 바로가기 칸. 앞 공백·따옴표·괄호는 건너뛴다 */
export function nameIndexOf(name: string): NameIndexKey {
  const ch = (name || "").replace(/^[\s"'“”‘’(\[「『<]+/, "").charAt(0);
  if (!ch) return "0-9";
  if (/[a-z]/i.test(ch)) return "A-Z";
  const c = choseong(ch);
  const k = TENSE[c] ?? c;
  return (NAME_INDEX_KEYS as readonly string[]).includes(k) && k !== "A-Z" && k !== "0-9" ? (k as NameIndexKey) : "0-9";
}

/** URL 값 정리 — 모르는 값은 null(전체) */
export const cleanNameIndex = (v: unknown): NameIndexKey | null => {
  const s = String(Array.isArray(v) ? v[0] : v ?? "").trim();
  return (NAME_INDEX_KEYS as readonly string[]).includes(s) ? (s as NameIndexKey) : null;
};

/** 칸마다 개수 */
export function nameIndexCounts(names: string[]): Record<NameIndexKey, number> {
  const out = Object.fromEntries(NAME_INDEX_KEYS.map((k) => [k, 0])) as Record<NameIndexKey, number>;
  for (const n of names) out[nameIndexOf(n)]++;
  return out;
}
