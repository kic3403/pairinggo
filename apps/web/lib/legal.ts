/**
 * 개인정보처리방침·이용약관에 들어가는 운영자 정보와 시행일.
 * 문서 내용(수집 항목·목적·위탁)이 바뀌면 시행일을 고치고 packages/shared/src/consent.ts CONSENT_VERSION도 함께 올린다.
 */
export const LEGAL = {
  service: "페어링GO",
  site: "https://pairinggo.vercel.app",
  effective: "2026년 9월 21일",
  /** 운영자 — 사업자 등록 전에는 개인 운영자 이름으로 둔다 */
  operator: "페어링GO 운영자",
  /** 개인정보 보호책임자 */
  officer: { name: "페어링GO 운영자", role: "운영자", email: "kic3403@gmail.com" },
} as const;

/** 문의 이메일 — 비어 있으면 화면에 "준비 중"으로 보인다 */
export const contactEmail = () => LEGAL.officer.email || "준비 중(사이트 공지 예정)";
