import Link from "next/link";
import { formatBizNo, MERCHANT_STATUS_LABEL } from "@pairinggo/shared";
import { Bar, Tabs } from "./_bar";
import { myMerchants, type MyMerchant } from "@/lib/partner";
import { requirePartner } from "@/lib/session";

export const dynamic = "force-dynamic";

function StatusPanel({ m }: { m: MyMerchant }) {
  const tone = m.status === "applied" ? "warn" : m.status === "approved" ? "ok" : "bad";
  return (
    <section className="panel status">
      <div><span className={`chip ${tone}`}>{MERCHANT_STATUS_LABEL[m.status]}</span></div>
      {m.status === "applied" ? <p>신청을 받았어요. 운영자가 매장과 사업자 정보를 확인한 뒤 승인하면 이 화면에서 예약 관리가 열려요. 보통 1~2 영업일 걸려요.</p> : null}
      {m.status === "rejected" ? <p>승인되지 않았어요{m.rejectReason ? ` — ${m.rejectReason}` : ""}. 정보를 고쳐 다시 신청하려면 운영자에게 문의해 주세요.</p> : null}
      {m.status === "suspended" ? <p>이용이 잠시 멈춰 있어요{m.rejectReason ? ` — ${m.rejectReason}` : ""}. 그동안 손님이 새로 예약할 수 없어요.</p> : null}
      <dl>
        <dt>매장</dt><dd>{m.name}</dd>
        <dt>주소</dt><dd>{m.address || "—"}</dd>
        <dt>대표자</dt><dd>{m.ownerName}</dd>
        <dt>사업자</dt><dd className="num">{formatBizNo(m.bizNo)}</dd>
      </dl>
    </section>
  );
}

export default async function Home() {
  const me = await requirePartner();
  const merchants = await myMerchants(me.id);
  const m = merchants[0];
  return (
    <>
      <Bar store={m?.name} signedIn />
      <main>
        <h1>{m ? m.name : "연결된 매장이 없어요"}</h1>
        <p className="lead">{me.name}님, 안녕하세요.</p>
        {!m ? <p className="panel">매장 연결이 필요해요 — 운영자에게 문의해 주세요.</p> : m.status !== "approved" ? <StatusPanel m={m} /> : (
          <section className="panel stack">
            <p>승인된 매장이에요. 먼저 <b>영업시간과 예약 설정</b>을 정하고 예약 받기를 켜면 페어링GO 식당 목록에 [예약하기]가 붙어요.</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link className="btn primary" href="/settings">예약 설정</Link>
              <Link className="btn ghost" href="/store">매장 정보</Link>
            </div>
          </section>
        )}
      </main>
      {m?.status === "approved" ? <Tabs active="home" /> : null}
    </>
  );
}
