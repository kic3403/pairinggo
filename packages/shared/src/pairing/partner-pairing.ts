/**
 * 파트너(양조장) 페어링 입력(2026-09-26, docs/25 §2) — 양조장 파트너가 "우리 술에 어울리는 음식"을 적으면
 * 검수 없이 **양조장 공식(official)** 근거로 게시된다. 근거 있는 페어링이 12%뿐이라 가장 싼 확장 경로.
 * 누가: merchants.kind = brewery + merchants.brewery(카탈로그 양조장)가 정해진 파트너, 그 양조장 술에만.
 */
import { josa } from "../hangul";

export const PARTNER_PAIRING_MAX_PER_DRINK = 8;
export const PARTNER_PAIRING_NOTE_MAX = 120;
/** 양조장 공식 근거의 바닥 점수 — 카탈로그 official 행의 최소값(90)과 같다 */
export const PARTNER_PAIRING_ES = 90;

const hasLink = (s: string) => /https?:|www\.|\.(?:com|kr|net|io)\b|@/i.test(s);
const ID = /^[a-z]\d{1,4}$/;

export function cleanPairingNote(v: unknown): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, PARTNER_PAIRING_NOTE_MAX);
}

export function partnerPairingProblem(input: { drinkId: unknown; foodId: unknown; note?: unknown; countForDrink: number; editing?: boolean }): string | null {
  if (!ID.test(String(input.drinkId ?? ""))) return "술을 골라 주세요.";
  if (!ID.test(String(input.foodId ?? ""))) return "카탈로그에 있는 음식 이름을 골라 주세요.";
  const note = String(input.note ?? "").trim();
  if (note.length > PARTNER_PAIRING_NOTE_MAX) return `한 줄 이유는 ${PARTNER_PAIRING_NOTE_MAX}자까지예요.`;
  if (hasLink(note)) return "한 줄 이유에는 링크나 이메일을 넣을 수 없어요.";
  if (!input.editing && input.countForDrink >= PARTNER_PAIRING_MAX_PER_DRINK) return `술 하나에 음식은 ${PARTNER_PAIRING_MAX_PER_DRINK}개까지예요.`;
  return null;
}

export type PairingSnapshot = { tier: string; es: number; reason: string };

/** 근거 줄 — 손님 화면 카드 아래 "○○ 제공 — ○○"로 보인다 */
export function partnerEvidence(brewery: string, note: string) {
  return { source: `${brewery} 제공`, url: null as string | null, quote: note || null, who: brewery, tier: "official" as const };
}

/**
 * 기존 pairings 행(없으면 null)에 파트너 근거를 적용한 값.
 * 이미 official·sommelier면 등급·점수·이유를 그대로 두고 근거 줄만 보탠다. 그 외(맛 분석·블로그·매체·회원·없음)는 official로 올리고 점수는 max(기존, 90).
 */
export function applyPartnerPairing(existing: PairingSnapshot | null, note: string, brewery: string): PairingSnapshot {
  if (existing && (existing.tier === "official" || existing.tier === "sommelier")) return existing;
  const reason = note || `${josa(brewery, "이/가")} 직접 추천한 조합입니다.`;
  return { tier: "official", es: Math.max(existing?.es ?? 0, PARTNER_PAIRING_ES), reason };
}
