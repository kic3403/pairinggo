/**
 * 가입 동의 — 이용약관·개인정보 수집·이용·만 19세 이상 확인(모두 필수).
 * 약관이나 개인정보처리방침의 수집 항목·목적이 바뀌면 CONSENT_VERSION을 올린다 → 기존 회원도 다음 로그인 때 다시 동의한다.
 * 문서 본문은 apps/web/app/(site)/_components/legal/, 동의 기록은 users.consent_version·consent_at(0017).
 */
export const CONSENT_VERSION = "2026-09-19.2";   // .2: 이메일·휴대폰 번호 이용 목적에 "중복 가입 확인" 추가

export const CONSENT_ITEMS = [
  { key: "terms", label: "이용약관에 동의합니다", required: true, missing: "이용약관에 동의해 주세요." },
  { key: "privacy", label: "개인정보 수집·이용에 동의합니다", required: true, missing: "개인정보 수집·이용에 동의해 주세요." },
  { key: "age", label: "만 19세 이상입니다", required: true, missing: "만 19세 이상인지 확인해 주세요." },
] as const;

export type ConsentKey = (typeof CONSENT_ITEMS)[number]["key"];
export type ConsentValues = Partial<Record<ConsentKey, boolean>>;

/** 폼 필드 이름 — consent_terms 등 */
export const consentField = (k: ConsentKey) => `consent_${k}`;

/** 필수 동의가 빠졌으면 첫 번째 안내 문장, 다 됐으면 null */
export function consentProblem(v: ConsentValues): string | null {
  for (const i of CONSENT_ITEMS) if (i.required && !v[i.key]) return i.missing;
  return null;
}

/** FormData.get 같은 함수에서 동의 값을 읽는다(체크박스는 켜졌을 때만 "on") */
export function consentFromForm(get: (name: string) => unknown): Record<ConsentKey, boolean> {
  return Object.fromEntries(CONSENT_ITEMS.map((i) => [i.key, get(consentField(i.key)) === "on"])) as Record<ConsentKey, boolean>;
}

/** 동의를 (다시) 받아야 하는지 */
export const needsConsent = (version: string | null | undefined) => version !== CONSENT_VERSION;
