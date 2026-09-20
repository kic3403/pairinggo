/**
 * 장바구니 계산(docs/22 §4-1·§5) — 양조장별로 묶고 배송비를 따로 계산한다.
 * 결제 직전에 배송비가 뛰지 않게, 담는 순간부터 양조장별 배송비와 "얼마 더 담으면 무료"를 보여 준다.
 */
import { freeShipGap, shippingFee, type ShippingPolicy } from "./shipping";

export const CART_LINES_MAX = 30, QTY_MAX = 20;

export type CartLine = {
  productId: string;
  sellerId: string;
  name: string;
  price: number;
  qty: number;
  volume?: string;
  photo?: string;
  cold?: boolean;
  shipFree?: boolean;
  /** 지금 살 수 있는 최대 수량(재고·1인 상한) — 0이면 품절 */
  buyable?: number;
  drinkId?: string;
};

export type SellerInfo = { sellerId: string; name: string; shipping: ShippingPolicy };

export type SellerGroup = {
  sellerId: string;
  name: string;
  lines: CartLine[];
  itemsTotal: number;
  shipFee: number;
  /** 무료배송까지 남은 금액(0이면 이미 무료이거나 기준 없음) */
  freeGap: number;
  cold: boolean;
};

export type CartSummary = {
  groups: SellerGroup[];
  itemsTotal: number;
  shipTotal: number;
  total: number;
  /** 품절·재고 초과로 살 수 없는 줄 */
  blocked: CartLine[];
};

const qtyOf = (l: CartLine) => Math.max(0, Math.min(Math.floor(l.qty || 0), QTY_MAX));

/**
 * 양조장별로 묶어 금액·배송비를 계산한다.
 * · 같은 양조장 상품은 배송비 한 번(묶음배송)
 * · 그 양조장 상품 금액 합계로만 무료 기준을 따진다(다른 양조장 금액과 합치지 않는다)
 * · 한 줄이라도 "무료배송" 상품이 있으면 그 양조장 배송비는 0
 * · 살 수 없는 줄(품절·재고 초과)은 blocked로 빼고 금액에 넣지 않는다
 */
export function summarizeCart(lines: CartLine[], sellers: SellerInfo[], opts: { island?: boolean } = {}): CartSummary {
  const by = new Map(sellers.map((s) => [s.sellerId, s]));
  const groups = new Map<string, SellerGroup>();
  const blocked: CartLine[] = [];

  for (const line of lines.slice(0, CART_LINES_MAX)) {
    const qty = qtyOf(line);
    const seller = by.get(line.sellerId);
    if (!seller || qty <= 0 || (line.buyable != null && (line.buyable <= 0 || qty > line.buyable))) { blocked.push(line); continue; }
    let g = groups.get(line.sellerId);
    if (!g) { g = { sellerId: line.sellerId, name: seller.name, lines: [], itemsTotal: 0, shipFee: 0, freeGap: 0, cold: false }; groups.set(line.sellerId, g); }
    g.lines.push({ ...line, qty });
    g.itemsTotal += Math.max(0, Math.floor(line.price || 0)) * qty;
    if (line.cold) g.cold = true;
  }

  let itemsTotal = 0, shipTotal = 0;
  for (const g of groups.values()) {
    const policy = by.get(g.sellerId)!.shipping;
    const freeShip = g.lines.some((l) => l.shipFree);
    g.shipFee = shippingFee(policy, { itemsTotal: g.itemsTotal, freeShip, island: opts.island });
    g.freeGap = freeShip ? 0 : freeShipGap(policy, g.itemsTotal);
    itemsTotal += g.itemsTotal;
    shipTotal += g.shipFee;
  }
  return { groups: [...groups.values()], itemsTotal, shipTotal, total: itemsTotal + shipTotal, blocked };
}

/** 장바구니에 담을 수 없는 이유 — 없으면 null */
export function addToCartProblem(
  line: { qty: number; buyable: number },
  cart: { lines: number; hasProduct: boolean },
): string | null {
  if (line.buyable <= 0) return "지금은 품절이에요";
  if (line.qty <= 0) return "수량을 골라 주세요";
  if (line.qty > line.buyable) return `최대 ${line.buyable}개까지 살 수 있어요`;
  if (!cart.hasProduct && cart.lines >= CART_LINES_MAX) return `장바구니에는 ${CART_LINES_MAX}가지까지 담을 수 있어요`;
  return null;
}

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

/** "3,000원 더 담으면 무료배송" — 남은 금액이 없으면 null */
export const freeShipHint = (g: Pick<SellerGroup, "freeGap">) => (g.freeGap > 0 ? `${won(g.freeGap)} 더 담으면 무료배송` : null);
