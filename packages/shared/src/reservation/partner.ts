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
/**
 * 파트너 인증 도장 색 — 로고의 두 색을 나눠 쓴다.
 * **술을 파는 곳(양조장·리쿼샵)은 주황, 음식을 파는 식당은 남색**(2026-09-24 사용자 결정).
 * 검색 결과 색(술 주황·음식 남색)과 잇기 위해 뒤집었다 — 2026-09-21에는 반대였다.
 */
export const PARTNER_KIND_TONE: Record<PartnerKind, "navy" | "food"> = { restaurant: "navy", brewery: "food", liquor: "food" };
/** 그 종류가 무엇을 하는 곳인지 — 가입·어드민 화면 안내 */
export const PARTNER_KIND_HINT: Record<PartnerKind, string> = {
  restaurant: "손님이 자리를 예약하고 방문하는 곳 — 메뉴판·콜키지·자리 예약",
  brewery: "술을 빚는 곳 — 우리 술 정보와 양조장 방문·시음 예약",
  liquor: "술을 파는 가게 — 취급하는 전통주와 방문 픽업 예약",
};
export const cleanPartnerKind = (raw: unknown): PartnerKind =>
  (PARTNER_KINDS as readonly string[]).includes(String(raw)) ? (String(raw) as PartnerKind) : "restaurant";
/**
 * 예약은 업종과 상관없이 **예약 받기를 켠 승인 매장**이면 받는다 (2026-09-20 사용자 확인:
 * 두레박한산소곡주(양조장)가 예약을 켜 둔 것을 보고 정함 — 양조장은 방문 시음, 리쿼샵은 방문 픽업 예약).
 */
export const partnerTakesReservations = (_kind: PartnerKind) => true;
/** 업종에 맞는 예약 이름 — 화면 문구 */
export const PARTNER_RESERVATION_LABEL: Record<PartnerKind, string> = { restaurant: "자리 예약", brewery: "방문 시음 예약", liquor: "방문 픽업 예약" };
/**
 * 파트너 화면에서 "페어링GO ○○ 목록/카드"라고 부를 때 쓰는 이름 (2026-09-22 사용자 요청:
 * 양조장 사장님에게 "식당 목록"이라고 하면 자기 얘기가 아닌 것처럼 보인다).
 */
export const PARTNER_PLACE_LABEL: Record<PartnerKind, string> = { restaurant: "식당", brewery: "양조장", liquor: "리쿼샵" };
/** 한 줄 소개 칸의 예시 — 업종마다 다르게 보여 준다 */
export const PARTNER_INTRO_EXAMPLE: Record<PartnerKind, string> = {
  restaurant: "예: 대전 한우 수육과 지역 막걸리를 함께 내는 한식 주점",
  brewery: "예: 한산소곡주를 100일 발효로 빚는 서천 양조장 — 방문 시음·견학 가능",
  liquor: "예: 전통주 200여 종을 갖춘 대전 리쿼샵 — 맛보고 골라 가세요",
};

/**
 * 매장 직접 입력(2026-09-19 사용자 요청) — 카카오맵 검색에 안 나오는 매장(새로 연 곳 등)은 상호·주소·전화를 직접 적어 신청한다.
 * 이런 매장은 카카오 장소 id 대신 "manual-…" 표시 id를 쓰고, 운영자가 카카오맵 장소를 찾아 연결하기 전까지는
 * 페어링GO 식당 검색·예약 화면(카카오 id 기준)에 나오지 않는다 — 파트너 앱 기능(매장 정보·영업시간)은 그대로 쓸 수 있다.
 */
export type ManualPlaceInput = { name: string; address: string; phone?: string };
export const MANUAL_PLACE_PREFIX = "manual-";
export const isManualPlaceId = (id: string | null | undefined) => String(id ?? "").startsWith(MANUAL_PLACE_PREFIX);
/** 매장 id 형식 — 카카오 장소 id(숫자) 또는 직접 입력 표시 id(manual-12자리 hex). 검색·상세·예약 라우트가 같은 검사를 쓴다(2026-09-27) */
export const isPlaceId = (id: string | null | undefined) => /^\d{1,20}$/.test(String(id ?? "")) || /^manual-[0-9a-f]{12}$/.test(String(id ?? ""));

/**
 * 직접 입력 매장 자동 연결(2026-09-27, 사용자 결정 "직접 입력해도 바로 나오게") — 사장님이 적은 상호·주소로 카카오를 다시 검색한 결과 중
 * ① 주소(도로명, 없으면 지번)가 사장님 주소 안에 그대로 들어 있고 ② 이름이 서로 겹치는(한쪽이 다른 쪽을 품는) 장소가 **하나뿐**이면 그것.
 * 둘 이상이거나 없으면 null — 그때는 주소를 좌표로 바꿔 manual id로 두고 운영자가 확인한다.
 */
const sq = (s: string) => (s || "").toLowerCase().replace(/[\s,.\-()（）]/g, "");
const nameOverlap = (a: string, b: string) => { const x = sq(a).replace(/(농업회사법인|주식회사|\(주\)|㈜|유한회사)/g, ""), y = sq(b).replace(/(농업회사법인|주식회사|\(주\)|㈜|유한회사)/g, ""); return x.length >= 2 && y.length >= 2 && (x.includes(y) || y.includes(x)); };
export function pickAutoLink<T extends { id: string; name: string; roadAddress: string; address: string }>(input: { name: string; address: string }, places: T[]): T | null {
  const addr = sq(input.address);
  const hits = places.filter((p) => {
    const road = sq(p.roadAddress), jibun = sq(p.address);
    const addrOk = (road.length >= 6 && addr.includes(road)) || (!road && jibun.length >= 6 && addr.includes(jibun));
    return addrOk && nameOverlap(input.name, p.name);
  });
  const ids = new Set(hits.map((h) => h.id));
  return ids.size === 1 ? hits[0] : null;
}

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
