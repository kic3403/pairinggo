import { PARTNER_PLACE_LABEL } from "@pairinggo/shared";
import { catalogNames, getStoreInfo } from "@pairinggo/server/merchant-store";
import { breweryDrinkOptions } from "@pairinggo/server/shop";
import { menuReadConfigured } from "@pairinggo/server/menu-read";
import { Bar, Tabs } from "../_bar";
import { requireApprovedMerchant } from "@/lib/partner";
import { StoreForm } from "./StoreForm";
import { BizDocUpload } from "./BizDocUpload";
import { db } from "@pairinggo/server/db";

export const metadata = { title: "매장 정보" };
export const dynamic = "force-dynamic";

export default async function StorePage() {
  const { merchant } = await requireApprovedMerchant();
  const [{ phone, info }, cat, ourDrinks, doc] = await Promise.all([
    getStoreInfo(merchant), catalogNames(),
    merchant.kind === "brewery" && merchant.brewery ? breweryDrinkOptions(merchant.brewery) : Promise.resolve([]),
    Promise.resolve(db()?.from("merchants").select("biz_doc_paths,biz_doc_at").eq("id", merchant.id).maybeSingle()).then((r) => r?.data ?? null).catch(() => null),
  ]);
  return (
    <>
      <Bar store={merchant.name} signedIn />
      <main>
        <h1>매장 정보</h1>
        <BizDocUpload count={((doc?.biz_doc_paths as string[] | null) ?? []).length} at={(doc?.biz_doc_at as string | null) ?? null} />
        <p className="lead">저장하면 페어링GO {PARTNER_PLACE_LABEL[merchant.kind]} 목록의 우리 매장 카드에 바로 보여요. 확인된 매장은 목록 맨 앞에 올라가요. 사실과 다른 내용은 운영자가 고치거나 되돌릴 수 있어요.</p>
        <StoreForm phone={phone} info={info} drinks={cat.drinks} foods={cat.foods} siteUrl={process.env.NEXT_PUBLIC_SITE_URL || "https://pairinggo.kr"} kakaoId={merchant.kakaoPlaceId} menuReadEnabled={menuReadConfigured()}
          kind={merchant.kind} brewery={merchant.brewery} breweries={cat.breweries} ourDrinks={ourDrinks} />
      </main>
      <Tabs active="store" kind={merchant.kind} />
    </>
  );
}
