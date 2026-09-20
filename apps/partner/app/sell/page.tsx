/** 판매 — 파는 술 목록(docs/22). 양조장 파트너만 보인다. */
import Link from "next/link";
import { listProducts, breweryDrinkOptions } from "@pairinggo/server/shop";
import { sellerOrders } from "@pairinggo/server/shop-orders";
import { Bar, Tabs } from "../_bar";
import { requireBrewery } from "@/lib/seller";
import { ProductList } from "./ProductList";

export const metadata = { title: "판매" };
export const dynamic = "force-dynamic";

export default async function SellPage() {
  const { merchant, seller } = await requireBrewery();
  const [products, drinks, orders] = await Promise.all([
    seller ? listProducts(seller.id) : Promise.resolve([]),
    breweryDrinkOptions(merchant.brewery),
    seller ? sellerOrders(seller.id, { status: "open", limit: 50 }) : Promise.resolve([]),
  ]);
  const ready = seller?.status === "approved";
  return (
    <>
      <Bar store={merchant.name} signedIn />
      <main className="stack">
        <div>
          <h1>판매</h1>
          <p className="lead" style={{ margin: 0 }}>
            페어링GO에서 우리 술을 바로 팔아요. 주문·배송·문의는 양조장이 맡고, 페어링GO는 주문을 전달해요.
            {!merchant.brewery ? " 매장 정보에서 '우리 양조장'을 먼저 골라 주세요 — 그래야 우리 술 목록이 떠요." : ""}
          </p>
        </div>

        <div className="row">
          <Link className="btn ghost" href="/sell/setup">입점·배송 설정{seller ? "" : " (먼저 하기)"}</Link>
          <Link className="btn ghost" href="/sell/orders">주문{orders.length ? ` ${orders.length}` : ""}</Link>
        </div>

        {!seller ? (
          <p className="small muted">입점 신청을 먼저 해 주세요 — 주류 통신판매 승인 번호가 필요해요.</p>
        ) : null}

        <ProductList initial={products} drinks={drinks} canSell={ready} siteUrl={process.env.NEXT_PUBLIC_SITE_URL || "https://pairinggo.vercel.app"} />
      </main>
      <Tabs active="sell" kind={merchant.kind} />
    </>
  );
}
