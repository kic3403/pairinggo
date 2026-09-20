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
    return Response.json({ ok: true, product });
  } catch (e) { return Response.json({ error: (e as Error).message }, { status: 400 }); }
}
