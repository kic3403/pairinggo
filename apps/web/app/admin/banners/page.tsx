/** 어드민 — 홈 배너(2026-09-25): 이벤트(기간)·이달의 파트너(매장 고르기)·상시 안내 카드를 만들고 순서·기간·켜기를 관리한다. 저장하면 홈에 바로 반영 */
import { requireAdmin } from "@/lib/admin-auth";
import { kstToday, listBanners, partnerList } from "@/lib/banners";
import BannerEditor from "./BannerEditor";

export const dynamic = "force-dynamic";

export default async function AdminBanners() {
  await requireAdmin();
  const [rows, partners] = await Promise.all([listBanners(), partnerList(60)]);
  return (
    <>
      <h2 style={{ margin: "0 0 8px" }}>홈 배너 <span className="muted">{rows.length}장 · 오늘 {kstToday()}</span></h2>
      <p className="muted" style={{ marginBottom: 10 }}>홈 맨 위 카드 캐러셀입니다. <b>트렌드 리포트</b> 카드는 자동으로 맨 앞에 붙고, 여기서 만든 카드가 그 뒤에 sort 순으로 옵니다(기간 밖·꺼진 카드는 안 보임). 카드가 2장 미만이면 상시 안내(회원 추천·파트너 모집)가 자동으로 채워집니다.
        사진은 우리 저장소 주소만(파트너가 올린 매장·술 사진 주소를 그대로 붙여 넣으면 됩니다). 링크는 사이트 안 주소(/…)만.</p>
      <BannerEditor rows={rows} partners={partners.map((p) => ({ id: p.id, name: p.name, kind: p.kind, photo: p.photo }))} today={kstToday()} />
    </>
  );
}
