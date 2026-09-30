/**
 * 어드민 대시보드 — 최근 7일 지표(전주 대비)와 회원 구성(성별·나이대·사는 곳). 2026-10-01 사용자 요청.
 * 숫자는 lib/ops-metrics(10분 기억), 표시 규칙은 shared ops-metrics.
 */
import { AGE_BANDS, METRIC_LABEL, METRIC_ORDER, deltaText, pct, type Demographics, type WeeklyMetrics } from "@pairinggo/shared";

const tone = (cur: number, prev: number) => (cur > prev ? "up" : cur < prev ? "down" : "");

function Bars({ rows, total }: { rows: { label: string; n: number }[]; total: number }) {
  return (
    <ul className="dist">
      {rows.map((r) => (
        <li key={r.label}><span className="dl">{r.label}</span><span className="bar"><i style={{ width: `${pct(r.n, total)}%` }} /></span><span className="dn">{r.n} <small>({pct(r.n, total)}%)</small></span></li>
      ))}
    </ul>
  );
}

export default function OpsPanel({ metrics: m, demo: d }: { metrics: WeeklyMetrics; demo: Demographics }) {
  const day = (s: string) => s.slice(5, 10).replace("-", ".");
  return (
    <>
      <div className="card">
        <b>최근 7일 <span className="muted" style={{ fontWeight: 400 }}>{day(m.since)} ~ {day(m.until)} · 전주와 비교 · 10분마다 갱신</span></b>
        <div className="kpi kpi4" style={{ marginBottom: 0 }}>
          {METRIC_ORDER.map((k) => (
            <div key={k}><b>{m.cur[k].toLocaleString("ko-KR")}</b><span>{METRIC_LABEL[k]} · <em className={`delta ${tone(m.cur[k], m.prev[k])}`}>{deltaText(m.cur[k], m.prev[k])}</em> (전주 {m.prev[k].toLocaleString("ko-KR")})</span></div>
          ))}
        </div>
        <p className="muted" style={{ margin: "8px 0 0" }}>방문(세션)은 브라우저 탭마다 하나. 월요일 09:30에 같은 내용이 운영 리포트 이메일로 갑니다(REPORT_EMAIL_TO · RESEND_API_KEY 설정 시).</p>
      </div>
      <div className="card">
        <b>회원 구성 <span className="muted" style={{ fontWeight: 400 }}>{d.total}명 · 가입 때 적은 성별·생년월일·시도</span></b>
        <div className="grid3" style={{ marginTop: 8 }}>
          <div><div className="muted" style={{ marginBottom: 4 }}>성별</div><Bars total={d.total} rows={[{ label: "남", n: d.gender.m }, { label: "여", n: d.gender.f }, { label: "미입력", n: d.gender["?"] }]} /></div>
          <div><div className="muted" style={{ marginBottom: 4 }}>나이대</div><Bars total={d.total} rows={AGE_BANDS.map((b) => ({ label: b, n: d.age[b] ?? 0 }))} /></div>
          <div><div className="muted" style={{ marginBottom: 4 }}>사는 곳</div><Bars total={d.total} rows={d.sido.slice(0, 8).map((s) => ({ label: s.name, n: s.n }))} />{d.sido.length > 8 && <div className="muted small">외 {d.sido.length - 8}곳</div>}</div>
        </div>
      </div>
    </>
  );
}
