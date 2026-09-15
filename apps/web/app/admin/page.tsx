import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { dashboard } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  await requireAdmin();
  const d = await dashboard();
  return (
    <>
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
      </div>
    </>
  );
}
