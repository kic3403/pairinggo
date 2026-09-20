/**
 * 판매 상품(docs/22 §4·§6) — 입점 양조장이 파는 전통주 한 줄. 카탈로그 술(drinks.id)에 연결한다.
 * 같은 술도 용량·구성이 다르면 상품을 나눈다(500ml / 750ml / 2병 세트).
 * 온라인 판매 불가 주류는 상품으로 만들 수 없다(NON_TRAD — 전통주만 통신판매할 수 있다).
 */
import { parseAbv, parsePrice, cleanVolume, cleanMenuImage } from "../menu-items";

export const PRODUCT_NAME_MAX = 60, PRODUCT_DESC_MAX = 300, PRODUCT_PRICE_MAX = 3_000_000;
export const STOCK_MAX = 9_999, PER_ORDER_MAX = 99, PRODUCT_PHOTOS_MAX = 5;

export type ProductStatus = "selling" | "soldout" | "off";
export const PRODUCT_STATUS_LABEL: Record<ProductStatus, string> = { selling: "판매중", soldout: "품절", off: "판매 중지" };

export type Product = {
  id: string;
  sellerId: string;
  /** 카탈로그 술 id — 술 상세 화면에서 이 상품을 보여 주려면 반드시 있어야 한다 */
  drinkId: string;
  name: string;
  /** 용량 "500ml" */
  volume: string;
  abv: number | null;
  price: number;
  /** 정가(할인 전) — 0이면 없음 */
  listPrice: number;
  stock: number;
  /** 한 주문에 살 수 있는 최대 수량(0 = 제한 없음) */
  perOrder: number;
  /** 냉장 배송이 필요한 술(생막걸리 등) */
  cold: boolean;
  /** 이 상품만 무료배송 */
  shipFree: boolean;
  photos: string[];
  desc: string;
  status: ProductStatus;
};

const text = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const hasLink = (s: string) => /https?:|www\./i.test(s);
const int = (v: unknown, max: number) => {
  const n = Math.floor(Number(String(v ?? "").replace(/[\s,]/g, "")));
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0;
};

export type ProductInput = Partial<Record<keyof Product, unknown>>;

/** 파트너가 적은 값 정리 — 저장 전에 한 번, 읽을 때 한 번 */
export function cleanProduct(raw: unknown): Omit<Product, "id" | "sellerId"> {
  const o = (raw ?? {}) as Record<string, unknown>;
  const price = parsePrice(o.price) ?? 0;
  const listPrice = parsePrice(o.listPrice) ?? 0;
  const status = (["selling", "soldout", "off"] as const).includes(o.status as ProductStatus) ? (o.status as ProductStatus) : "selling";
  const photos = (Array.isArray(o.photos) ? o.photos : []).map(cleanMenuImage).filter(Boolean).slice(0, PRODUCT_PHOTOS_MAX);
  return {
    drinkId: text(o.drinkId, 20),
    name: text(o.name, PRODUCT_NAME_MAX),
    volume: cleanVolume(o.volume),
    abv: parseAbv(o.abv),
    price: Math.min(price, PRODUCT_PRICE_MAX),
    listPrice: Math.min(listPrice, PRODUCT_PRICE_MAX),
    stock: int(o.stock, STOCK_MAX),
    perOrder: int(o.perOrder, PER_ORDER_MAX),
    cold: o.cold === true,
    shipFree: o.shipFree === true,
    photos,
    desc: text(o.desc, PRODUCT_DESC_MAX),
    status,
  };
}

/**
 * 못 올리는 이유 — 없으면 null.
 * 냉장 배송을 못 하는 양조장은 냉장 상품을 올릴 수 없고(docs/22 §4), 카탈로그에 없는 술·온라인 판매 불가 술도 막는다.
 */
export function productProblem(
  p: Omit<Product, "id" | "sellerId">,
  ctx: { drinkExists: boolean; onlineSellable: boolean; sellerCold: boolean },
): string | null {
  if (!p.drinkId || !ctx.drinkExists) return "페어링GO에 있는 전통주를 골라 주세요";
  if (!ctx.onlineSellable) return "온라인으로 팔 수 없는 술이에요 — 전통주만 통신판매할 수 있어요";
  if (!p.name) return "상품 이름을 적어 주세요";
  if (hasLink(p.name) || hasLink(p.desc)) return "상품 이름·설명에는 링크를 넣을 수 없어요";
  if (p.price < 1000) return "가격을 적어 주세요(1,000원부터)";
  if (p.listPrice && p.listPrice < p.price) return "정가는 파는 가격보다 낮을 수 없어요";
  if (p.cold && !ctx.sellerCold) return "냉장 배송을 켠 뒤에 냉장 상품을 올릴 수 있어요 — 배송 설정에서 바꿔 주세요";
  return null;
}

/** 화면에 보이는 판매 상태 — 재고가 0이면 품절로 본다 */
export function sellable(p: Pick<Product, "status" | "stock">): boolean {
  return p.status === "selling" && p.stock > 0;
}

/** 한 번에 살 수 있는 최대 수량 — 재고와 1인 상한 중 작은 값 */
export function buyableQty(p: Pick<Product, "stock" | "perOrder">): number {
  const cap = p.perOrder > 0 ? Math.min(p.stock, p.perOrder) : p.stock;
  return Math.max(0, cap);
}

/** 할인율(%) — 정가가 없거나 같으면 0 */
export function discountRate(p: Pick<Product, "price" | "listPrice">): number {
  if (!p.listPrice || p.listPrice <= p.price) return 0;
  return Math.round(((p.listPrice - p.price) / p.listPrice) * 100);
}
