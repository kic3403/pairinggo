import Link from "next/link";
import { addDays, formatBizNo, formatVisit, isDate, kstParts, MERCHANT_STATUS_LABEL } from "@pairinggo/shared";
import { getSettings } from "@pairinggo/server/merchant-store";
import { Bar, Tabs } from "./_bar";
import { BookingBoard } from "./BookingBoard";
import { PushToggle } from "./PushToggle";
import { bookings, summarize } from "@/lib/bookings";
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

/** 오늘(또는 고른 날) 예약 — 시간순 카드, 착석·완료·노쇼·매장 취소 */
export default async function Home({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const me = await requirePartner();
  const m = (await myMerchants(me.id))[0];
  if (!m || m.status !== "approved") {
    return (
      <>
        <Bar store={m?.name} signedIn />
        <main>
          <h1>{m ? m.name : "연결된 매장이 없어요"}</h1>
          <p className="lead">{me.name}님, 안녕하세요.</p>
          {m ? <StatusPanel m={m} /> : <p className="panel">매장 연결이 필요해요 — 운영자에게 문의해 주세요.</p>}
        </main>
      </>
    );
  }
  const today = kstParts(new Date()).date;
  const sp = await searchParams;
  const date = sp.date && isDate(sp.date) ? sp.date : today;
  const [list, settings] = await Promise.all([bookings(m.id, date, date), getSettings(m.id)]);
  const s = summarize(list);
  const label = date === today ? "오늘" : date === addDays(today, 1) ? "내일" : date === addDays(today, -1) ? "어제" : "";
  return (
    <>
      <Bar store={m.name} signedIn />
      <main>
        <div className="day-nav">
          <Link className="btn ghost sm" href={`/?date=${addDays(date, -1)}`} aria-label="전날">‹</Link>
          <h1 style={{ margin: 0 }}>{label ? `${label} · ` : ""}{formatVisit(date, "").trim()}</h1>
          <Link className="btn ghost sm" href={`/?date=${addDays(date, 1)}`} aria-label="다음 날">›</Link>
          {date !== today ? <Link className="linklike" href="/">오늘로</Link> : null}
        </div>
        <div className="sumrow">
          <div><b className="num">{s.parties}</b><span>팀</span></div>
          <div><b className="num">{s.people}</b><span>명</span></div>
          <div><b className="num">{s.seated}</b><span>착석 중</span></div>
          <div><b className="num">{s.noShow + s.cancelled}</b><span>노쇼·취소</span></div>
        </div>
        {!settings.accepting ? <p className="panel small" style={{ marginBottom: 12 }}>지금은 <b>예약 받기가 꺼져</b> 있어요. 페어링GO에 [예약하기]가 보이지 않아요. <Link href="/settings">예약 설정</Link></p> : null}
        <BookingBoard items={list} live={date === today} />
        <PushToggle />
      </main>
      <Tabs active="home" />
    </>
  );
}
