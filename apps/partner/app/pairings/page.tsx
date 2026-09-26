/** 페어링 — 양조장 파트너가 "우리 술에 어울리는 음식"을 적는다(docs/25 §2). 적은 즉시 손님 화면에 양조장 공식 근거로 게시된다. */
import Link from "next/link";
import { redirect } from "next/navigation";
import { PARTNER_PAIRING_MAX_PER_DRINK } from "@pairinggo/shared";
import { catalogNames } from "@pairinggo/server/merchant-store";
import { breweryDrinkOptions } from "@pairinggo/server/shop";
import { listPartnerPairings } from "@pairinggo/server/partner-pairings";
import { Bar, Tabs } from "../_bar";
import { requireApprovedMerchant } from "@/lib/partner";
import { PairingEditor } from "./PairingEditor";

export const metadata = { title: "페어링" };
export const dynamic = "force-dynamic";

export default async function PairingsPage() {
  const { merchant } = await requireApprovedMerchant();
  if (merchant.kind !== "brewery") redirect("/");
  const [cat, drinks, rows] = await Promise.all([
    catalogNames(),
    merchant.brewery ? breweryDrinkOptions(merchant.brewery) : Promise.resolve([]),
    listPartnerPairings(merchant.id),
  ]);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://pairinggo.vercel.app";
  return (
    <>
      <Bar store={merchant.name} signedIn />
      <main className="stack">
        <div>
          <h1>페어링</h1>
          <p className="lead" style={{ margin: 0 }}>
            우리 술에 어울리는 음식을 적어 주세요. 적은 즉시 페어링GO의 그 술·그 음식 화면에 <b>“양조장 공식”</b> 추천으로 올라가요(화면 반영은 길어야 10분).
            술 하나에 음식 {PARTNER_PAIRING_MAX_PER_DRINK}개까지, 한 줄 이유는 손님에게 “{merchant.brewery || "양조장"} 제공”으로 보여요.
          </p>
        </div>
        {!merchant.brewery ? (
          <div className="panel"><p className="muted" style={{ margin: 0 }}><Link href="/store">매장 정보</Link>에서 ‘우리 양조장’을 먼저 골라 주세요 — 그래야 우리 술 목록이 떠요.</p></div>
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
