/**
 * 식당 예약(2026-09-18) — 페어링GO 파트너 매장만. 날짜 → 인원 → 시간 → 예약자·요청사항 → 매장 제공 동의 → 바로 확정.
 * 로그인·번호 인증·예약은 클라이언트가 API로(공개 페이지에서 auth()를 부르지 않는 규칙). 예약 가능 시간은 캐시 없는 API로 그때그때.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { kstParts, PARTNER_KIND_LABEL, PARTNER_RESERVATION_LABEL, placeChips, toSlug } from "@pairinggo/shared";
import { getCatalog } from "@/lib/catalog";
import { reservePageData } from "@/lib/reservations";
import ReserveForm from "./ReserveForm";
import MenuBoard, { MenuThumbs } from "../../_components/MenuBoard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "예약하기 | 페어링GO", robots: { index: false, follow: false } };

export default async function ReservePage({ params, searchParams }: { params: Promise<{ kakaoId: string }>; searchParams: Promise<{ food?: string; drink?: string }> }) {
  const { kakaoId } = await params;
  const sp = await searchParams;
  const data = /^\d{1,20}$/.test(kakaoId) ? await reservePageData(kakaoId) : null;
  if (!data) {
    return (
      <div className="wrap">
        <h1>예약할 수 없는 매장이에요</h1>
        <p className="muted">페어링GO 파트너 매장만 앱에서 예약할 수 있어요. 매장에 전화로 문의해 주세요.</p>
        <div className="btns"><Link className="btn" href="/foods">음식 둘러보기</Link></div>
      </div>
    );
  }
  const c = await getCatalog();
  const food = sp.food ? c.dataset.foods.find((f) => f.id === sp.food) : undefined;
  const drink = sp.drink ? c.dataset.drinks.find((d) => d.id === sp.drink) : undefined;
  const chips = placeChips(data.info, null);
  return (
    <div className="wrap rsv">
      <p className="crumb"><Link href="/">홈</Link>{food ? <> · <Link href={`/foods/${toSlug(food.name)}`}>{food.name}</Link></> : null} · {PARTNER_RESERVATION_LABEL[data.kind]}</p>
      <h1>{data.name}</h1>
      {data.kind !== "restaurant" ? <p className="lead" style={{ marginTop: 2 }}>{PARTNER_KIND_LABEL[data.kind]} {PARTNER_RESERVATION_LABEL[data.kind]}이에요 — 방문하실 날짜·시간과 인원을 골라 주세요.</p> : null}
      <div className="meta">
        <span>{data.address}</span>
        {data.phone ? <a href={`tel:${data.phone.replace(/[^0-9+]/g, "")}`}>{data.phone}</a> : null}
      </div>
      {chips.length || data.info?.menuNote ? (
        <div className="rsv-info">
          {chips.map((ch) => <span key={ch.key} className={`amen ${ch.tone} ok`}>{ch.label}</span>)}
          {data.info?.menuNote ? <p>{data.info.menuNote}</p> : null}
        </div>
      ) : null}
      {data.info && (data.info.menuItems.length || data.info.drinkItems.length) ? (
        <details className="rsv-menu">
          <summary>메뉴판 보기 <span className="muted small">메뉴 {data.info.menuItems.length} · 술 {data.info.drinkItems.length}</span> <MenuThumbs menu={data.info.menuItems} drinks={data.info.drinkItems} /></summary>
          <MenuBoard menu={data.info.menuItems} drinks={data.info.drinkItems} />
        </details>
      ) : null}
      {data.settings.notice ? <p className="rsv-notice">{data.settings.notice}</p> : null}
      {!data.bookable ? (
        <p className="form-error">지금은 앱 예약을 받지 않고 있어요. 매장에 전화로 문의해 주세요.</p>
      ) : (
        <ReserveForm
          kakaoId={data.kakaoId} storeName={data.name} settings={data.settings} hours={data.hours} closures={data.closures}
          today={kstParts(new Date()).date} corkage={data.kind === "restaurant" ? data.info?.corkage ?? null : "hide"} corkageNote={data.info?.corkageNote ?? ""}
          reserveLabel={PARTNER_RESERVATION_LABEL[data.kind]}
          food={food ? { id: food.id, name: food.name } : null} drink={drink ? { id: drink.id, name: drink.name } : null}
        />
      )}
    </div>
  );
}
