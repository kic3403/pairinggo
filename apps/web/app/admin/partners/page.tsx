/** 어드민 — 파트너 식당: 가입 신청 승인·반려, 정지·재개. 승인 뒤 예약 받기는 사장님이 파트너 앱에서 켠다 */
import { requireAdmin } from "@/lib/admin-auth";
import { listMerchants } from "@/lib/partners-admin";
import PartnerActions from "./PartnerActions";
import { formatBizNo, formatMobile, MERCHANT_STATUS_LABEL } from "@pairinggo/shared";

export const dynamic = "force-dynamic";

export default async function AdminPartnersPage() {
  await requireAdmin();
  const rows = await listMerchants();
  const order = { applied: 0, suspended: 1, approved: 2, rejected: 3 } as const;
  rows.sort((a, b) => order[a.status] - order[b.status] || b.createdAt.localeCompare(a.createdAt));
  const waiting = rows.filter((r) => r.status === "applied").length;
  return (
    <>
      <h2 style={{ margin: "0 0 8px" }}>파트너 식당 <span className="muted">승인 대기 {waiting} · 전체 {rows.length}</span></h2>
      <p className="muted" style={{ marginBottom: 10 }}>
        승인 전에 <b>사업자등록번호 진위·휴폐업</b>(국세청 홈택스 사업자 상태 조회)과 매장 대표 번호로 신청자가 실제 운영자인지 확인해 주세요.
        승인해도 예약 받기는 꺼진 채로 시작하고, 사장님이 파트너 앱에서 영업시간·정원을 정한 뒤 켭니다. 정지하면 예약 받기가 꺼지고 새 예약이 막혀요(잡힌 예약은 그대로).
      </p>
      {rows.length === 0 ? <div className="card muted">아직 신청이 없어요.</div> : rows.map((m) => (
        <div className="card" key={m.id}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <b style={{ fontSize: 16 }}>{m.name}</b>
            <span className="tag">{MERCHANT_STATUS_LABEL[m.status]}{m.status === "approved" ? (m.accepting ? " · 예약 받는 중" : " · 예약 꺼짐") : ""}</span>
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            {m.address || "주소 없음"}{m.phone ? ` · 매장 ${m.phone}` : ""}
            {m.placeUrl ? <> · <a href={m.placeUrl} target="_blank" rel="noreferrer">카카오맵</a></> : null}
          </div>
          <div style={{ fontSize: 13.5, marginTop: 6 }}>
            대표자 {m.ownerName} · 사업자 {formatBizNo(m.bizNo)} · 신청 {m.createdAt.slice(0, 10)}
            {m.members.map((u) => <div key={u.email}>담당 {u.name}({u.role === "owner" ? "대표" : "직원"}) · {formatMobile(u.phone)} · {u.email}</div>)}
          </div>
          {m.rejectReason ? <div style={{ fontSize: 13, marginTop: 4 }}>사유: {m.rejectReason}</div> : null}
          <PartnerActions id={m.id} status={m.status} />
        </div>
      ))}
    </>
  );
}
