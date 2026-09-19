/** 내 예약 — 다가오는 예약(취소 가능)·지난 예약. 매장 취소면 사유를 보여 준다 */
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatVisit, noShowMessage, toSlug } from "@pairinggo/shared";
import { noShowState } from "@pairinggo/server/reservations";
import { auth } from "@/auth";
import { myReservations, type MyReservation } from "@/lib/reservations";
import CancelButton from "./CancelButton";
import PushButton from "./PushButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "내 예약 | 페어링GO", robots: { index: false } };

function Card({ r }: { r: MyReservation }) {
  const tone = r.status === "confirmed" || r.status === "seated" ? "" : r.status === "cancelled_by_store" || r.status === "no_show" ? " bad" : " off";
  return (
    <li className="rsv-card">
      <div className="top">
        <b>{r.storeName}</b>
        <span className={`st${tone}`}>{r.statusLabel}</span>
      </div>
      <div className="when">{formatVisit(r.date, r.time)} · {r.partySize}명</div>
      <div className="sub">예약번호 <b>{r.code}</b>{r.roomRequested ? " · 룸 희망" : ""}{r.bringOwnDrink ? " · 술 지참" : ""}</div>
      {r.food || r.drink ? (
        <div className="sub">페어링 {r.food ? <Link href={`/foods/${toSlug(r.food)}`}>{r.food}</Link> : null}{r.food && r.drink ? " × " : ""}{r.drink ? <Link href={`/drinks/${toSlug(r.drink)}`}>{r.drink}</Link> : null}</div>
      ) : null}
      {r.note ? <div className="sub">요청 · {r.note}</div> : null}
      {r.status === "cancelled_by_store" && r.cancelReason ? <div className="sub" style={{ color: "var(--food-ink)" }}>매장 취소 사유 · {r.cancelReason}</div> : null}
      <div className="sub">{r.storeAddress}{r.storePhone ? <> · <a href={`tel:${r.storePhone.replace(/[^0-9+]/g, "")}`}>{r.storePhone}</a></> : null}</div>
      {r.status === "confirmed" ? (
        r.canCancel ? <CancelButton id={r.id} store={r.storeName} /> : <p className="small muted" style={{ margin: "8px 0 0" }}>{r.cancelBlockedReason}</p>
      ) : null}
    </li>
  );
}

export default async function MyReservationsPage() {
  const uid = (await auth())?.user?.id;
  if (!uid) redirect("/login?next=%2Fmy%2Freservations");
  const [rows, ns] = await Promise.all([myReservations(uid), noShowState(uid)]);
  const blocked = noShowMessage(ns);
  const now = Date.now();
  const upcoming = rows.filter((r) => (r.status === "confirmed" || r.status === "seated") && new Date(r.visitAt).getTime() > now - 3 * 3600_000).reverse();
  const past = rows.filter((r) => !upcoming.includes(r));
  return (
    <div className="wrap rsv">
      <p className="crumb"><Link href="/my">마이페이지</Link> · 내 예약</p>
      <h1>내 예약</h1>
      {blocked ? <p className="form-error">{blocked}</p> : null}
      <PushButton />
      <h2>다가오는 예약</h2>
      {upcoming.length ? <ul className="rsv-list">{upcoming.map((r) => <Card key={r.id} r={r} />)}</ul> : (
        <p className="muted">잡힌 예약이 없어요. 음식 상세의 “맛집 찾기”에서 <b>예약하기</b>가 붙은 파트너 매장을 예약할 수 있어요.</p>
      )}
      {past.length ? (<><h2>지난·취소된 예약</h2><ul className="rsv-list">{past.map((r) => <Card key={r.id} r={r} />)}</ul></>) : null}
    </div>
  );
}
