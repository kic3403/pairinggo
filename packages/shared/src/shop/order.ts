/**
 * 주문 상태·배송지(docs/22 §7) — 결제하면 바로 주문이 들어가고, 발송 전까지 손님이 취소할 수 있다.
 * 상태 판정은 여기(순수 규칙), 저장·동시성은 packages/server.
 */
import { normalizeMobile } from "../reservation/phone";

export const ORDER_STATUS = ["paid", "confirmed", "shipped", "delivered", "done", "cancelled", "returned"] as const;
export type OrderStatus = (typeof ORDER_STATUS)[number];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  paid: "결제 완료", confirmed: "발주 확인", shipped: "발송", delivered: "배송 완료", done: "구매 확정", cancelled: "취소", returned: "반품",
};

export type OrderActor = "user" | "seller" | "admin" | "system";

/** 배송 완료 뒤 이 기간 안에만 반품 신청(청약철회 7일) */
export const RETURN_DAYS = 7;
/** 배송 완료 뒤 자동 구매 확정 */
export const AUTO_DONE_DAYS = 7;
/** 발주 확인·발송이 이 시간을 넘으면 어드민 경고(영업일 2일) */
export const LATE_SHIP_HOURS = 48;

const DAY = 86_400_000;

/**
 * 이 상태 변경이 가능한가.
 * · 손님: 발송 전(결제 완료·발주 확인) 취소 · 배송 완료 뒤 7일 안 반품 신청 · 바로 구매 확정
 * · 판매자: 발주 확인 → 발송 → 배송 완료, 발송 전 취소(사유 필수)
 * · 시스템: 배송 완료 7일 뒤 자동 구매 확정
 * · 운영자: 분쟁 처리로 취소·반품·확정
 */
export function canOrderTransition(
  from: OrderStatus, to: OrderStatus, actor: OrderActor,
  ctx: { now?: number; deliveredAt?: number | null } = {},
): boolean {
  if (from === to) return false;
  const now = ctx.now ?? Date.now();
  const withinReturn = ctx.deliveredAt != null && now - ctx.deliveredAt <= RETURN_DAYS * DAY;
  if (actor === "admin") return to === "cancelled" || to === "returned" || to === "done";
  if (actor === "user") {
    if (to === "cancelled") return from === "paid" || from === "confirmed";
    if (to === "returned") return from === "delivered" && withinReturn;
    if (to === "done") return from === "delivered";
    return false;
  }
  if (actor === "seller") {
    if (to === "confirmed") return from === "paid";
    if (to === "shipped") return from === "paid" || from === "confirmed";
    if (to === "delivered") return from === "shipped";
    if (to === "cancelled") return from === "paid" || from === "confirmed";
    return false;
  }
  if (to === "delivered") return from === "shipped";
  if (to === "done") return from === "delivered" && ctx.deliveredAt != null && now - ctx.deliveredAt >= AUTO_DONE_DAYS * DAY;
  return false;
}

/** 손님이 지금 취소할 수 있는가 */
export const cancelable = (s: OrderStatus) => s === "paid" || s === "confirmed";
/** 매출·정산으로 잡는 상태 */
export const countsAsSale = (s: OrderStatus) => s !== "cancelled" && s !== "returned";

export type Address = { name: string; phone: string; zip: string; addr1: string; addr2: string; memo: string };

const text = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const hasLink = (s: string) => /https?:|www\./i.test(s);

export const ADDR_MEMO_MAX = 100;

export function cleanAddress(raw: unknown): Address {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    name: text(o.name, 20),
    phone: normalizeMobile(String(o.phone ?? "")) || "",
    zip: String(o.zip ?? "").replace(/\D/g, "").slice(0, 5),
    addr1: text(o.addr1, 120),
    addr2: text(o.addr2, 60),
    memo: text(o.memo, ADDR_MEMO_MAX),
  };
}

/** 배송지에서 잘못된 곳 — 없으면 null */
export function addressProblem(a: Address): string | null {
  if (a.name.length < 2) return "받는 분 이름을 적어 주세요";
  if (!a.phone) return "받는 분 휴대폰 번호를 정확히 적어 주세요";
  if (a.zip.length !== 5) return "주소를 검색해서 골라 주세요";
  if (a.addr1.length < 5) return "주소를 검색해서 골라 주세요";
  if (hasLink(a.memo)) return "배송 요청사항에는 링크를 넣을 수 없어요";
  return null;
}

/** 제주·도서산간 — 우편번호로 판정(추가 배송비 계산용) */
export function isIslandZip(zip: unknown): boolean {
  const z = String(zip ?? "").replace(/\D/g, "");
  if (z.length !== 5) return false;
  const n = Number(z);
  if (n >= 63000 && n <= 63644) return true; // 제주
  const far: [number, number][] = [
    [23004, 23010], [23100, 23136], // 인천 옹진·강화 섬
    [40200, 40240],                 // 울릉
    [53031, 53033],                 // 통영 섬
    [59102, 59166], [58760, 58762], // 신안·완도 등 전남 섬
    [57068, 57069],
  ];
  return far.some(([a, b]) => n >= a && n <= b);
}

/** 주문번호 — 날짜(YYMMDD) + 영숫자 6자리. 형식 검사만(생성은 서버) */
export const ORDER_NO = /^\d{6}[A-Z0-9]{6}$/;
export const isOrderNo = (v: unknown) => ORDER_NO.test(String(v ?? "").trim().toUpperCase());

export const ORDER_REASON_MAX = 100;
/** 취소·반품 사유 — 링크가 들어 있으면 버린다 */
export function cleanReason(v: unknown): string {
  const s = text(v, ORDER_REASON_MAX);
  return hasLink(s) ? "" : s;
}
