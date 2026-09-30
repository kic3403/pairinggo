/**
 * 어드민 대시보드 — 고른 기간의 지표(바로 앞 같은 길이 기간과 비교)와 회원 구성(성별·나이대·사는 곳).
 * 2026-10-01 사용자 요청: 1일·7일·30일 탭 + 날짜 직접 선택(?p= 또는 ?from=&to=, 규칙은 shared ops-metrics opsPeriod).
 */
import Link from "next/link";
import { AGE_BANDS, METRIC_LABEL, METRIC_ORDER, OPS_PRESETS, deltaText, josa, kstToday, pct, type Demographics, type OpsPeriod, type WeeklyMetrics } from "@pairinggo/shared";

const tone = (cur: number, prev: number) => (cur > prev ? "up" : cur < prev ? "down" : "");
const kstDay = (iso: string) => new Date(Date.parse(iso) + 9 * 3600_000).toISOString().slice(0, 10);

function Bars({ rows, total }: { rows: { label: string; n: number }[]; total: number }) {
  return (
    <ul className="dist">
      {rows.map((r) => (
        <li key={r.label}><span className="dl">{r.label}</span><span className="bar"><i style={{ width: `${pct(r.n, total)}%` }} /></span><span className="dn">{r.n} <small>({pct(r.n, total)}%)</small></span></li>
      ))}
    </ul>
  );
}

export default function OpsPanel({ metrics: m, demo: d, period }: { metrics: WeeklyMetrics; demo: Demographics; period: OpsPeriod }) {
  const prevName = period.prevName;
  const today = kstToday();
  // 직접 선택 칸 기본값 — 지금 보고 있는 기간
  const fromVal = period.from ?? kstDay(period.since), toVal = period.to ?? (period.key === "yesterday" ? kstDay(period.since) : today);
  return (
    <>
      <div className="card">
        <div className="ops-head">
          <b>{period.label} <span className="muted" style={{ fontWeight: 400 }}>{period.key === "custom" ? `${period.days}일` : period.key === "today" || period.key === "yesterday" ? kstDay(period.since).slice(5).replace("-", ".") : `${kstDay(period.since).slice(5).replace("-", ".")} ~ ${kstDay(period.until).slice(5).replace("-", ".")}`} · {josa(prevName, "과/와")} 비교</span></b>
          <div className="ops-period">
            <nav className="seg" aria-label="기간">
              {OPS_PRESETS.map((p) => <Link key={p.key} href={`/admin?p=${p.key}`} className={period.key === p.key ? "on" : undefined} aria-current={period.key === p.key ? "true" : undefined}>{p.label}</Link>)}
            </nav>
            {/* 날짜 범위 — 누르면 달력 두 칸이 펼쳐진다(2026-10-01 사용자 요청). 지금 직접 고른 기간이면 펼친 채로 */}
            <details className="range-pick" open={period.key === "custom" || undefined}>
              <summary className={period.key === "custom" ? "on" : undefined}>📅 날짜 범위{period.key === "custom" ? ` · ${period.label}` : ""}</summary>
              <form method="get" action="/admin" className="range" aria-label="기간 직접 선택">
                <input type="date" name="from" defaultValue={fromVal} max={today} aria-label="시작일" required />
                <span className="muted">~</span>
                <input type="date" name="to" defaultValue={toVal} max={today} aria-label="종료일" required />
                <button className="btn sm p" type="submit">적용</button>
              </form>
            </details>
          </div>
        </div>
        <div className="kpi kpi4" style={{ marginBottom: 0 }}>
          {METRIC_ORDER.map((k) => (
            <div key={k}><b>{m.cur[k].toLocaleString("ko-KR")}</b><span>{METRIC_LABEL[k]} · <em className={`delta ${tone(m.cur[k], m.prev[k])}`}>{deltaText(m.cur[k], m.prev[k])}</em> ({prevName} {m.prev[k].toLocaleString("ko-KR")})</span></div>
          ))}
        </div>
        <p className="muted" style={{ margin: "8px 0 0" }}>방문(세션)은 브라우저 탭마다 하나. 날짜는 한국 시간, 직접 선택은 시작일·종료일을 모두 포함(최대 366일). 10분마다 갱신. 월요일 09:30에 최근 7일 내용이 운영 리포트 이메일로 갑니다.</p>
      </div>
      <div className="card">
        <b>회원 구성 <span className="muted" style={{ fontWeight: 400 }}>{d.total}명 · 가입 때 적은 성별·생년월일·시도 · 기간과 무관한 전체</span></b>
        <div className="grid3" style={{ marginTop: 8 }}>
          <div><div className="muted" style={{ marginBottom: 4 }}>성별</div><Bars total={d.total} rows={[{ label: "남", n: d.gender.m }, { label: "여", n: d.gender.f }, { label: "미입력", n: d.gender["?"] }]} /></div>
          <div><div className="muted" style={{ marginBottom: 4 }}>나이대</div><Bars total={d.total} rows={AGE_BANDS.map((b) => ({ label: b, n: d.age[b] ?? 0 }))} /></div>
          <div><div className="muted" style={{ marginBottom: 4 }}>사는 곳</div><Bars total={d.total} rows={d.sido.slice(0, 8).map((s) => ({ label: s.name, n: s.n }))} />{d.sido.length > 8 && <div className="muted small">외 {d.sido.length - 8}곳</div>}</div>
        </div>
      </div>
    </>
  );
}
