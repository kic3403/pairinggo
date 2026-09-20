/**
 * 전통주 구매 — 중개(입점) 1차, 판매자·상품·장바구니 (2026-09-21, docs/22, 표 0032).
 * 판매자는 입점 양조장(merchants.kind='brewery' + 주류 통신판매 승인). 우리는 주류를 사거나 팔지 않는다.
 * 배송비·택배사는 양조장이 정하고(shared/shop), 금액 계산은 shared summarizeCart가 한다 — 여기서는 저장·조회만.
 */
import {
  DEFAULT_SHIPPING, buyableQty, cleanCourier, cleanProduct, cleanShippingPolicy, productProblem, summarizeCart,
  type CartLine, type CartSummary, type Product, type SellerInfo, type ShippingPolicy,
} from "@pairinggo/shared";
import { db } from "./db";

type Row = Record<string, unknown>;
const need = () => { const c = db(); if (!c) throw new Error("지금은 구매 기능을 쓸 수 없어요"); return c; };
const str = (v: unknown) => (v == null ? "" : String(v));
const int = (v: unknown) => (Number.isFinite(Number(v)) ? Math.floor(Number(v)) : 0);

export type SellerStatus = "applied" | "approved" | "suspended";

export type Seller = {
  id: string;
  merchantId: string;
  status: SellerStatus;
  /** 주류 통신판매 승인(관할 세무서장) — 승인의 필수 조건 */
  licenseNo: string; licenseAt: string | null; licenseNote: string;
  bizName: string; bizNo: string; ownerName: string; csPhone: string;
  shipping: ShippingPolicy;
  fromAddr: string; returnAddr: string;
  feeRate: number;
  bank: string; bankAccount: string; bankHolder: string;
  /** 매장 이름(merchants) — 목록·장바구니에 보인다 */
  name: string;
};

export const SELLER_COLS =
  "id, merchant_id, status, license_no, license_at, license_note, biz_name, biz_no, owner_name, cs_phone, " +
  "ship_fee, ship_free_over, ship_island_fee, ship_lead_days, ship_cold, courier_code, courier_name, " +
  "from_addr, return_addr, fee_rate, bank, bank_account, bank_holder, merchants(name)";

export const sellerFromRow = (r: Row): Seller => ({
  id: str(r.id), merchantId: str(r.merchant_id), status: (str(r.status) || "applied") as SellerStatus,
  licenseNo: str(r.license_no), licenseAt: r.license_at ? str(r.license_at) : null, licenseNote: str(r.license_note),
  bizName: str(r.biz_name), bizNo: str(r.biz_no), ownerName: str(r.owner_name), csPhone: str(r.cs_phone),
  shipping: cleanShippingPolicy({
    fee: r.ship_fee, freeOver: r.ship_free_over, islandFee: r.ship_island_fee, leadDays: r.ship_lead_days, cold: r.ship_cold,
    courierCode: r.courier_code, courierName: r.courier_name,
  }),
  fromAddr: str(r.from_addr), returnAddr: str(r.return_addr), feeRate: Number(r.fee_rate ?? 0),
  bank: str(r.bank), bankAccount: str(r.bank_account), bankHolder: str(r.bank_holder),
  name: str((r.merchants as Row | null)?.name),
});

const sellerToShipRow = (s: ShippingPolicy) => ({
  ship_fee: s.fee, ship_free_over: s.freeOver, ship_island_fee: s.islandFee, ship_lead_days: s.leadDays, ship_cold: s.cold,
  courier_code: s.courier.code, courier_name: s.courier.name,
});

/* ---------- 판매자 ---------- */

export async function sellerByMerchant(merchantId: string): Promise<Seller | null> {
  const { data } = await need().from("sellers").select(SELLER_COLS).eq("merchant_id", merchantId).maybeSingle();
  return data ? sellerFromRow(data as unknown as Row) : null;
}

export async function sellerById(id: string): Promise<Seller | null> {
  const { data } = await need().from("sellers").select(SELLER_COLS).eq("id", id).maybeSingle();
  return data ? sellerFromRow(data as unknown as Row) : null;
}

/**
 * 입점 신청·수정 — 파트너가 저장한다. 처음이면 'applied'로 만들고, 승인 상태는 여기서 바꾸지 않는다(운영자 몫).
 * 양조장 파트너만 판매자가 될 수 있다(자기 술을 파는 곳 — 도소매업자는 전통주를 통신판매할 수 없다).
 */
