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

/** 만 나이 */
export function ageOn(birthDate: string, on = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  let age = on.getFullYear() - y;
  if (on.getMonth() + 1 < mo || (on.getMonth() + 1 === mo && on.getDate() < d)) age--;
  return age;
}

/** 가입·프로필 입력 검증. 문제가 있으면 첫 번째 안내 문장, 없으면 null */
export function profileProblem(p: { gender?: string | null; birthDate?: string | null; sido?: string | null }, on = new Date()): string | null {
  if (!GENDER_OPTIONS.some((g) => g.value === p.gender)) return "성별을 골라 주세요.";
  const age = p.birthDate ? ageOn(p.birthDate, on) : null;
  if (age == null) return "생년월일을 확인해 주세요.";
  if (age < 19) return "주류 정보 서비스는 만 19세 이상만 가입할 수 있습니다.";
  if (age > 120) return "생년월일을 확인해 주세요.";
  if (!SIDO_OPTIONS.includes(p.sido as Sido)) return "사는 곳(시·도)을 골라 주세요.";
  return null;
}

/** 로그 집계용 연령대 — 20대·30대… */
export const ageBand = (birthDate: string, on = new Date()) => { const a = ageOn(birthDate, on); return a == null ? null : `${Math.floor(a / 10) * 10}대`; };
