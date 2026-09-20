/**
 * 어드민 — 파트너: 식당 · 양조장 · 리쿼샵 세 갈래(2026-09-20 사용자 결정)로 나눠 본다.
 * 가입 신청 승인·반려, 정지·재개, 업종 바꾸기. 승인 뒤 예약 받기는 사장님이 파트너 앱에서 켠다(식당만).
 */
import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { listMerchants, summarizeChange } from "@/lib/partners-admin";
import { recentChanges } from "@pairinggo/server/merchant-store";
import PartnerActions from "./PartnerActions";
import ChangeLog from "./ChangeLog";
import {
  cleanPartnerKind, formatBizNo, formatMobile, isManualPlaceId, MERCHANT_STATUS_LABEL,
  PARTNER_KINDS, PARTNER_KIND_HINT, PARTNER_KIND_LABEL, PARTNER_RESERVATION_LABEL,
} from "@pairinggo/shared";

export const dynamic = "force-dynamic";

export default async function AdminPartnersPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  await requireAdmin();
  const [all, changes] = await Promise.all([listMerchants(), recentChanges(60)]);
  const sp = await searchParams;
  const tab = sp.kind && PARTNER_KINDS.includes(sp.kind as never) ? cleanPartnerKind(sp.kind) : null;   // null = 전체
  const order = { applied: 0, suspended: 1, approved: 2, rejected: 3 } as const;
  all.sort((a, b) => order[a.status] - order[b.status] || b.createdAt.localeCompare(a.createdAt));
  const rows = tab ? all.filter((r) => r.kind === tab) : all;
  const count = (k: (typeof PARTNER_KINDS)[number]) => all.filter((r) => r.kind === k).length;
  const waiting = rows.filter((r) => r.status === "applied").length;

  return (
    <>
      <h2 style={{ margin: "0 0 8px" }}>파트너 <span className="muted">승인 대기 {waiting} · {tab ? `${PARTNER_KIND_LABEL[tab]} ${rows.length}` : `전체 ${all.length}`}</span></h2>
      <div className="row" style={{ gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        <Link className={`btn sm${tab === null ? " p" : ""}`} href="/admin/partners">전체 {all.length}</Link>
        {PARTNER_KINDS.map((k) => (
          <Link key={k} className={`btn sm${tab === k ? " p" : ""}`} href={`/admin/partners?kind=${k}`} title={PARTNER_KIND_HINT[k]}>
            {PARTNER_KIND_LABEL[k]} {count(k)}
          </Link>
        ))}
      </div>
      <p className="muted" style={{ marginBottom: 10 }}>
        승인 전에 <b>사업자등록번호 진위·휴폐업</b>(국세청 홈택스 사업자 상태 조회)과 매장 대표 번호로 신청자가 실제 운영자인지 확인해 주세요.
        <b>직접 입력</b> 매장은 주소가 실제로 있는지 확인하고, 카카오맵에 올라와 있으면 <b>카카오맵 장소 연결</b>을 눌러 이어 주세요(연결 전에는 페어링GO 검색·예약에 나오지 않아요).
        업종이 잘못 신청됐으면 <b>업종</b>에서 바꿀 수 있어요 — 예약은 업종과 상관없이 <b>예약 받기를 켠 매장</b>이 받습니다(식당은 자리, 양조장은 방문 시음, 리쿼샵은 방문 픽업).
        승인해도 예약 받기는 꺼진 채로 시작하고, 사장님이 파트너 앱에서 영업시간·정원을 정한 뒤 켭니다. 정지하면 예약 받기가 꺼지고 새 예약이 막혀요(잡힌 예약은 그대로).
      </p>
      {rows.length === 0 ? (
        <div className="card muted">{tab ? `${PARTNER_KIND_LABEL[tab]} 파트너가 아직 없어요.` : "아직 신청이 없어요."}</div>
      ) : rows.map((m) => (
        <div className="card" key={m.id}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <b style={{ fontSize: 16 }}>{m.name}</b>
            <span className="tag w" title={PARTNER_KIND_HINT[m.kind]}>{PARTNER_KIND_LABEL[m.kind]}</span>
            {isManualPlaceId(m.kakaoPlaceId) ? <span className="tag" title="카카오맵 검색에 안 나와 사장님이 직접 입력한 매장 — 연결 전에는 페어링GO 검색·예약에 안 나와요">직접 입력 · 카카오맵 미연결</span> : null}
            <span className="tag">{MERCHANT_STATUS_LABEL[m.status]}{m.status === "approved" ? (m.accepting ? ` · ${PARTNER_RESERVATION_LABEL[m.kind]} 받는 중` : " · 예약 꺼짐") : ""}</span>
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
          <PartnerActions id={m.id} status={m.status} manual={isManualPlaceId(m.kakaoPlaceId)} name={m.name} address={m.address} kind={m.kind} />
        </div>
      ))}
      <h2 style={{ margin: "22px 0 8px" }}>최근 변경 <span className="muted">파트너가 고친 내용은 바로 반영돼요 — 사실과 다르면 되돌리기</span></h2>
      <ChangeLog rows={changes.map((c) => ({ id: c.id, merchantName: c.merchantName, who: c.partnerName ? `파트너 ${c.partnerName}` : "운영자", section: c.section, summary: summarizeChange(c.section, c.before, c.after), createdAt: c.createdAt, revertedAt: c.revertedAt }))} />
    </>
  );
}
