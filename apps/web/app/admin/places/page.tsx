/** 어드민 — 식당 정보: 운영자가 직접 확인한 주차·콜키지·룸·취급 전통주·대표 메뉴를 적는다. 저장하면 공개 식당 목록의 그 식당 카드에 바로 보인다. */
import { requireAdmin } from "@/lib/admin-auth";
import { getCatalog } from "@/lib/catalog";
import { listPlaceInfo } from "@/lib/place-info";
import { menuReadConfigured } from "@/lib/menu-read";
import { byKoName } from "@pairinggo/shared";
import PlaceEditor from "./PlaceEditor";

export const dynamic = "force-dynamic";

export default async function AdminPlacesPage() {
  await requireAdmin();
  const [c, rows] = await Promise.all([getCatalog(), listPlaceInfo()]);
  return (
    <>
      <h2 style={{ margin: "0 0 8px" }}>식당 정보 <span className="muted">{rows.length}곳 입력됨</span></h2>
      <p className="muted" style={{ marginBottom: 10 }}>
        전화·방문으로 <b>직접 확인한 것만</b> 적어 주세요. 저장하면 음식 상세의 “맛집 찾기” 목록에서 그 식당이 맨 위로 올라오고(식당 목록은 10분 단위로 캐시되어 최대 10분 걸립니다), 이름 옆에 콜키지·룸·주차 칩과 취급 전통주가 보입니다.
        네이버 지도·캐치테이블 화면의 내용을 옮겨 적지 않습니다(약관). 모르는 항목은 “모름”으로 두면 표시되지 않아요.
      </p>
      <PlaceEditor rows={rows} menuReadEnabled={menuReadConfigured()}drinks={[...c.dataset.drinks].sort(byKoName).map((d) => ({ id: d.id, name: d.name }))} foods={[...c.dataset.foods].sort(byKoName).map((f) => ({ id: f.id, name: f.name }))} />
    </>
  );
}
