/**
 * 월간 트렌드 리포트 — 우리 데이터로 만드는 한 장(docs/19 A2). 최근 30일 기준, 매달 홈 카드와 /report에서 보인다.
 * 항목: 많이 찾는 전통주 순위(+지난주 대비), 핫한 페어링, 회원 먹어봤어요 결과, 회원 추천 공개 조합, 검색어·지역 검색, 활동 수.
 * 글로 옮길 수 있게 텍스트판(toText)도 만든다 — 블로그·인스타·모두의 창업 제출 자료.
 */
import { D, F, MIN_N, deltaBadge, summarizeRatings, wilsonLower, type Dataset, type RatingCounts } from "@pairinggo/shared";
import { db } from "./db";
import { hotPairs } from "./hot";
import { listPosts } from "./member-picks";
import { topDrinks } from "./popular";

export type Report = {
  month: number; from: string; to: string; generatedAt: string;
  top: { id: string; name: string; category: string; region: string; badge: { kind: string; label: string } | null }[];
  compared: boolean;
  hot: { d: string; f: string; drink: string; food: string; taps: number; saves: number; buys: number; fromLogs: boolean }[];
  rated: { d: string; f: string; drink: string; food: string; n: number; goodPct: number; text: string }[];
  ratingsTotal: number;
  picks: { d: string; f: string; drink: string; food: string; n: number; nick: string; note: string }[];
  terms: { q: string; n: number }[];
  regions: { region: string; n: number }[];
  activity: { screens: number; searches: number; buyClicks: number; restaurantClicks: number; saves: number; members: number };
};

const kst = (ms: number) => new Date(ms + 9 * 3600 * 1000).toISOString().slice(0, 10);

export async function buildReport(ds: Dataset, days = 30): Promise<Report> {
  const now = Date.now();
  const sinceIso = new Date(now - days * 86400000).toISOString();
  const sb = db();
  const t = topDrinks(ds, 10);
  const top = t.list.map((d) => ({ id: d.id, name: d.name, category: d.category, region: d.region || "", badge: deltaBadge(d.trend, t.compared) }));

  const hp = await hotPairs(ds, 8, days);
  const hot = hp.list.map((h) => ({ d: h.pairing.d, f: h.pairing.f, drink: D[h.pairing.d]?.name ?? h.pairing.d, food: F[h.pairing.f]?.name ?? h.pairing.f, taps: h.taps, saves: h.saves, buys: h.buys, fromLogs: h.fromLogs }));

  // 먹어봤어요 — 3명 이상 평가된 조합, 윌슨 하한 순
  let rated: Report["rated"] = [], ratingsTotal = 0;
  const activity = { screens: 0, searches: 0, buyClicks: 0, restaurantClicks: 0, saves: 0, members: 0 };
  let terms: Report["terms"] = [], regions: Report["regions"] = [];
  if (sb) {
    const { data: rr } = await sb.from("pairing_ratings").select("drink_id,food_id,rating").limit(20000);
    const agg = new Map<string, RatingCounts>();
    for (const r of (rr ?? []) as { drink_id: string; food_id: string; rating: "good" | "ok" | "bad" }[]) {
      const k = `${r.drink_id}|${r.food_id}`; const c = agg.get(k) ?? { good: 0, ok: 0, bad: 0 }; c[r.rating]++; agg.set(k, c); ratingsTotal++;
    }
    rated = [...agg.entries()].map(([k, c]) => { const [d, f] = k.split("|"); const s = summarizeRatings(c); return { d, f, drink: D[d]?.name ?? d, food: F[f]?.name ?? f, n: s.n, goodPct: s.goodPct ?? 0, text: s.text, lower: wilsonLower(c.good, s.n) }; })
      .filter((x) => x.n >= MIN_N).sort((a, b) => b.lower - a.lower).slice(0, 8).map(({ lower: _l, ...x }) => x);

    // 검색어·지역 — search_logs(기간 안). 지역 둘러보기는 matched_type 'browse'
    const { data: sl } = await sb.from("search_logs").select("query_text,query_norm,kind,matched_type,matched_id").gte("created_at", sinceIso).limit(20000);
    const tc = new Map<string, { q: string; n: number }>(), rc = new Map<string, number>();
    for (const r of (sl ?? []) as { query_text: string; query_norm: string; kind: string; matched_type: string | null; matched_id: string | null }[]) {
      if (r.matched_type === "browse") { const region = (r.matched_id || r.query_text || "").replace(/^browse:/, ""); if (region) rc.set(region, (rc.get(region) ?? 0) + 1); continue; }
      if (!r.query_norm) continue;
      const cur = tc.get(r.query_norm) ?? { q: r.query_text, n: 0 }; cur.n++; tc.set(r.query_norm, cur);
    }
    terms = [...tc.values()].sort((a, b) => b.n - a.n).slice(0, 10);
    regions = [...rc.entries()].map(([region, n]) => ({ region, n })).sort((a, b) => b.n - a.n).slice(0, 8);

    // 활동 수
    const { data: ev } = await sb.from("events").select("name").gte("created_at", sinceIso).limit(50000);
    for (const e of (ev ?? []) as { name: string }[]) {
      if (e.name === "screen") activity.screens++;
      else if (e.name.startsWith("search")) activity.searches++;
      else if (e.name === "buy_link_click") activity.buyClicks++;
      else if (e.name === "restaurant_link_click") activity.restaurantClicks++;
      else if (e.name === "save") activity.saves++;
    }
    const { count } = await sb.from("users").select("id", { count: "exact", head: true });
    activity.members = count ?? 0;
  }
  const picks = (await listPosts(8).catch(() => [])).map((p) => ({ d: p.d, f: p.f, drink: p.drink, food: p.food, n: p.likes, nick: p.nick, note: p.note }));
  return { month: Number(kst(now).slice(5, 7)), from: kst(now - days * 86400000), to: kst(now), generatedAt: new Date(now).toISOString(), top, compared: t.compared, hot, rated, ratingsTotal, picks, terms, regions, activity };
}

