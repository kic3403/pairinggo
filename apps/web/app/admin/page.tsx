import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { dashboard } from "@/lib/admin-data";
import { openErrorCount } from "@pairinggo/server/errors";
import { aiStatus } from "@pairinggo/server/ai-guard";
import { db } from "@/lib/db";
import { pendingExpertCount } from "@/lib/experts";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  await requireAdmin();
  // 카카오맵에 아직 안 이어진 직접 입력 매장 — 연결 전에는 검색·예약에 안 나온다(2026-09-27 사용자 제보: 파트너가 매장 정보를 넣었는데 검색에 없음)
  const unlinked = async () => { const sb = db(); if (!sb) return 0; const { count } = await sb.from("merchants").select("id", { count: "exact", head: true }).eq("status", "approved").like("kakao_place_id", "manual-%"); return count ?? 0; };
  const [d, errors, manual, ai, experts] = await Promise.all([dashboard(), openErrorCount(), unlinked().catch(() => 0), aiStatus(true).catch(() => ({ downAt: null, feature: null })), pendingExpertCount().catch(() => 0)]);
  return (
    <>
      {ai.downAt && <div className="card" style={{ borderColor: "#c0362c", marginBottom: 12 }}><b style={{ color: "#c0362c" }}>AI 크레딧 소진 — 메뉴판·라벨·영수증 사진 읽기가 멈췄어요</b> <span className="muted">({new Date(ai.downAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}, {ai.feature})</span><div className="muted" style={{ marginTop: 4 }}>Anthropic 콘솔(console.anthropic.com) → Settings → Billing에서 충전하세요. 충전 뒤 30분 안에 다음 사용 때 저절로 다시 시도하고, 되면 이 경고가 사라집니다.</div></div>}
      {errors > 0 && <div className="card" style={{ borderColor: "#c0362c", marginBottom: 12 }}><b style={{ color: "#c0362c" }}>최근 24시간 운영 오류 {errors}건</b> <Link href="/admin/errors">확인하기 →</Link></div>}
      {experts > 0 && <div className="card" style={{ borderColor: "#2F6B3A", marginBottom: 12 }}><b style={{ color: "#2F6B3A" }}>전문가 등급 요청 {experts}건 심사 대기</b> — 증빙을 확인하고 승인해 주세요. <Link href="/admin/experts?status=applied">심사하기 →</Link></div>}
      {manual > 0 && <div className="card" style={{ borderColor: "#B8860B", marginBottom: 12 }}><b style={{ color: "#8a6508" }}>카카오맵에 연결 안 된 직접 입력 매장 {manual}곳</b> — 연결 전에는 페어링GO 검색·예약에 나오지 않아요. <Link href="/admin/partners">카카오맵 장소 연결 →</Link></div>}
      <h2 style={{ margin: "0 0 4px" }}>대시보드</h2>
      <p className="muted">카탈로그 버전 <code>{d.version.slice(0, 19)}</code> · 페어링 {d.totalPairings} · 발행 후 승격 {d.promotedAfter}건 {d.promotedAfter > 0 && <Link href="/admin/publish">→ 발행하기</Link>}</p>
      <div className="kpi">
        <div><b>{d.byStatus.draft || 0}</b><span>검수 대기</span></div>
        <div><b>{d.byStatus.needs_entity || 0}</b><span>술·음식 지정 필요</span></div>
        <div><b>{d.byStatus.promoted || 0}</b><span>승격됨 · 거절 {d.byStatus.rejected || 0}</span></div>
      </div>
      <div className="row" style={{ marginBottom: 16 }}>
        <Link className="btn p" href="/admin/review">검수 시작 (근거 빈칸 우선) →</Link>
        <Link className="btn" href="/admin/review?view=all">전체 후보 (언급 많은 순)</Link>
        <Link className="btn" href="/admin/review?status=needs_entity">지정 필요 보기</Link>
      </div>

      <div className="card">
        <b>수집 우선순위 — 페어링 5개 미만인 술 ({d.low.length})</b>
        <p className="muted">술마다 최소 5개를 유지합니다. 이 술부터 엑셀·수집으로 채우세요.</p>
        <div className="row">{d.low.slice(0, 30).map((x) => <span key={x.id} className="tag m">{x.name} {x.n}</span>)}{d.low.length > 30 && <span className="muted">외 {d.low.length - 30}</span>}</div>
        {d.noPair.length > 0 && <p className="muted" style={{ marginTop: 8 }}>페어링이 없는 음식: {d.noPair.join(", ")}</p>}
      </div>

      <div className="card">
        <b>사용자가 찾았는데 없던 검색어 (최근 30일 상위)</b>
        <p className="muted">카탈로그 확장 후보입니다. 크론 집계(popular_terms) 기준.</p>
        {d.empties.length ? <div className="row">{d.empties.map((e) => <span key={e.term} className="tag w">{e.term} {e.count}</span>)}</div> : <p className="muted">아직 없음</p>}
        <p style={{ marginTop: 8 }}><Link href="/admin/wanted">없는 술 요청 모아 보기 (메뉴판·회원픽 포함) →</Link></p>
        <p style={{ marginTop: 4 }}><Link href="/admin/banners">홈 배너 — 이벤트·이달의 파트너·상시 안내 →</Link></p>
        <p style={{ marginTop: 4 }}><Link href="/admin/drinks?missing=price">술 정보 — 주종·규격·참고가격 입력(가격 없는 술부터) →</Link></p>
        <p style={{ marginTop: 4 }}><Link href="/admin/foods?missing=1">음식 사진 — 상세 머리 카드·검색 썸네일(사진 없는 음식부터) →</Link></p>
        <p style={{ marginTop: 4 }}><Link href="/admin/drink-reviews">술 평가 — 회원 별점·한 줄 검토(숨김·삭제) →</Link></p>
        <p style={{ marginTop: 4 }}><Link href="/admin/notices">공지 — 헤더 알림 버튼에 보이는 글 →</Link></p>
      </div>
    </>
  );
}
