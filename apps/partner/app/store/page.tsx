/**
 * 정보 탭 — 양조장은 "양조장 정보", 식당·리쿼샵은 "매장 정보"(2026-10-02). 정보와 대표 사진만 여기서 고친다.
 * 파는 것(메뉴·술 표)은 판매 탭(/sell)으로 옮겼다.
 */
import Link from "next/link";
import { PARTNER_PLACE_LABEL } from "@pairinggo/shared";
import { catalogNames, getStoreInfo } from "@pairinggo/server/merchant-store";
import { Bar, Tabs, infoTabLabel } from "../_bar";
import { requireApprovedMerchant } from "@/lib/partner";
import { StoreForm } from "./StoreForm";
import { BizDocUpload } from "./BizDocUpload";
import { db } from "@pairinggo/server/db";

export const metadata = { title: "매장·양조장 정보" };
export const dynamic = "force-dynamic";

export default async function StorePage() {
  const { merchant } = await requireApprovedMerchant();
  const [{ phone, info }, cat, doc] = await Promise.all([
    getStoreInfo(merchant), catalogNames(),
    Promise.resolve(db()?.from("merchants").select("biz_doc_paths,biz_doc_at").eq("id", merchant.id).maybeSingle()).then((r) => r?.data ?? null).catch(() => null),
  ]);
  const place = PARTNER_PLACE_LABEL[merchant.kind];
  return (
    <>
      <Bar store={merchant.name} signedIn />
      <main>
        <h1>{infoTabLabel(merchant.kind)}</h1>
        <BizDocUpload count={((doc?.biz_doc_paths as string[] | null) ?? []).length} at={(doc?.biz_doc_at as string | null) ?? null} />
        <p className="lead">
          소개·대표 사진·편의 정보를 적어요. 저장하면 페어링GO {place} 목록의 우리 {merchant.kind === "brewery" ? "양조장" : "매장"} 카드에 바로 보이고, 확인된 곳은 목록 맨 앞에 올라가요.
          {" "}파는 {merchant.kind === "restaurant" ? "음식과 술" : "술"}은 <Link href="/sell">판매</Link> 탭에서 적어요. 사실과 다른 내용은 운영자가 고치거나 되돌릴 수 있어요.
        </p>
        <StoreForm phone={phone} info={info} siteUrl={process.env.NEXT_PUBLIC_SITE_URL || "https://pairinggo.kr"} kakaoId={merchant.kakaoPlaceId}
          kind={merchant.kind} brewery={merchant.brewery} breweries={cat.breweries} />
      </main>
      <Tabs active="store" kind={merchant.kind} />
    </>
  );
}
