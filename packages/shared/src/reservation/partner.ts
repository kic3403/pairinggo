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

/**
 * 파트너 종류 (2026-09-20 사용자 결정: 어드민에서 식당·양조장·리쿼샵 세 갈래로 나눈다)
 * - restaurant 식당: 자리 예약을 받는다(지금까지의 파트너)
 * - brewery   양조장: 술을 만드는 곳 — 방문 시음·양조장 투어, 전통주 직접 판매·입점
 * - liquor    리쿼샵: 술을 파는 가게 — 재고 안내·매장 픽업(docs/13 판매 구조)
 */
export const PARTNER_KINDS = ["restaurant", "brewery", "liquor"] as const;
export type PartnerKind = (typeof PARTNER_KINDS)[number];
export const PARTNER_KIND_LABEL: Record<PartnerKind, string> = { restaurant: "식당", brewery: "양조장", liquor: "리쿼샵" };
/** 그 종류가 무엇을 하는 곳인지 — 가입·어드민 화면 안내 */
export const PARTNER_KIND_HINT: Record<PartnerKind, string> = {
  restaurant: "손님이 자리를 예약하고 방문하는 곳 — 메뉴판·콜키지·예약을 씁니다",
  brewery: "술을 빚는 곳 — 양조장 방문·시음 안내와 우리 술 정보를 관리합니다",
  liquor: "술을 파는 가게 — 취급하는 전통주와 매장 픽업 안내를 관리합니다",
};
export const cleanPartnerKind = (raw: unknown): PartnerKind =>
  (PARTNER_KINDS as readonly string[]).includes(String(raw)) ? (String(raw) as PartnerKind) : "restaurant";
/** 지금 자리 예약을 받는 종류 — 양조장·리쿼샵은 예약 기능을 쓰지 않는다(시음 예약은 다음 차수) */
export const partnerTakesReservations = (kind: PartnerKind) => kind === "restaurant";

/**
 * 매장 직접 입력(2026-09-19 사용자 요청) — 카카오맵 검색에 안 나오는 매장(새로 연 곳 등)은 상호·주소·전화를 직접 적어 신청한다.
 * 이런 매장은 카카오 장소 id 대신 "manual-…" 표시 id를 쓰고, 운영자가 카카오맵 장소를 찾아 연결하기 전까지는
 * 페어링GO 식당 검색·예약 화면(카카오 id 기준)에 나오지 않는다 — 파트너 앱 기능(매장 정보·영업시간)은 그대로 쓸 수 있다.
 */
export type ManualPlaceInput = { name: string; address: string; phone?: string };
export const MANUAL_PLACE_PREFIX = "manual-";
export const isManualPlaceId = (id: string | null | undefined) => String(id ?? "").startsWith(MANUAL_PLACE_PREFIX);

/** 직접 입력한 매장 정리 — 상호 2~40자·주소 5~120자(링크 금지), 전화는 선택(숫자·하이픈, 숫자 8자리 이상·20자 이하) */
export function cleanManualPlace(raw: Partial<ManualPlaceInput> | null | undefined): { ok: true; value: Required<ManualPlaceInput> } | { ok: false; problem: string } {
  const one = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();
  const name = one(raw?.name), address = one(raw?.address);
  const link = (x: string) => /https?:|www\./i.test(x);
  if (name.length < 2 || name.length > 40 || link(name)) return { ok: false, problem: "매장 상호를 2~40자로 적어 주세요" };
  if (address.length < 5 || address.length > 120 || link(address)) return { ok: false, problem: "매장 주소를 도로명 주소로 적어 주세요(예: 대전 서구 둔산로 100 1층)" };
  const phone = String(raw?.phone ?? "").replace(/[^\d-]/g, "");
  if (phone && (phone.replace(/\D/g, "").length < 8 || phone.length > 20)) return { ok: false, problem: "매장 전화번호를 확인해 주세요(없으면 비워 두세요)" };
  return { ok: true, value: { name, address, phone } };
}

export type PartnerSignupInput = {
  email: string; password: string; name: string; phone: string;
  /** 카카오맵에서 고른 매장 id — 직접 입력이면 비우고 manualPlace를 채운다 */
  kakaoPlaceId: string; manualPlace?: ManualPlaceInput | null; ownerName: string; bizNo: string; agree: boolean;
  /** 식당·양조장·리쿼샵 — 없으면 식당 */
  kind?: PartnerKind;
};
export type CleanPartnerSignup = Omit<PartnerSignupInput, "agree" | "manualPlace" | "kind"> & { agree: true; manualPlace: Required<ManualPlaceInput> | null; kind: PartnerKind };

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
  let manualPlace: Required<ManualPlaceInput> | null = null;
  if (!kakaoPlaceId && raw.manualPlace) {
    const mp = cleanManualPlace(raw.manualPlace);
    if (!mp.ok) return no(mp.problem);
    manualPlace = mp.value;
  } else if (!/^\d{1,20}$/.test(kakaoPlaceId)) return no("매장을 검색해서 고르거나, 검색이 안 되면 직접 입력해 주세요");
  const ownerName = String(raw.ownerName ?? "").replace(/\s+/g, " ").trim();
  if (ownerName.length < 2 || ownerName.length > 20) return no("대표자 이름을 적어 주세요");
  const bizNo = cleanBizNo(raw.bizNo);
  if (!bizNo) return no("사업자등록번호 10자리를 확인해 주세요");
  if (raw.agree !== true) return no("파트너 이용약관과 개인정보 수집·이용에 동의해 주세요");
  return { ok: true, value: { email, password: String(raw.password ?? ""), name, phone, kakaoPlaceId: manualPlace ? "" : kakaoPlaceId, manualPlace, ownerName, bizNo, agree: true, kind: cleanPartnerKind(raw.kind) } };
}