/** 블로그·인스타에 붙일 글 — 화면과 같은 내용을 평문으로 */
export function reportText(r: Report): string {
  const L: string[] = [];
  L.push(`페어링GO ${r.month}월 전통주 트렌드 리포트 (${r.from.slice(5).replace("-", "/")}~${r.to.slice(5).replace("-", "/")})`, "");
  if (r.top.length) { L.push("■ 요즘 많이 찾는 전통주 TOP 10 (인스타·유튜브·네이버·구글 30일 언급량)"); r.top.forEach((d, i) => L.push(`${i + 1}. ${d.name} (${d.category}·${d.region})${d.badge ? ` ${d.badge.label}` : ""}`)); L.push(""); }
  if (r.hot.length) { L.push(`■ 핫한 페어링${r.hot[0]?.fromLogs ? " (회원이 많이 누른 조합)" : " (근거 점수 순)"}`); r.hot.forEach((h, i) => L.push(`${i + 1}. ${h.drink} × ${h.food}`)); L.push(""); }
  if (r.rated.length) { L.push("■ 먹어봤어요 — 회원 평가"); r.rated.forEach((x) => L.push(`· ${x.drink} × ${x.food}: ${x.text}`)); L.push(""); }
  if (r.picks.length) { L.push("■ 회원 추천 (하트 많은 순)"); r.picks.forEach((p) => L.push(`· ${p.drink} × ${p.food} ♥${p.n}${p.note ? ` — "${p.note}" (${p.nick})` : ""}`)); L.push(""); }
  if (r.terms.length) L.push(`■ 많이 찾은 검색어: ${r.terms.map((t) => `${t.q}(${t.n})`).join(", ")}`);
  if (r.regions.length) L.push(`■ 지역별 둘러보기: ${r.regions.map((x) => `${x.region}(${x.n})`).join(", ")}`);
  L.push("", `#페어링GO #전통주 #안주추천 #${r.month}월트렌드`);
  return L.join("\n");
}
