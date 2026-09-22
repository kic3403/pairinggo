import Link from "next/link";
import { addDays, kstParts } from "@pairinggo/shared";
import { Bar, Tabs } from "../_bar";
import { BookingBoard } from "../BookingBoard";
import { bookings } from "@/lib/bookings";
import { requireApprovedMerchant } from "@/lib/partner";

export const metadata = { title: "예약 목록" };
export const dynamic = "force-dynamic";

/** 예약 목록 — 다가오는 30일 · 지난 30일 */
export default async function ReservationsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { merchant } = await requireApprovedMerchant();
  const past = (await searchParams).view === "past";
  const today = kstParts(new Date()).date;
  const list = past ? (await bookings(merchant.id, addDays(today, -30), addDays(today, -1))).reverse() : await bookings(merchant.id, today, addDays(today, 30));
  return (
    <>
      <Bar store={merchant.name} signedIn />
      <main>
        <h1>예약 목록</h1>
        <div className="seg">
          <Link href="/reservations" aria-current={!past ? "page" : undefined}>다가오는 30일</Link>
          <Link href="/reservations?view=past" aria-current={past ? "page" : undefined}>지난 30일</Link>
        </div>
        <BookingBoard items={list} showDate />
      </main>
      <Tabs active="reservations" kind={merchant.kind} />
    </>
  );
}
