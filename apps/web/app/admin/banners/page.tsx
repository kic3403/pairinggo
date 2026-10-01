/** 어드민 — 홈 배너(2026-09-25): 이벤트(기간)·이달의 파트너(매장 고르기)·상시 안내 카드를 만들고 순서·기간·켜기를 관리한다. 저장하면 홈에 바로 반영 */
import { MONTHLY_PARTNER_KINDS, PARTNER_KIND_LABEL, activeBanners, monthlyPartnerPick } from "@pairinggo/shared";
import { requireAdmin } from "@/lib/admin-auth";
import { kstToday, listBanners, partnerList } from "@/lib/banners";
import BannerEditor from "./BannerEditor";

export const dynamic = "force-dynamic";

export default async function AdminBanners() {
  await requireAdmin();
  const [rows, partners] = await Promise.all([listBanners(), partnerList(60)]);
  const today = kstToday();
  // 이달의 파트너(2026-10-01) — 등록한 카드가 있는 업종은 그 매장, 없으면 달마다 자동으로 한 곳(shared monthlyPartnerPick)
  const byId = new Map(partners.map((p) => [p.id, p]));
  const featured = new Map(activeBanners(rows, today).filter((r) => r.kind === "partner" && r.merchantId && byId.has(r.merchantId)).map((r) => [byId.get(r.merchantId!)!.kind, byId.get(r.merchantId!)!.name]));
  const monthly = MONTHLY_PARTNER_KINDS.map(({ kind }) => ({ kind, registered: featured.get(kind) ?? null, auto: monthlyPartnerPick(partners, kind, today.slice(0, 7))?.name ?? null }));
  return (
    <>
      <h2 style={{ margin: "0 0 8px" }}>홈 배너 <span className="muted">{rows.length}장 · 오늘 {today}</span></h2>
      <p className="muted" style={{ marginBottom: 10 }}>홈 맨 위 카드 캐러셀입니다. <b>트렌드 리포트</b> 카드는 자동으로 맨 앞에 붙고, 여기서 만든 카드가 그 뒤에 sort 순으로 옵니다(기간 밖·꺼진 카드는 안 보임). 카드가 2장 미만이면 상시 안내(회원 추천·파트너 모집)가 자동으로 채워집니다.
        사진은 우리 저장소 주소만(파트너가 올린 매장·술 사진 주소를 그대로 붙여 넣으면 됩니다). 링크는 사이트 안 주소(/…)만.</p>
      <div className="card" style={{ marginBottom: 12 }}>
        <b>이달의 파트너 <span className="muted" style={{ fontWeight: 400 }}>{Number(today.slice(5, 7))}월</span></b>
        <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
          {monthly.map((m) => (
            <li key={m.kind}>
              {PARTNER_KIND_LABEL[m.kind]} — {m.registered ? <><b>{m.registered}</b> <span className="muted">(등록한 카드)</span></> : m.auto ? <><b>{m.auto}</b> <span className="muted">(자동 · 순번제, 매월 1일에 다음 매장)</span></> : <span className="muted">승인된 파트너가 없어 카드 없음</span>}
            </li>
          ))}
        </ul>
        <p className="muted" style={{ margin: "6px 0 0" }}>이벤트·협업이 있으면 아래에서 종류 <b>이달의 파트너</b>로 매장을 골라 기간과 함께 등록하세요 — 그 업종은 등록한 매장이 뜨고, 기간이 끝나면 다시 자동 선정으로 돌아갑니다. 자동 선정은 승인된 파트너가 한 달씩 차례로 돌아가며, 대표 사진이 없는 매장은 색 카드로 보입니다.</p>
      </div>
      <BannerEditor rows={rows} partners={partners.map((p) => ({ id: p.id, name: p.name, kind: p.kind, photo: p.photo }))} today={today} />
    </>
  );
}
