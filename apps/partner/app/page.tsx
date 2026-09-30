import Link from "next/link";
import { addDays, formatBizNo, formatVisit, isDate, isManualPlaceId, kstParts, MERCHANT_STATUS_LABEL, PARTNER_PLACE_LABEL } from "@pairinggo/shared";
import { getSettings, getStoreInfo } from "@pairinggo/server/merchant-store";
import { listMerchantReviews } from "@pairinggo/server/review-replies";
import { listPartnerPairings } from "@pairinggo/server/partner-pairings";
import { db } from "@pairinggo/server/db";
import { Bar, Tabs } from "./_bar";
import { BookingBoard } from "./BookingBoard";
import { PushToggle } from "./PushToggle";
import { bookings, summarize } from "@/lib/bookings";
import { myMerchants, type MyMerchant } from "@/lib/partner";
import { requirePartner } from "@/lib/session";

export const dynamic = "force-dynamic";

/** 직접 입력한 매장(카카오맵 미연결) 안내 — 연결 전에는 페어링GO 검색·예약 화면에 나오지 않는다 */
function ManualNote({ kind }: { kind: MyMerchant["kind"] }) {
  return <p className="manual-note">직접 입력한 매장이에요. 운영자가 카카오맵 장소를 찾아 연결하면 페어링GO {PARTNER_PLACE_LABEL[kind]} 검색·예약에 나와요. 카카오맵에 아직 없다면 카카오맵 앱의 <b>장소 등록 요청</b>을 해 두면 빨라져요.</p>;
}

function StatusPanel({ m }: { m: MyMerchant }) {
  const tone = m.status === "applied" ? "warn" : m.status === "approved" ? "ok" : "bad";
  return (
    <section className="panel status">
      <div><span className={`chip ${tone}`}>{MERCHANT_STATUS_LABEL[m.status]}</span></div>
      {m.status === "applied" ? <p>신청을 받았어요. 운영자가 매장과 사업자 정보를 확인한 뒤 승인하면 이 화면에서 예약 관리가 열려요. 보통 1~2 영업일 걸려요.</p> : null}
      {m.status === "rejected" ? <p>승인되지 않았어요{m.rejectReason ? ` — ${m.rejectReason}` : ""}. 정보를 고쳐 다시 신청하려면 운영자에게 문의해 주세요.</p> : null}
      {m.status === "suspended" ? <p>이용이 잠시 멈춰 있어요{m.rejectReason ? ` — ${m.rejectReason}` : ""}. 그동안 손님이 새로 예약할 수 없어요.</p> : null}
      {isManualPlaceId(m.kakaoPlaceId) ? <ManualNote kind={m.kind} /> : null}
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
  const [list, settings, todos] = await Promise.all([bookings(m.id, date, date), getSettings(m.id), todoItems(m)]);
  const s = summarize(list);
  const label = date === today ? "오늘" : date === addDays(today, 1) ? "내일" : date === addDays(today, -1) ? "어제" : "";
  return (
    <>
      <Bar store={m.name} signedIn />
      <main>
        {isManualPlaceId(m.kakaoPlaceId) ? <ManualNote kind={m.kind} /> : null}
        {todos.length > 0 && (
          <section className="panel todo" aria-label="할 일">
            <b>챙길 일 {todos.length}</b>
            <ul>{todos.map((t) => <li key={t.href + t.text}><Link href={t.href}>{t.text}</Link>{t.why ? <span className="muted"> — {t.why}</span> : null}</li>)}</ul>
          </section>
        )}
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
      <Tabs active="home" kind={m.kind} />
    </>
  );
}

/**
 * 사장님이 놓치기 쉬운 일(2026-10-01) — 사업자등록증 없음 · 답글 안 단 리뷰 · 페어링 없음 · 메뉴판/술 표·대표 사진 비어 있음.
 * 하나도 없으면 패널을 보이지 않는다. 각 조회가 실패해도 홈이 깨지지 않게 개별로 삼킨다.
 */
async function todoItems(m: MyMerchant): Promise<{ text: string; why?: string; href: string }[]> {
  const out: { text: string; why?: string; href: string }[] = [];
  const [doc, reviews, pairings, store] = await Promise.all([
    Promise.resolve(db()?.from("merchants").select("biz_doc_paths").eq("id", m.id).maybeSingle()).then((r) => ((r?.data?.biz_doc_paths as string[] | null) ?? []).length).catch(() => 1),
    listMerchantReviews(m).catch(() => []),
    m.kind === "brewery" || m.kind === "restaurant" ? listPartnerPairings(m.id).catch(() => null) : Promise.resolve(null),
    getStoreInfo(m).then((r) => r.info).catch(() => null),
  ]);
  if (doc === 0) out.push({ text: "사업자등록증 올리기", why: "운영 확인용, 손님에게는 안 보여요", href: "/store" });
  const unanswered = reviews.filter((r) => !r.reply).length;
  if (unanswered > 0) out.push({ text: `답글 안 단 리뷰 ${unanswered}개`, why: "답글은 손님 화면에 “사장님 답글”로 보여요", href: "/reviews" });
  if (pairings && pairings.length === 0) out.push({ text: "추천 페어링 넣기", why: m.kind === "brewery" ? "우리 술에 어울리는 음식을 적으면 술 화면에 공식 추천으로" : "우리 가게 술 × 메뉴를 짝지으면 검색·매장 화면에 추천으로", href: "/pairings" });
  if (store) {
    const drinks = store.drinkItems?.length ?? 0, menu = store.menuItems?.length ?? 0, photos = store.photos?.length ?? 0;
    if (m.kind === "restaurant" && menu === 0) out.push({ text: "메뉴판 채우기", why: "사진 한 장이면 표로 읽어 줘요", href: "/store" });
    if (drinks === 0) out.push({ text: m.kind === "restaurant" ? "취급하는 술 적기" : "우리 술 목록 채우기", why: "손님이 그 술로 검색하면 우리 매장이 나와요", href: "/store" });
    if (photos === 0) out.push({ text: "대표 사진 올리기", why: "매장 화면 맨 위에 보여요", href: "/store" });
  }
  return out;
}
