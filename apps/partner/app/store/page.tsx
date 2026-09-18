import { catalogNames, getStoreInfo } from "@pairinggo/server/merchant-store";
import { menuReadConfigured } from "@pairinggo/server/menu-read";
import { Bar, Tabs } from "../_bar";
import { requireApprovedMerchant } from "@/lib/partner";
import { StoreForm } from "./StoreForm";

export const metadata = { title: "매장 정보" };
export const dynamic = "force-dynamic";

export default async function StorePage() {
  const { merchant } = await requireApprovedMerchant();
  const [{ phone, info }, cat] = await Promise.all([getStoreInfo(merchant), catalogNames()]);
  return (
    <>
      <Bar store={merchant.name} signedIn />
      <main>
        <h1>매장 정보</h1>
        <p className="lead">저장하면 페어링GO 식당 목록의 우리 매장 카드에 바로 보여요. 확인된 매장은 목록 맨 앞에 올라가요. 사실과 다른 내용은 운영자가 고치거나 되돌릴 수 있어요.</p>
        <StoreForm phone={phone} info={info} drinks={cat.drinks} foods={cat.foods} siteUrl={process.env.NEXT_PUBLIC_SITE_URL || "https://pairinggo.vercel.app"} kakaoId={merchant.kakaoPlaceId} menuReadEnabled={menuReadConfigured()} />
      </main>
      <Tabs active="store" />
    </>
  );
}
