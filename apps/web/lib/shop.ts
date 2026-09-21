/**
 * 손님 쪽 구매(docs/22) — 술 화면의 판매 상품, 장바구니, 주문. 저장·재고는 @pairinggo/server/shop.
 * 판매자는 입점 양조장이고 우리는 주문을 전달할 뿐이다 — 화면에도 판매자 정보를 함께 내려 준다.
 */
import { discountRate, shippingLabel, type CartSummary, type OrderStatus } from "@pairinggo/shared";
import { productsForDrink, getCart, addToCart, setCartQty, clearCart, cartCount } from "@pairinggo/server/shop";
import { placeOrder, myOrders, myOrderByNo, transitionOrder, testPayEnabled, type OrderView } from "@pairinggo/server/shop-orders";

export type BuyOption = {
  productId: string;
  name: string; volume: string; abv: number | null;
  price: number; listPrice: number; discount: number;
  stock: number; buyable: number; cold: boolean; shipFree: boolean; desc: string; photo: string | null;
  seller: { id: string; name: string; bizName: string; ownerName: string; bizNo: string; csPhone: string; shipping: string; leadDays: number };
};

/** 그 술을 지금 살 수 있는 곳 — 없으면 빈 배열(그럼 화면은 지금처럼 공식몰 링크만 보여 준다) */
export async function buyOptions(drinkId: string): Promise<BuyOption[]> {
  const rows = await productsForDrink(drinkId).catch(() => []);
  return rows.map(({ product: p, seller: s }) => ({
    productId: p.id, name: p.name, volume: p.volume, abv: p.abv,
    price: p.price, listPrice: p.listPrice, discount: discountRate(p),
    stock: p.stock, buyable: p.perOrder > 0 ? Math.min(p.stock, p.perOrder) : p.stock,
    cold: p.cold, shipFree: p.shipFree, desc: p.desc, photo: p.photos[0] ?? null,
    seller: {
      id: s.id, name: s.name, bizName: s.bizName || s.name, ownerName: s.ownerName, bizNo: s.bizNo, csPhone: s.csPhone,
      shipping: p.shipFree ? "무료배송" : shippingLabel(s.shipping), leadDays: s.shipping.leadDays,
    },
  }));
}

export { getCart, addToCart, setCartQty, clearCart, cartCount, placeOrder, myOrders, myOrderByNo, transitionOrder, testPayEnabled };
export type { CartSummary, OrderView, OrderStatus };
