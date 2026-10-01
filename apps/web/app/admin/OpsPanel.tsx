/**
 * 어드민 대시보드 — 고른 기간의 지표(바로 앞 같은 길이 기간과 비교)와 회원 구성(성별·나이대·사는 곳).
 * 2026-10-01 사용자 요청: 1일·7일·30일 탭 + 날짜 직접 선택(?p= 또는 ?from=&to=, 규칙은 shared ops-metrics opsPeriod).
 */
import Link from "next/link";
import { AGE_BANDS, METRIC_LABEL, METRIC_ORDER, OPS_PRESETS, deltaText, josa, kstToday, pct, stepRate, type Demographics, type OpsFunnel, type OpsPeriod, type WeeklyMetrics } from "@pairinggo/shared";

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

export default function OpsPanel({ metrics: m, demo: d, period, funnel: f }: { metrics: WeeklyMetrics; demo: Demographics; period: OpsPeriod; funnel: OpsFunnel }) {
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
      {/* 방문 흐름(2026-10-02) — 방문 → 상세 → 행동을 세션 수로. 유입용 기능(비로그인 저장·그림 카드·모음 화면)의 효과를 본다 */}
      <div className="card">
        <b>방문 흐름 <span className="muted" style={{ fontWeight: 400 }}>{period.label} · 세션(브라우저 탭) 기준 — 한 사람이 여러 번 눌러도 한 번</span></b>
        <ol className="funnel">
          <li><span className="fl">방문</span><span className="bar"><i style={{ width: "100%" }} /></span><span className="fn"><b>{f.sessions.toLocaleString("ko-KR")}</b></span></li>
          <li><span className="fl">술·음식 상세를 봄</span><span className="bar"><i style={{ width: `${pct(f.detailSessions, f.sessions)}%` }} /></span><span className="fn"><b>{f.detailSessions.toLocaleString("ko-KR")}</b> <small>방문의 {stepRate(f.detailSessions, f.sessions)}</small></span></li>
          <li><span className="fl">저장·구매·식당·공유</span><span className="bar"><i style={{ width: `${pct(f.actionSessions, f.sessions)}%` }} /></span><span className="fn"><b>{f.actionSessions.toLocaleString("ko-KR")}</b> <small>상세 본 세션의 {stepRate(f.actionSessions, f.detailSessions)}</small></span></li>
        </ol>
        <div className="kpi kpi4" style={{ margin: "10px 0 0" }}>
          <div><b>{f.saves}</b><span>저장 · 그중 비로그인(기기) <em>{f.guestSaves}</em></span></div>
          <div><b>{f.buyClicks}</b><span>구매 링크 클릭</span></div>
          <div><b>{f.restaurantClicks}</b><span>식당 링크 클릭</span></div>
          <div><b>{f.shares}</b><span>공유 · 그중 그림 카드 저장 <em>{f.cardSaves}</em></span></div>
          <div><b>{f.guideViews}</b><span>모음 화면(/guide) 조회</span></div>
          <div><b>{f.todayViews}</b><span>오늘의 페어링 조회</span></div>
        </div>
        {f.topDetails.length > 0 && (
          <p className="muted" style={{ margin: "10px 0 0" }}>많이 본 상세 — {f.topDetails.map((t, i) => <span key={t.path}>{i > 0 && " · "}<Link href={t.path}>{t.path.replace(/^\/(drinks|foods)\//, "").replace(/-/g, " ")}</Link> {t.n}</span>)}</p>
        )}
        {f.sources.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div className="muted" style={{ marginBottom: 4 }}>유입 경로 <small>— 방문 세션이 어디서 들어왔나(직전 주소·공유 링크 표시·앱 안 브라우저로 판정)</small></div>
            <Bars total={f.sessions} rows={f.sources.slice(0, 8).map((s) => ({ label: s.label, n: s.n }))} />
            {f.sources.length > 8 && <div className="muted small">외 {f.sources.length - 8}곳</div>}
          </div>
        )}
        <p className="muted" style={{ margin: "8px 0 0" }}>'직접·알 수 없음'은 주소를 직접 치거나 즐겨찾기·앱에서 연 방문, 그리고 직전 주소를 안 넘겨 주는 앱(문자·일부 메신저)에서 온 방문입니다. 행동 단계의 비율은 '상세를 본 세션' 대비입니다(목록·검색에서 바로 저장한 세션도 행동에 들어가 100%를 넘을 수 있어요).</p>
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
