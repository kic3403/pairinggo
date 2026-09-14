/**
 * 회원 프로필 — 성별·생년월일·사는 시도. 가입 화면과 프로필 화면, 로그 분석이 같은 목록·검증을 쓴다.
 * 시도 목록은 2026-07 행정구역 기준(전남광주통합특별시). packages/db/src/sido.ts(데이터 정규화)와 이름을 맞춘다.
 */
export const GENDER_OPTIONS = [{ value: "m", label: "남" }, { value: "f", label: "여" }] as const;
export type Gender = (typeof GENDER_OPTIONS)[number]["value"];

export const SIDO_OPTIONS = [
  "서울특별시", "부산광역시", "대구광역시", "인천광역시", "대전광역시", "울산광역시", "세종특별자치시",
  "경기도", "강원특별자치도", "충청북도", "충청남도", "전북특별자치도", "전남광주통합특별시", "경상북도", "경상남도", "제주특별자치도",
] as const;
export type Sido = (typeof SIDO_OPTIONS)[number];

export type Profile = { gender: Gender; birthDate: string /* YYYY-MM-DD */; sido: Sido };

/** 달력에 있는 날짜인지(2월 30일·평년 2월 29일 거르기) */
const realDate = (y: number, mo: number, d: number) => {
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
};

/** 가입 화면 생년월일 입력(8자리 숫자, 19871024) → DB 형식 YYYY-MM-DD. 자릿수가 틀리거나 없는 날짜면 null */
export function birthDigitsToDate(input: string | null | undefined): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec((input ?? "").trim());
  if (!m || !realDate(+m[1], +m[2], +m[3])) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}
/** DB 형식 → 입력칸에 채울 8자리 */
export const birthDateToDigits = (date: string | null | undefined) => (date ?? "").replace(/-/g, "").slice(0, 8);

/** 만 나이 */
export function ageOn(birthDate: string, on = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (!realDate(y, mo, d)) return null;
  let age = on.getFullYear() - y;
  if (on.getMonth() + 1 < mo || (on.getMonth() + 1 === mo && on.getDate() < d)) age--;
  return age;
}

/** 가입·프로필 입력 검증. 문제가 있으면 첫 번째 안내 문장, 없으면 null */
export function profileProblem(p: { gender?: string | null; birthDate?: string | null; sido?: string | null }, on = new Date()): string | null {
  if (!GENDER_OPTIONS.some((g) => g.value === p.gender)) return "성별을 골라 주세요.";
  const age = p.birthDate ? ageOn(p.birthDate, on) : null;
  if (age == null) return "생년월일 8자리를 확인해 주세요. (예: 19871024)";
  if (age < 19) return "주류 정보 서비스는 만 19세 이상만 가입할 수 있습니다.";
  if (age > 120) return "생년월일 8자리를 확인해 주세요. (예: 19871024)";
  if (!SIDO_OPTIONS.includes(p.sido as Sido)) return "사는 곳(시·도)을 골라 주세요.";
  return null;
}

/** 로그 집계용 연령대 — 20대·30대… */
export const ageBand = (birthDate: string, on = new Date()) => { const a = ageOn(birthDate, on); return a == null ? null : `${Math.floor(a / 10) * 10}대`; };

/* ---------- 닉네임 — 회원 추천 글 작성자로 공개된다(개인정보처리방침 2번) ---------- */
export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 12;
/** 운영자로 오해할 수 있거나 "닉네임 없음" 표시와 겹치는 이름 */
const RESERVED_NICKNAMES = ["회원", "운영자", "관리자", "페어링go", "admin", "탈퇴회원"];

/** 앞뒤 공백을 지우고 연속 공백은 하나로 */
export const cleanNickname = (raw: string | null | undefined) => (raw ?? "").replace(/\s+/g, " ").trim();

/** 닉네임 입력 검증. 문제가 있으면 안내 문장, 없으면 null. 글자 수는 이모지를 한 글자로 센다 */
export function nicknameProblem(raw: string | null | undefined): string | null {
  const n = cleanNickname(raw);
  if (!n) return "닉네임을 입력해 주세요.";
  const len = [...n].length;
  if (len < NICKNAME_MIN || len > NICKNAME_MAX) return `닉네임은 ${NICKNAME_MIN}~${NICKNAME_MAX}자로 입력해 주세요.`;
  const lower = n.toLowerCase();
  if (n.includes("@")) return "닉네임에는 이메일 주소나 링크를 넣을 수 없어요.";
  if (/https?|www\.|\.(com|net|kr|co)\b/.test(lower)) return "닉네임에는 이메일 주소나 링크를 넣을 수 없어요.";
  const squashed = lower.replace(/\s+/g, "");
  if (RESERVED_NICKNAMES.some((r) => squashed === r || (r !== "회원" && squashed.includes(r)))) return "쓸 수 없는 닉네임이에요. 다른 이름을 입력해 주세요.";
  return null;
}
