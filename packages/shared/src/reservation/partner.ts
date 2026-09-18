/**
 * 파트너(식당 사장님) 가입 규칙 — 신청 → 운영자 승인(2026-09-18 사용자 결정).
 * 사업자등록번호는 국세청 검증번호(마지막 자리) 계산으로 모양만 확인한다(실재·휴폐업 조회는 운영자가 승인할 때).
 */
import { normalizeMobile } from "./phone";

export const BIZ_NO_WEIGHTS = [1, 3, 7, 1, 3, 7, 1, 3, 5];

/** 숫자 10자리로 — 모양이 틀리면 null */
export function cleanBizNo(raw: string): string | null {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (d.length !== 10) return null;
  const n = [...d].map(Number);
  let sum = BIZ_NO_WEIGHTS.reduce((s, w, i) => s + n[i] * w, 0);
  sum += Math.floor((n[8] * 5) / 10);
  return (10 - (sum % 10)) % 10 === n[9] ? d : null;
}
export const formatBizNo = (d: string) => (d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}` : d);

export const MERCHANT_STATUS_LABEL = { applied: "승인 대기", approved: "승인", rejected: "반려", suspended: "정지" } as const;

export type PartnerSignupInput = {
  email: string; password: string; name: string; phone: string;
  kakaoPlaceId: string; ownerName: string; bizNo: string; agree: boolean;
};
export type CleanPartnerSignup = Omit<PartnerSignupInput, "agree"> & { agree: true };

/** 가입 신청 입력 정리 — 비밀번호 세기는 서버의 passwordProblem이 따로 본다 */
export function validatePartnerSignup(raw: PartnerSignupInput): { ok: true; value: CleanPartnerSignup } | { ok: false; problem: string } {
  const no = (problem: string) => ({ ok: false as const, problem });
  const email = String(raw.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120) return no("이메일을 확인해 주세요");
  const name = String(raw.name ?? "").replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 20) return no("이름을 2~20자로 적어 주세요");
  const phone = normalizeMobile(String(raw.phone ?? ""));
  if (!phone) return no("휴대폰 번호를 확인해 주세요");
  const kakaoPlaceId = String(raw.kakaoPlaceId ?? "").trim();
  if (!/^\d{1,20}$/.test(kakaoPlaceId)) return no("매장을 검색해서 골라 주세요");
  const ownerName = String(raw.ownerName ?? "").replace(/\s+/g, " ").trim();
  if (ownerName.length < 2 || ownerName.length > 20) return no("대표자 이름을 적어 주세요");
  const bizNo = cleanBizNo(raw.bizNo);
  if (!bizNo) return no("사업자등록번호 10자리를 확인해 주세요");
  if (raw.agree !== true) return no("파트너 이용약관과 개인정보 수집·이용에 동의해 주세요");
  return { ok: true, value: { email, password: String(raw.password ?? ""), name, phone, kakaoPlaceId, ownerName, bizNo, agree: true } };
}
