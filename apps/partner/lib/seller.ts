/**
 * 파트너 앱 판매(입점) — 승인된 양조장 매장의 판매자 정보를 가져온다(docs/22).
 * 판매자는 양조장만(merchants.kind='brewery') — 전통주 제조자만 통신판매할 수 있어서다.
 */
import { sellerByMerchant, type Seller } from "@pairinggo/server/shop";
import { redirect } from "next/navigation";
import { requireApprovedMerchant, approvedOrError, type MyMerchant } from "./partner";
import type { PartnerUser } from "./session";

export type SellerCtx = { user: PartnerUser; merchant: MyMerchant; seller: Seller | null };

/** 판매 화면 — 양조장이 아니면 홈으로 */
export async function requireBrewery(): Promise<SellerCtx> {
  const { user, merchant } = await requireApprovedMerchant();
  if (merchant.kind !== "brewery") redirect("/");
  const seller = await sellerByMerchant(merchant.id).catch(() => null);
  return { user, merchant, seller };
}

/** 판매 API — 승인·양조장·입점 승인까지 확인. 응답이 돌아오면 그대로 반환 */
export async function sellerOrError(opts: { approved?: boolean } = {}): Promise<SellerCtx | Response> {
  const a = await approvedOrError();
  if (a instanceof Response) return a;
  if (a.merchant.kind !== "brewery") return Response.json({ error: "양조장만 판매할 수 있어요" }, { status: 403 });
  const seller = await sellerByMerchant(a.merchant.id).catch(() => null);
  if (opts.approved && seller?.status !== "approved") return Response.json({ error: "입점 승인을 기다리는 중이에요" }, { status: 403 });
  return { user: a.user, merchant: a.merchant, seller };
}
