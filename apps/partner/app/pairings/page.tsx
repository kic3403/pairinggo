/**
 * 페어링 — 파트너가 "우리 술에 어울리는 음식"을 적는다(docs/25 §2 · 2026-09-29 확장). 적은 즉시 손님 화면에 공식 추천으로 게시된다.
 *  · 양조장: 우리 술마다 음식을 직접 입력(카탈로그 이름은 추천 목록으로만)
 *  · 식당: 우리 술 표의 술 × 우리 메뉴의 음식(둘 다 고르거나 직접 입력)
 * 카탈로그와 연결되면 그 술·음식 화면 카드에 근거로, 연결 안 돼도 술·매장 화면의 추천 칸과 검색에 보인다.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { PARTNER_PAIRING_MAX_PER_DRINK, PARTNER_PAIRING_MAX_TOTAL } from "@pairinggo/shared";
import { catalogNames, getStoreInfo } from "@pairinggo/server/merchant-store";
import { breweryDrinkOptions } from "@pairinggo/server/shop";
import { listPartnerPairings } from "@pairinggo/server/partner-pairings";
import { Bar, Tabs } from "../_bar";
import { requireApprovedMerchant } from "@/lib/partner";
import { PairingEditor, RestaurantPairingEditor } from "./PairingEditor";

export const metadata = { title: "페어링" };
export const dynamic = "force-dynamic";

export default async function PairingsPage() {
  const { merchant } = await requireApprovedMerchant();
  if (merchant.kind !== "brewery" && merchant.kind !== "restaurant") redirect("/");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://pairinggo.kr";

  if (merchant.kind === "restaurant") {
    const [store, rows] = await Promise.all([getStoreInfo(merchant), listPartnerPairings(merchant.id)]);
    const menu = (store.info?.menuItems ?? []).filter((m) => !m.section || m.section === "food").map((m) => m.name);
    const drinks = (store.info?.drinkItems ?? []).map((d) => d.name);
    return (
      <>
        <Bar store={merchant.name} signedIn />
        <main className="stack">
          <div>
            <h1>추천 페어링</h1>
            <p className="lead" style={{ margin: 0 }}>
              우리 가게의 술과 어울리는 메뉴를 짝지어 주세요. 손님에게 <b>“{merchant.name} 추천”</b>으로 보이고, 페어링GO의 그 술·그 음식 화면과 우리 매장 화면, 검색 결과에 올라가요(반영은 길어야 10분).
              매장당 {PARTNER_PAIRING_MAX_TOTAL}개, 술 하나에 {PARTNER_PAIRING_MAX_PER_DRINK}개까지예요.
            </p>
          </div>
          {!drinks.length && !menu.length && <div className="panel"><p className="muted" style={{ margin: 0 }}><Link href="/sell">판매</Link> 탭에서 메뉴판과 술 표를 채우면 여기서 바로 고를 수 있어요. 직접 입력해도 돼요.</p></div>}
          <RestaurantPairingEditor drinks={drinks} menu={menu} rows={rows} siteUrl={siteUrl} kakaoId={merchant.kakaoPlaceId} storeName={merchant.name} />
        </main>
        <Tabs active="pairings" kind={merchant.kind} />
      </>
    );
  }

  const [cat, drinks, rows] = await Promise.all([
    catalogNames(),
    merchant.brewery ? breweryDrinkOptions(merchant.brewery) : Promise.resolve([]),
    listPartnerPairings(merchant.id),
  ]);
  return (
    <>
      <Bar store={merchant.name} signedIn />
      <main className="stack">
        <div>
          <h1>페어링</h1>
          <p className="lead" style={{ margin: 0 }}>
            우리 술에 어울리는 음식을 자유롭게 적어 주세요. 적은 즉시 페어링GO의 그 술 화면에 <b>“양조장 공식”</b> 추천으로 올라가요(화면 반영은 길어야 10분).
            페어링GO에 있는 음식이면 그 음식 화면에도 이어지고, 없는 음식도 술 화면과 검색에 보여요. 술 하나에 음식 {PARTNER_PAIRING_MAX_PER_DRINK}개까지, 한 줄 이유는 손님에게 “{merchant.brewery || "양조장"} 제공”으로 보여요.
          </p>
        </div>
        {!merchant.brewery ? (
          <div className="panel"><p className="muted" style={{ margin: 0 }}><Link href="/store">양조장 정보</Link>에서 ‘우리 양조장’을 먼저 골라 주세요 — 그래야 우리 술 목록이 떠요.</p></div>
        ) : drinks.length === 0 ? (
          <div className="panel"><p className="muted" style={{ margin: 0 }}>카탈로그에 {merchant.brewery} 술이 아직 없어요. 운영자에게 술 등록을 요청해 주세요.</p></div>
        ) : (
          <PairingEditor drinks={drinks.map((d) => ({ id: d.id, name: d.name }))} foods={cat.foods} rows={rows} siteUrl={siteUrl} />
        )}
      </main>
      <Tabs active="pairings" kind={merchant.kind} />
    </>
  );
}
