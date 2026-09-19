/** 어드민 — 운영 오류(2026-09-19): 서버·화면에서 난 오류를 묶어 횟수·마지막 시각으로. 같은 오류가 다시 나면 미해결로 돌아온다 */
import { recentErrors } from "@pairinggo/server/errors";
import { requireAdmin } from "@/lib/admin-auth";
import Resolve from "./Resolve";

export const dynamic = "force-dynamic";
const APP: Record<string, string> = { web: "페어링GO 서버", partner: "파트너 서버", "web-client": "페어링GO 화면", "partner-client": "파트너 화면" };
const kst = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(5, 16).replace("T", " ");

export default async function AdminErrors() {
  await requireAdmin();
  const rows = await recentErrors(150);
  const open = rows.filter((r) => !r.resolvedAt);
  return (
    <>
      <h2 style={{ margin: "0 0 8px" }}>운영 오류 <span className="muted">미해결 {open.length} · 전체 {rows.length}</span></h2>
      <p className="muted" style={{ marginBottom: 10 }}>
        처리 못 한 서버 오류와 주요 실패(예약 저장·알림·크론·문자·식당 검색)가 모입니다. 같은 오류는 한 줄로 묶고 횟수를 셉니다. 원인을 고쳤으면 “해결” — 다시 나면 자동으로 미해결로 돌아와요.
        번호·이메일은 가려서 저장합니다. 시각은 한국 시간.
      </p>
      {rows.length === 0 ? <div className="card muted">기록된 오류가 없어요.</div> : rows.map((r) => (
        <div className="card" key={r.id} style={r.resolvedAt ? { opacity: 0.55 } : undefined}>
          <div className="row" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
            <b style={{ fontSize: 14.5 }}>{r.place}</b>
            <span className="tag">{APP[r.app] ?? r.app} · {r.count}회</span>
          </div>
          <div style={{ fontSize: 13.5, marginTop: 4, wordBreak: "break-all" }}>{r.message}</div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
            처음 {kst(r.firstAt)} · 마지막 {kst(r.lastAt)}{r.resolvedAt ? ` · 해결 ${kst(r.resolvedAt)}` : ""}
            {r.sample?.path ? ` · ${String(r.sample.method ?? "")} ${String(r.sample.path)}` : ""}
          </div>
          {r.sample?.stack ? <details style={{ marginTop: 6 }}><summary className="muted" style={{ fontSize: 12.5, cursor: "pointer" }}>스택</summary><pre style={{ fontSize: 11.5, whiteSpace: "pre-wrap", margin: "6px 0 0" }}>{String(r.sample.stack)}</pre></details> : null}
          {!r.resolvedAt ? <div style={{ marginTop: 8 }}><Resolve id={r.id} /></div> : null}
        </div>
      ))}
    </>
  );
}
