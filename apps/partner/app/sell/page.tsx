/**
 * 판매 탭(2026-10-02 정리) — **우리가 파는 것**을 적는 곳. 모든 업종에 보인다.
 *  · 식당: 메뉴판(음식·술 표) · 양조장: 판매하는 술 + 온라인 판매(입점) · 리쿼샵: 취급하는 술
 * 전에는 메뉴·술 표가 매장 정보 화면에 있고 판매 탭은 양조장의 온라인 상품만 있어 둘이 겹쳐 보였다(사용자 요청으로 옮김).
 * 온라인 판매(상품·재고·주문·입점 설정)는 여전히 양조장만 — 전통주 제조자만 통신판매할 수 있다(docs/22).
 */
import Link from "next/link";
import { catalogNames, getStoreInfo } from "@pairinggo/server/merchant-store";
import { menuReadConfigured } from "@pairinggo/server/menu-read";
import { listProducts, breweryDrinkOptions, sellerByMerchant } from "@pairinggo/server/shop";
import { sellerOrders } from "@pairinggo/server/shop-orders";
import { Bar, Tabs, infoTabLabel } from "../_bar";
import { requireApprovedMerchant } from "@/lib/partner";
import { MenuForm } from "./MenuForm";
import { ProductList } from "./ProductList";

export const metadata = { title: "판매" };
export const dynamic = "force-dynamic";

export default async function SellPage() {
  const { merchant } = await requireApprovedMerchant();
  const isBrewery = merchant.kind === "brewery";
  const seller = isBrewery ? await sellerByMerchant(merchant.id).catch(() => null) : null;
  const [{ info }, cat, ourDrinks, products, orders] = await Promise.all([
    getStoreInfo(merchant), catalogNames(),
    isBrewery && merchant.brewery ? breweryDrinkOptions(merchant.brewery) : Promise.resolve([]),
    seller ? listProducts(seller.id) : Promise.resolve([]),
    seller ? sellerOrders(seller.id, { status: "open", limit: 50 }) : Promise.resolve([]),
  ]);
  const ready = seller?.status === "approved";
  const infoLabel = infoTabLabel(merchant.kind);
  return (
    <>
      <Bar store={merchant.name} signedIn />
      <main className="stack">
        <div>
          <h1>판매</h1>
          <p className="lead" style={{ margin: 0 }}>
            {merchant.kind === "restaurant" ? "우리 가게에서 파는 음식과 술을 적어요. 손님 화면의 메뉴판에 그대로 보여요."
              : isBrewery ? "양조장에서 파는 술을 적고, 페어링GO에서 바로 팔 수도 있어요."
              : "매장에서 취급하는 술을 적어요. 손님 화면의 메뉴판에 그대로 보여요."}
            {" "}소개·대표 사진·주차 같은 정보는 <Link href="/store">{infoLabel}</Link> 탭에서 고쳐요.
          </p>
        </div>

        <MenuForm info={info} drinks={cat.drinks} foods={cat.foods} menuReadEnabled={menuReadConfigured()} kind={merchant.kind} brewery={merchant.brewery} ourDrinks={ourDrinks} infoLabel={infoLabel} />

        {isBrewery ? (
          <section className="stack" aria-labelledby="online-sell">
            <div>
              <h2 id="online-sell" style={{ margin: 0 }}>온라인 판매</h2>
              <p className="small muted" style={{ margin: "2px 0 0" }}>
                페어링GO에서 우리 술을 바로 팔아요. 주문·배송·문의는 양조장이 맡고, 페어링GO는 주문을 전달해요. 위의 ‘판매하는 술’은 손님에게 보여 주는 목록이고, 여기는 가격·재고를 정해 실제로 주문을 받는 상품이에요.
                {!merchant.brewery ? ` ${infoLabel}에서 '우리 양조장'을 먼저 골라 주세요 — 그래야 올릴 수 있는 술 목록이 떠요.` : ""}
              </p>
            </div>
            <div className="row">
              <Link className="btn ghost" href="/sell/setup">입점·배송 설정{seller ? "" : " (먼저 하기)"}</Link>
              <Link className="btn ghost" href="/sell/orders">주문{orders.length ? ` ${orders.length}` : ""}</Link>
            </div>
            {!seller ? <p className="small muted">입점 신청을 먼저 해 주세요 — 주류 통신판매 승인 번호가 필요해요.</p> : null}
            <ProductList initial={products} drinks={ourDrinks} canSell={ready} siteUrl={process.env.NEXT_PUBLIC_SITE_URL || "https://pairinggo.kr"} />
          </section>
        ) : null}
      </main>
      <Tabs active="sell" kind={merchant.kind} />
    </>
  );
}