export async function saveSeller(
  merchant: { id: string; kind: string; name: string },
  raw: Record<string, unknown>,
): Promise<Seller> {
  if (merchant.kind !== "brewery") throw new Error("전통주를 빚는 양조장만 판매자로 입점할 수 있어요");
  const c = need();
  const text = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  const shipping = cleanShippingPolicy({ ...raw, courier: cleanCourier(raw.courierCode, raw.courierName) });
  const row = {
    merchant_id: merchant.id,
    license_no: text(raw.licenseNo, 40), license_at: text(raw.licenseAt, 10) || null, license_note: text(raw.licenseNote, 200),
    biz_name: text(raw.bizName, 60), biz_no: String(raw.bizNo ?? "").replace(/\D/g, "").slice(0, 10),
    owner_name: text(raw.ownerName, 30), cs_phone: text(raw.csPhone, 20),
    ...sellerToShipRow(shipping),
    from_addr: text(raw.fromAddr, 160), return_addr: text(raw.returnAddr, 160),
    bank: text(raw.bank, 20), bank_account: text(raw.bankAccount, 30), bank_holder: text(raw.bankHolder, 30),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await c.from("sellers").upsert(row, { onConflict: "merchant_id" }).select(SELLER_COLS).single();
  if (error) throw new Error(error.message);
  return sellerFromRow(data as unknown as Row);
}

/** 운영자: 입점 승인·정지. 승인은 통신판매 승인 번호를 확인한 뒤에만 */
export async function setSellerStatus(id: string, status: SellerStatus, feeRate?: number): Promise<void> {
  const c = need();
  const patch: Row = { status, updated_at: new Date().toISOString() };
  if (status === "approved") {
    const s = await sellerById(id);
    if (!s?.licenseNo) throw new Error("주류 통신판매 승인 번호를 먼저 받아 적어 주세요");
    patch.approved_at = new Date().toISOString();
  }
  if (feeRate != null && Number.isFinite(feeRate)) patch.fee_rate = Math.max(0, Math.min(30, feeRate));
  const { error } = await c.from("sellers").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  if (status === "suspended") await c.from("products").update({ status: "off", updated_at: new Date().toISOString() }).eq("seller_id", id);
}

export async function listSellers(): Promise<Seller[]> {
  const { data, error } = await need().from("sellers").select(SELLER_COLS).order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Row[]).map(sellerFromRow);
}

/* ---------- 상품 ---------- */

const PRODUCT_COLS = "id, seller_id, drink_id, name, volume, abv, price, list_price, stock, per_order, cold, ship_free, photos, descr, status";

export const productFromRow = (r: Row): Product => ({
  id: str(r.id), sellerId: str(r.seller_id), drinkId: str(r.drink_id), name: str(r.name), volume: str(r.volume),
  abv: r.abv == null ? null : Number(r.abv), price: int(r.price), listPrice: int(r.list_price), stock: int(r.stock), perOrder: int(r.per_order),
  cold: r.cold === true, shipFree: r.ship_free === true,
  photos: Array.isArray(r.photos) ? (r.photos as string[]).map(String) : [],
  desc: str(r.descr), status: (str(r.status) || "selling") as Product["status"],
});

export async function listProducts(sellerId: string): Promise<Product[]> {
  const { data, error } = await need().from("products").select(PRODUCT_COLS).eq("seller_id", sellerId).order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Row[]).map(productFromRow);
}

/** 술 상세에서 보여 줄 판매중 상품 — 승인된 판매자만, 싼 것부터 */
export async function productsForDrink(drinkId: string): Promise<{ product: Product; seller: Seller }[]> {
  const c = db();
  if (!c || !drinkId) return [];
  const { data, error } = await c.from("products")
    .select(`${PRODUCT_COLS}, sellers!inner(${SELLER_COLS})`)
    .eq("drink_id", drinkId).eq("status", "selling").gt("stock", 0).eq("sellers.status", "approved")
    .order("price", { ascending: true }).limit(10);
  if (error) { console.warn("[shop] productsForDrink", error.message); return []; }
  return ((data ?? []) as unknown as Row[]).map((r) => ({ product: productFromRow(r), seller: sellerFromRow(r.sellers as unknown as Row) }));
}

export type SaveProductCtx = { drinkExists: boolean; onlineSellable: boolean };

export async function saveProduct(seller: Seller, id: string | null, raw: unknown, ctx: SaveProductCtx): Promise<Product> {
  const p = cleanProduct(raw);
  const problem = productProblem(p, { ...ctx, sellerCold: seller.shipping.cold });
  if (problem) throw new Error(problem);
  const row = {
    seller_id: seller.id, drink_id: p.drinkId, name: p.name, volume: p.volume, abv: p.abv, price: p.price, list_price: p.listPrice,
    stock: p.stock, per_order: p.perOrder, cold: p.cold, ship_free: p.shipFree, photos: p.photos, descr: p.desc, status: p.status,
    updated_at: new Date().toISOString(),
  };
  const c = need();
  const q = id ? c.from("products").update(row).eq("id", id).eq("seller_id", seller.id) : c.from("products").insert(row);
  const { data, error } = await q.select(PRODUCT_COLS).single();
  if (error) throw new Error(error.message);
  return productFromRow(data as unknown as Row);
}

export async function deleteProduct(sellerId: string, id: string): Promise<void> {
  const { error } = await need().from("products").delete().eq("id", id).eq("seller_id", sellerId);
  if (error) throw new Error(error.message);
}

