/**
 * 배송비·택배사 (2026-09-21 사용자 결정, docs/22 §4-1) — 양조장이 직접 정한다.
 * 플랫폼이 강제하는 배송비·택배사는 없다. 기본 배송비 0원이면 "무료배송", 무료 기준을 넘으면 0원.
 * 택배사는 목록에서 고르거나(송장으로 조회 링크가 붙는다) 목록에 없으면 이름을 직접 적는다(링크 없음).
 */

/** 국내 택배사 — track이 비어 있으면 조회 링크를 붙이지 않는다(홈페이지에서 직접 조회) */
export const COURIERS: { code: string; name: string; track: string }[] = [
  { code: "cj", name: "CJ대한통운", track: "https://trace.cjlogistics.com/next/tracking.html?wblNo=" },
  { code: "epost", name: "우체국택배", track: "https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm?sid1=" },
  { code: "hanjin", name: "한진택배", track: "https://www.hanjin.co.kr/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&schLang=KR&wblnumText2=" },
  { code: "lotte", name: "롯데택배", track: "https://www.lotteglogis.com/home/reservation/tracking/linkView?InvNo=" },
  { code: "logen", name: "로젠택배", track: "https://www.ilogen.com/web/personal/trace/" },
  { code: "kdexp", name: "경동택배", track: "https://kdexp.com/basicNewDelivery.kd?barcode=" },
  { code: "daesin", name: "대신택배", track: "" },
  { code: "ilyang", name: "일양로지스", track: "https://www.ilyanglogis.com/functionality/tracking_result.asp?hawb_no=" },
  { code: "chunil", name: "천일택배", track: "" },
  { code: "hapdong", name: "합동택배", track: "" },
  { code: "cupost", name: "CU 편의점택배", track: "https://www.cupost.co.kr/postbox/delivery/localResult.cupost?invoice_no=" },
  { code: "gspost", name: "GS Postbox", track: "https://www.cvsnet.co.kr/invoice/tracking.do?invoice_no=" },
];
/** 목록에 없는 택배사 — 이름을 직접 적는다 */
export const COURIER_ETC = "etc";
export const COURIER_NAME_MAX = 20;

/** code가 목록에 있으면 그 택배사, "etc"면 직접 적은 이름 */
export type Courier = { code: string; name: string };

const text = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const hasLink = (s: string) => /https?:|www\.|\.com|\.kr/i.test(s);
const num = (v: unknown, max: number) => {
  const n = Math.floor(Number(String(v ?? "").replace(/[\s,원]/g, "")));
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0;
};

/**
 * 택배사 정리 — 목록에 있는 코드면 그 이름으로, 아니면 직접 적은 이름(링크 금지)으로.
 * 이름도 코드도 없으면 빈 택배사({code:"",name:""}) = "택배사 미정"
 */
export function cleanCourier(code: unknown, name?: unknown): Courier {
  const c = text(code, 20).toLowerCase();
  const known = COURIERS.find((x) => x.code === c);
  if (known) return { code: known.code, name: known.name };
  const raw = text(name, COURIER_NAME_MAX);
  // 코드 대신 이름을 그대로 보냈을 때도 목록에서 찾아 준다("CJ대한통운" → cj)
  const byName = COURIERS.find((x) => x.name === raw || x.name === text(code, COURIER_NAME_MAX));
  if (byName) return { code: byName.code, name: byName.name };
  if (!raw || hasLink(raw)) return { code: "", name: "" };
  return { code: COURIER_ETC, name: raw };
}

export const courierLabel = (c: Courier | null | undefined) => c?.name || "택배사 미정";

/** 송장번호 — 숫자·하이픈만 8~30자. 아니면 "" */
export function cleanInvoice(v: unknown): string {
  const s = String(v ?? "").replace(/[\s-]/g, "");
  return /^\d{8,30}$/.test(s) ? s : "";
}

/** 배송 조회 주소 — 목록에 있고 조회 주소가 있는 택배사 + 올바른 송장일 때만. 없으면 null */
export function trackUrl(c: Courier | null | undefined, invoice: unknown): string | null {
  const no = cleanInvoice(invoice);
  const known = COURIERS.find((x) => x.code === c?.code);
  return no && known?.track ? known.track + no : null;
}

/** 양조장이 정하는 배송 정책 — sellers 표에 저장 */
export type ShippingPolicy = {
  /** 기본 배송비(원). 0이면 무료배송 */
  fee: number;
  /** 이 금액 이상이면 배송비 0. 0이면 기준 없음 */
  freeOver: number;
  /** 제주·도서산간 추가비 */
  islandFee: number;
  /** 결제 뒤 며칠(영업일) 안에 보내는가 */
  leadDays: number;
  /** 냉장 배송 가능 — 불가면 냉장 상품을 등록할 수 없다 */
  cold: boolean;
  courier: Courier;
};

export const SHIP_FEE_MAX = 100_000, FREE_OVER_MAX = 1_000_000, LEAD_DAYS_MAX = 14;
export const DEFAULT_SHIPPING: ShippingPolicy = { fee: 0, freeOver: 0, islandFee: 0, leadDays: 2, cold: false, courier: { code: "", name: "" } };

export function cleanShippingPolicy(raw: unknown): ShippingPolicy {
  const o = (raw ?? {}) as Record<string, unknown>;
  const leadRaw = Math.floor(Number(o.leadDays));
  return {
    fee: num(o.fee, SHIP_FEE_MAX),
    freeOver: num(o.freeOver, FREE_OVER_MAX),
    islandFee: num(o.islandFee, SHIP_FEE_MAX),
    leadDays: Number.isFinite(leadRaw) && leadRaw >= 0 ? Math.min(leadRaw, LEAD_DAYS_MAX) : DEFAULT_SHIPPING.leadDays,
    cold: o.cold === true,
    courier: cleanCourier((o.courier as Record<string, unknown>)?.code ?? o.courierCode, (o.courier as Record<string, unknown>)?.name ?? o.courierName),
  };
}

/**
 * 이 양조장 몫 배송비 — 같은 양조장 상품은 몇 개를 담아도 한 번만 붙는다(묶음배송).
 * 무료가 되는 경우: 기본 배송비가 0 · 무료 기준을 넘김 · 담긴 상품 중 "무료배송" 상품이 있음.
 * 도서산간 추가비는 배송비가 무료여도 붙는다(실제 택배 추가 요금이라서).
 */
export function shippingFee(p: ShippingPolicy, opts: { itemsTotal: number; freeShip?: boolean; island?: boolean }): number {
  const total = Math.max(0, Math.floor(opts.itemsTotal || 0));
  const free = p.fee === 0 || opts.freeShip === true || (p.freeOver > 0 && total >= p.freeOver);
  return (free ? 0 : p.fee) + (opts.island ? p.islandFee : 0);
}

/** 무료배송까지 남은 금액 — 0이면 이미 무료이거나 기준이 없다 */
export function freeShipGap(p: ShippingPolicy, itemsTotal: number): number {
  if (p.fee === 0 || p.freeOver <= 0) return 0;
  return Math.max(0, p.freeOver - Math.max(0, Math.floor(itemsTotal || 0)));
}

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

/** "배송비 3,000원 · 3만원 이상 무료" / "무료배송" */
export function shippingLabel(p: ShippingPolicy): string {
  if (p.fee === 0) return "무료배송";
  const parts = [`배송비 ${won(p.fee)}`];
  if (p.freeOver > 0) parts.push(`${won(p.freeOver)} 이상 무료`);
  return parts.join(" · ");
}
