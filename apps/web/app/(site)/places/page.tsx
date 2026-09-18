/** 식당 찾기(2026-09-19) — 식당 이름·키워드 검색. 파트너 매장은 메뉴판·[예약하기]가 붙는다 */
import type { Metadata } from "next";
import PlaceSearch from "../_components/PlaceSearch";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "식당 찾기 | 페어링GO", description: "식당 이름이나 동네·메뉴로 찾고, 페어링GO 파트너 매장은 메뉴판을 보고 바로 예약하세요.", robots: { index: false } };

export default async function PlacesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q || "").trim().slice(0, 40);
  return (
    <div className="wrap">
      <h1>식당 찾기</h1>
      <p className="lead">식당 이름이나 동네·메뉴로 찾아보세요. 페어링GO가 확인한 매장은 콜키지·룸·메뉴판이 함께 보이고, 파트너 매장은 바로 예약할 수 있어요.</p>
      <PlaceSearch key={q} initialQuery={q} />
    </div>
  );
}
