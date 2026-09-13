/** 월간 트렌드 리포트 — 우리 데이터 한 장(docs/19 A2). 최근 30일. 글로 복사해 블로그·인스타에 올린다. */
import type { Metadata } from "next";
import Link from "next/link";
import { toSlug } from "@pairinggo/shared";
import { getCatalog } from "@/lib/catalog";
import { buildReport, reportText } from "@/lib/report";
import CopyButton from "../_components/CopyButton";

export const revalidate = 3600;
export const metadata: Metadata = { title: "월간 전통주 트렌드 리포트 | 페어링GO", description: "요즘 많이 찾는 전통주, 핫한 페어링, 회원 평가와 검색어를 한 장으로 정리한 월간 리포트입니다." };

const fmt = (s: string) => s.slice(5).replace("-", "/");

export default async function ReportPage() {
  const c = await getCatalog();
  const r = await buildReport(c.dataset);
  const text = reportText(r);
  const dl = (b: { kind: string; label: string } | null) => (b ? <span className={`dl ${b.kind}`}>{b.label}</span> : null);
  return (
    <div className="wrap">
      <p className="crumb"><Link href="/">홈</Link></p>
      <h1>{r.month}월 전통주 트렌드 리포트 <span className="muted">· {fmt(r.from)}~{fmt(r.to)}</span></h1>
      <p className="lead">페어링GO에 쌓인 언급량·검색·회원 활동으로 매달 만드는 한 장입니다. 매시간 새로 계산합니다.</p>
      <div className="rp-kpi">
        <span><b>{r.activity.members}</b>회원</span><span><b>{r.activity.screens.toLocaleString("ko-KR")}</b>화면 조회</span><span><b>{r.activity.searches}</b>검색</span>
        <span><b>{r.activity.buyClicks}</b>구매 링크</span><span><b>{r.activity.restaurantClicks}</b>식당 링크</span><span><b>{r.activity.saves}</b>저장</span><span><b>{r.ratingsTotal}</b>먹어봤어요</span>
      </div>
      <div className="btns" style={{ marginTop: 6 }}><CopyButton text={text} label="글로 복사 (블로그·인스타용)" /></div>

      <div className="rp-grid">
        <section className="rp-sec">
          <h2>요즘 많이 찾는 전통주 TOP 10</h2>
          <p className="small muted" style={{ margin: "0 0 8px" }}>인스타·유튜브·네이버 블로그·구글 블로그 최근 30일 언급량{r.compared ? " · ▲▼는 지난주 순위 대비" : ""}</p>
          {r.top.length ? <ol>{r.top.map((d) => <li key={d.id}><Link href={`/drinks/${toSlug(d.name)}`}>{d.name}</Link> <span className="muted small">{d.category} · {d.region}</span>{dl(d.badge)}</li>)}</ol> : <p className="muted">아직 순위가 없어요.</p>}
        </section>
        <section className="rp-sec">
          <h2>핫한 페어링</h2>
          <p className="small muted" style={{ margin: "0 0 8px" }}>{r.hot[0]?.fromLogs ? "회원이 카드를 누르고 저장하고 구매·식당 링크를 연 조합" : "아직 기록이 적어 근거 점수 순으로 채웠어요"}</p>
          {r.hot.length ? <ol>{r.hot.map((h) => <li key={`${h.d}|${h.f}`}><Link href={`/drinks/${toSlug(h.drink)}`}>{h.drink}</Link> × <Link href={`/foods/${toSlug(h.food)}`}>{h.food}</Link>{h.fromLogs && <span className="muted small"> · 탭 {h.taps} 저장 {h.saves} 구매 {h.buys}</span>}</li>)}</ol> : <p className="muted">아직 없어요.</p>}
        </section>
        <section className="rp-sec">
          <h2>먹어봤어요 — 회원 평가</h2>
          <p className="small muted" style={{ margin: "0 0 8px" }}>3명 이상 평가한 조합, 어울렸다 비율 순</p>
          {r.rated.length ? <ol>{r.rated.map((x) => <li key={`${x.d}|${x.f}`}>{x.drink} × {x.food} <span className="muted small">— {x.text}</span></li>)}</ol> : <p className="muted">아직 3명 이상 평가한 조합이 없어요. 술·음식 화면에서 먹어본 조합을 평가해 주세요.</p>}
        </section>
        <section className="rp-sec">
          <h2>회원 추천 <span className="muted small">하트 많은 순</span></h2>
          {r.picks.length ? <ol>{r.picks.map((p, i) => <li key={i}>{p.drink} × {p.food} <span className="muted small">♥{p.n}{p.note ? ` — “${p.note.slice(0, 40)}” ${p.nick}` : ""}</span></li>)}</ol> : <p className="muted">아직 공개된 회원 추천이 없어요. <Link href="/picks">추천 남기기 →</Link></p>}
        </section>
        <section className="rp-sec">
          <h2>많이 찾은 검색어</h2>
          {r.terms.length ? <ol>{r.terms.map((t) => <li key={t.q}>{t.q} <span className="muted small">{t.n}회</span></li>)}</ol> : <p className="muted">아직 검색 기록이 없어요.</p>}
        </section>
        <section className="rp-sec">
          <h2>지역별 둘러보기</h2>
          {r.regions.length ? <ol>{r.regions.map((x) => <li key={x.region}>{x.region} <span className="muted small">{x.n}회</span></li>)}</ol> : <p className="muted">아직 지역 둘러보기 기록이 없어요.</p>}
        </section>
      </div>
      <p className="small muted" style={{ marginTop: 14 }}>순위·언급량은 공개 게시물 수를 센 값이고 판매량이 아닙니다. 회원 평가·추천은 페어링GO 회원의 기록입니다.</p>
    </div>
  );
}
