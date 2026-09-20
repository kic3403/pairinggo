/** 입점 정보·배송 설정(docs/22 §3·§4-1) */
import Link from "next/link";
import { Bar, Tabs } from "../../_bar";
import { requireBrewery } from "@/lib/seller";
import { SellerForm, type SellerFormValue } from "../SellerForm";

export const metadata = { title: "입점·배송 설정" };
export const dynamic = "force-dynamic";

export default async function SellSetupPage() {
  const { merchant, seller } = await requireBrewery();
  const initial: SellerFormValue = {
    status: seller?.status ?? "none",
    licenseNo: seller?.licenseNo ?? "", licenseAt: seller?.licenseAt ?? "", licenseNote: seller?.licenseNote ?? "",
    bizName: seller?.bizName || merchant.name, bizNo: seller?.bizNo || merchant.bizNo || "", ownerName: seller?.ownerName || merchant.ownerName || "",
    csPhone: seller?.csPhone || merchant.phone || "",
    fromAddr: seller?.fromAddr || merchant.address || "", returnAddr: seller?.returnAddr || merchant.address || "",
    bank: seller?.bank ?? "", bankAccount: seller?.bankAccount ?? "", bankHolder: seller?.bankHolder ?? "",
    shipping: seller?.shipping ?? { fee: 0, freeOver: 0, islandFee: 0, leadDays: 2, cold: false, courier: { code: "", name: "" } },
    feeRate: seller?.feeRate ?? 0,
  };
  return (
    <>
      <Bar store={merchant.name} signedIn />
      <main className="stack">
        <div>
          <p className="small"><Link href="/sell">← 판매</Link></p>
          <h1>입점·배송 설정</h1>
        </div>
        <SellerForm initial={initial} />
      </main>
      <Tabs active="sell" kind={merchant.kind} />
    </>
  );
}
