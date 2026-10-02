import { ensureStoreDrink } from "@pairinggo/server/merchant-store";
import { addStock, deleteProduct, findCatalogDrink, saveProduct } from "@pairinggo/server/shop";
import { sellerOrError } from "@/lib/seller";

/** 상품 올리기·고치기·지우기·재고 조정 */
export async function POST(req: Request) {
  const a = await sellerOrError(); if (a instanceof Response) return a;
  if (!a.seller) return Response.json({ error: "입점 신청을 먼저 해 주세요" }, { status: 400 });
  try {
    const b = (await req.json()) as { id?: string; remove?: boolean; stock?: number; product?: Record<string, unknown> };
    if (b.remove && b.id) { await deleteProduct(a.seller.id, b.id); return Response.json({ ok: true }); }
    if (b.id && typeof b.stock === "number" && !b.product) {
      return Response.json({ ok: true, product: await addStock(a.seller.id, b.id, b.stock) });
    }
    const drink = await findCatalogDrink(String(b.product?.drinkId ?? ""));
    const product = await saveProduct(a.seller, b.id ?? null, { ...b.product, drinkId: drink?.id ?? "" }, {
      drinkExists: !!drink, onlineSellable: drink?.onlineSellable !== false,
    });
    // 온라인 판매에 올린 술은 '판매하는 술' 표에도 넣는다(2026-10-02 — 같은 술을 두 번 적지 않게). 이미 있으면 그대로, 실패해도 상품 저장은 그대로 둔다
    const menuAdded = drink ? await ensureStoreDrink(a.merchant, a.user, { name: drink.name, volume: product.volume, abv: product.abv ?? drink.abv, price: product.price, img: product.photos?.[0], category: drink.category }).catch(() => null) : null;
    return Response.json({ ok: true, product, menuAdded });
  } catch (e) { return Response.json({ error: (e as Error).message }, { status: 400 }); }
}