/** 재고 수기 조정(입고) — 이력을 남긴다 */
export async function addStock(sellerId: string, id: string, delta: number, reason = "수기 조정"): Promise<Product> {
  const c = need();
  const { data: cur } = await c.from("products").select("stock, status").eq("id", id).eq("seller_id", sellerId).maybeSingle();
  if (!cur) throw new Error("상품을 찾지 못했어요");
  const stock = Math.max(0, int((cur as unknown as Row).stock) + Math.floor(delta));
  const status = (cur as unknown as Row).status === "soldout" && stock > 0 ? "selling" : (cur as unknown as Row).status;
  const { data, error } = await c.from("products").update({ stock, status, updated_at: new Date().toISOString() }).eq("id", id).select(PRODUCT_COLS).single();
  if (error) throw new Error(error.message);
  await c.from("stock_logs").insert({ product_id: id, delta: Math.floor(delta), reason });
  return productFromRow(data as unknown as Row);
}

/* ---------- 장바구니 ---------- */

/** 장바구니 줄 + 판매자 정보 — 금액 계산은 shared summarizeCart */
export async function getCart(userId: string, opts: { island?: boolean } = {}): Promise<CartSummary> {
  const c = db();
  if (!c || !userId) return { groups: [], itemsTotal: 0, shipTotal: 0, total: 0, blocked: [] };
  const { data, error } = await c.from("cart_items")
    .select(`qty, products!inner(${PRODUCT_COLS}, sellers!inner(${SELLER_COLS}))`)
    .eq("user_id", userId).order("added_at", { ascending: true }).limit(50);
  if (error) { console.warn("[shop] getCart", error.message); return { groups: [], itemsTotal: 0, shipTotal: 0, total: 0, blocked: [] }; }
  const lines: CartLine[] = [], sellers = new Map<string, SellerInfo>();
  for (const r of (data ?? []) as unknown as Row[]) {
    const pr = r.products as Row;
    const p = productFromRow(pr), s = sellerFromRow(pr.sellers as unknown as Row);
    const off = s.status !== "approved" || p.status === "off";
    sellers.set(s.id, { sellerId: s.id, name: s.name, shipping: s.shipping });
    lines.push({
      productId: p.id, sellerId: p.sellerId, name: p.name, price: p.price, qty: int(r.qty), volume: p.volume,
      photo: p.photos[0], cold: p.cold, shipFree: p.shipFree, drinkId: p.drinkId,
      buyable: off ? 0 : buyableQty(p),
    });
  }
  return summarizeCart(lines, [...sellers.values()], opts);
}

export async function addToCart(userId: string, productId: string, qty: number): Promise<void> {
  const c = need();
  const { data } = await c.from("cart_items").select("qty").eq("user_id", userId).eq("product_id", productId).maybeSingle();
  const next = Math.max(1, Math.min(20, int((data as Row | null)?.qty) + Math.max(1, Math.floor(qty))));
  const { error } = await c.from("cart_items").upsert({ user_id: userId, product_id: productId, qty: next }, { onConflict: "user_id,product_id" });
  if (error) throw new Error(error.message);
}

export async function setCartQty(userId: string, productId: string, qty: number): Promise<void> {
  const c = need();
  const n = Math.floor(qty);
  if (n <= 0) { await c.from("cart_items").delete().eq("user_id", userId).eq("product_id", productId); return; }
  const { error } = await c.from("cart_items").upsert({ user_id: userId, product_id: productId, qty: Math.min(20, n) }, { onConflict: "user_id,product_id" });
  if (error) throw new Error(error.message);
}

export async function clearCart(userId: string): Promise<void> {
  await need().from("cart_items").delete().eq("user_id", userId);
}

export async function cartCount(userId: string): Promise<number> {
  const c = db();
  if (!c || !userId) return 0;
  const { count } = await c.from("cart_items").select("product_id", { count: "exact", head: true }).eq("user_id", userId);
  return count ?? 0;
}

/** 배송 설정이 비어 있는 판매자에게 쓰는 기본값 */
export const defaultShipping = () => ({ ...DEFAULT_SHIPPING });

/** 상품에 연결할 카탈로그 술 — 이름 또는 id로 찾는다(온라인 판매 불가 술은 상품으로 만들 수 없다) */
export async function findCatalogDrink(idOrName: string): Promise<{ id: string; name: string; onlineSellable: boolean } | null> {
  const c = db();
  const q = String(idOrName ?? "").trim();
  if (!c || !q) return null;
  const { data } = await c.from("drinks").select("id, name, online_sellable").or(`id.eq.${q},name.eq.${q}`).limit(1).maybeSingle();
  if (!data) return null;
  const r = data as Row;
  return { id: str(r.id), name: str(r.name), onlineSellable: r.online_sellable !== false };
}

/** 그 양조장의 카탈로그 술 목록 — 상품 등록 화면에서 고르게 */
export async function breweryDrinkOptions(brewery: string): Promise<{ id: string; name: string; abv: number | null; onlineSellable: boolean }[]> {
  const c = db();
  const name = String(brewery ?? "").trim();
  if (!c || !name) return [];
  const { data } = await c.from("drinks").select("id, name, abv, online_sellable").eq("brewery_name", name).order("name").limit(100);
  return ((data ?? []) as unknown as Row[]).map((r) => ({ id: str(r.id), name: str(r.name), abv: r.abv == null ? null : Number(r.abv), onlineSellable: r.online_sellable !== false }));
}
