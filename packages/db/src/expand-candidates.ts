/**
 * 전통주 목록 확장 후보 — "온라인으로 살 수 있는 전통주를 빠짐없이"(2026-09-20 사용자 요청, 1번 방법)
 *   pnpm --filter @pairinggo/db expand-candidates   → templates/전통주_추가후보.xlsx + research/expand-candidates.json
 *
 * 후보 = 더술닷컴(aT) 제품 중 카탈로그에 없는 것 + 수상작(우리술품평회 최근 5년 · 대한민국주류대상 우리술 최근 3년) 중 카탈로그에 없는 것.
 * 같은 제품은 한 줄로 묶는다(수상작 ↔ 더술닷컴은 shared matchAwardDrink — 양조장 같음 + 이름 같음/표기 차이만).
 * 점수 = 수상(최근 5년) + 거점(충남·세종·대전) + 카탈로그에 없는 양조장 + 양조장 추천 음식 + 쇼핑 수요. 양조장당 3종.
 * 온라인 판매는 법에서 정한 전통주(민속주·지역특산주)만 된다 — 수입 원료·대형 주류회사 제품은 "확인 필요"로 빼고,
 * 나머지도 넣기 전에 판매처(양조장 공식몰·스마트스토어)가 있는지 사람이 확인한다.
 */
import ExcelJS from "exceljs";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DATA, awardYearCount, awardYears, categoryOfKind, drinkAwardString, matchAwardDrink, prizeRank, relativeInterest, sameBrewery,
  type AwardDrink, type LineupCategory,
} from "@pairinggo/shared";
import { loadAwardEntries, loadOverrides, matchEntry, type AwardEntry } from "./drink-awards";
import { loadResearch, norm, type ResearchProduct } from "./research";
import type { InsightFile } from "./shop-insight";
import { sidoOf, sigunguOf, type Sido } from "./sido";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const XLSX = join(ROOT, "templates", "전통주_추가후보.xlsx");
const JSON_OUT = join(ROOT, "research", "expand-candidates.json");
/** 추천 = 다루는 연도 안의 수상작 전부(2026-09-20 사용자 요청: 수상작을 넣는다) + 수상 없는 후보 점수 순 NON_AWARD_PICK종(거점·새 양조장·추천 음식) */
const NON_AWARD_PICK = 60;
const PER_BREWERY = 3;   // 수상 없는 후보만 — 수상작은 양조장당 제한 없음
const HUB: Sido[] = ["충남", "세종", "대전"];
/** 온라인 판매가 안 될 가능성이 큰 신호 — 전통주(지역특산주)는 지역 농산물 원료, 대형 주류회사의 일반 주류는 통신판매 불가 */
const NON_ALCOHOL = /[논무]\s*알(콜|코올)|non[-\s]?alcohol/i;
/** 같은 제품 묶기 — 용량 표기(480ml·1.8L)만 다른 이름은 한 제품 */
const nameKey = (s: string) => norm(s.replace(/\d+(\.\d+)?\s*(ml|mL|ML|l|L|리터)\b/g, " "));
const IMPORTED = /수입|외국산|호주산|미국산|중국산|베트남산|태국산|칠레산|프랑스산|독일산|이탈리아산|스페인산/;
/** 지금 온라인 판매 불가(NON_TRAD)인 7종의 회사(국순당 횡성·경주법주·화요·하이트진로·보해양조) + 대도시 탁주 제조사·대형 소주 회사 — 국순당여주명주(려)는 지역특산주라 뺀다 */
const BIG_MAKER = /하이트진로|롯데칠성|서울장수|서울탁주|인천탁주|부산합동양조|무학|금복주|대선주조|오비맥주|보해양조|경주법주|화요|골든블루|국순당(?!\s*여주)/;   // 골든블루(위스키 회사)는 2026-09-24 추가

type Cand = {
  key: string; name: string; brewery: string; category: LineupCategory | null; abv: number | null; sido: Sido; sigungu: string;
  ingredients: string; food: string; awards: AwardEntry[]; interest: number | null; sources: string[]; productId: string | null;
  newBrewery: boolean; hub: boolean; caution: string[]; notes: string[]; score: number; pick: boolean; reason: string;
};

const corp = /농업회사법인|영농조합법인|농업법인|영농조합|협동조합|주식회사|유한회사|합자회사|\(주\)|㈜|\(농\)|\(유\)|\(영\)|\(합\)/g;
const cleanBrew = (s: string) => (s || "").replace(corp, " ").replace(/\s+/g, " ").trim();
const partCategory = (part: string, name: string, materials: string): LineupCategory | null => {
  const kind = /탁주/.test(part) ? "탁주" : /약|청주/.test(part) ? "약주, 청주" : /증류/.test(part) ? "증류주" : /와인|과실/.test(part) ? "과실주" : "리큐르/기타주류";
  return categoryOfKind(kind, name, materials);
};

function build() {
  const research = loadResearch();
  const catalog: AwardDrink[] = DATA.drinks.map((d) => ({ id: d.id, name: d.name, alias: d.alias ? [d.alias] : [], brewery: d.brewery, abv: d.abv }));
  const inCatalog = (name: string, brewery: string) => !!matchAwardDrink({ name, brewery }, catalog);
  const catalogBrew = DATA.drinks.map((d) => d.brewery || "").filter(Boolean);

  // 쇼핑 수요(9월 13일 측정, 기준 '도깨비술' = 100) — 제품 id별
  const interestOf = new Map<string, number>();
  const insightFile = join(ROOT, "research", "shop-insight.json");
  if (existsSync(insightFile)) {
    const f = JSON.parse(readFileSync(insightFile, "utf8")) as InsightFile;
    for (const g of Object.values(f.groups)) if (g.kind === "candidate" && g.points) {
      const t = relativeInterest(g.points, g.anchor ?? [], f.meta.periods).total;
      for (const id of g.members) interestOf.set(id, t);
    }
  }

  // 1) 더술닷컴 제품 중 카탈로그에 없는 것
  const cands = new Map<string, Cand>();
  const productDrinks: AwardDrink[] = [];
  for (const p of research) {
    if (!p.name || inCatalog(p.name, p.brewery)) continue;
    const key = `${nameKey(p.name)}|${norm(cleanBrew(p.brewery))}`;
    if (cands.has(key)) continue;   // 용량만 다른 같은 제품
    cands.set(key, {
      key, name: p.name, brewery: cleanBrew(p.brewery), category: categoryOfKind(p.kind, p.name, p.ingredients), abv: p.abv, sido: p.sido, sigungu: p.sigungu,
      ingredients: p.ingredients, food: p.food, awards: [], interest: interestOf.get(p.id) ?? null, sources: [p.url], productId: p.id,
      newBrewery: false, hub: false, caution: [], notes: [], score: 0, pick: false, reason: "",
    });
    productDrinks.push({ id: key, name: p.name, brewery: p.brewery, abv: p.abv });
  }

  // 2) 최근 5년 수상작 — 카탈로그에 있으면 건너뛰고(수상 이력은 drink-awards가 붙임), 더술닷컴 후보와 같으면 합치고, 아니면 새 후보
  const entries = loadAwardEntries(), overrides = loadOverrides();
  const years = new Set<number>();
  const compYears = new Map<string, number[]>();   // 대회마다 다루는 연도 (우리술품평회 5년 · 대한민국주류대상 3년)
  for (const c of ["우리술품평회", "대한민국주류대상"] as const) {
    const ys = awardYears(entries.filter((e) => e.competition === c).map((e) => e.year), awardYearCount(c));
    compYears.set(c, ys);
    for (const y of ys) years.add(y);
  }
  const kla = existsSync(join(ROOT, "research", "awards", "korea-liquor-awards.json"))
    ? (JSON.parse(readFileSync(join(ROOT, "research", "awards", "korea-liquor-awards.json"), "utf8")) as { items: { name: string; brewery: string; abv: number | null; materials: string; sido: string; sigungu: string; url: string }[] }).items : [];
  for (const e of entries) {
    if (!(compYears.get(e.competition) ?? []).includes(e.year)) continue;
    if (matchEntry(e, catalog, overrides)) continue;
    const hit = matchAwardDrink(e, productDrinks);
    if (hit) { const c = cands.get(hit)!; c.awards.push(e); if (!c.sources.includes(e.source)) c.sources.push(e.source); continue; }
    const key = `${nameKey(e.name)}|${norm(cleanBrew(e.brewery))}`;
    const same = [...cands.values()].find((c) => c.key === key || (!c.productId && sameBrewery(c.brewery, e.brewery) && norm(c.name) === norm(e.name)));
    if (same) { same.awards.push(e); if (!same.sources.includes(e.source)) same.sources.push(e.source); continue; }
    const k = kla.find((x) => x.url === e.source);
    const addr = k ? `${k.sido} ${k.sigungu}` : (e.region ?? "");
    cands.set(key, {
      key, name: e.name, brewery: cleanBrew(e.brewery), category: partCategory(e.part, e.name, k?.materials ?? ""), abv: k?.abv ?? null,
      sido: sidoOf(addr), sigungu: sigunguOf(addr), ingredients: k?.materials ?? "", food: "", awards: [e], interest: null, sources: [e.source], productId: null,
      newBrewery: false, hub: false, caution: [], notes: [], score: 0, pick: false, reason: "",
    });
  }

  // 3) 점수·주의·선정
  const all = [...cands.values()];
  for (const c of all) {
    c.hub = HUB.includes(c.sido);
    c.newBrewery = !catalogBrew.some((b) => sameBrewery(b, c.brewery));
    if (IMPORTED.test(c.ingredients)) c.caution.push("수입 원료");
    if (BIG_MAKER.test(c.brewery)) c.caution.push("대형 주류회사");
    if (!c.category) c.caution.push("종류 모름");
    if (NON_ALCOHOL.test(c.name)) c.caution.push("무알코올");
    if (c.abv == null) c.notes.push("도수 확인");
    const best = c.awards.length ? Math.min(...c.awards.map((a) => prizeRank(a.prize))) : 9;
    const fairWin = c.awards.some((a) => a.competition === "우리술품평회");
    const awardScore = !c.awards.length ? 0 : (fairWin ? 40 : 25) + (best === 0 ? 15 : best === 1 && fairWin ? 8 : 0) + Math.min(15, (new Set(c.awards.map((a) => a.year)).size - 1) * 5);
    const demand = c.interest == null ? 0 : c.interest >= 20 ? 15 : c.interest > 0 ? 6 : 0;
    c.score = awardScore + (c.hub ? 20 : 0) + (c.newBrewery ? 12 : 0) + (c.food ? 8 : 0) + demand;
  }
  const perBrew = new Map<string, number>();
  const ranked = all.filter((c) => !c.caution.length).sort((a, b) => b.score - a.score || (b.interest ?? 0) - (a.interest ?? 0) || a.name.localeCompare(b.name, "ko"));
  let extra = 0;
  for (const c of ranked) if (c.awards.length) { c.pick = true; c.reason = "추천 — 수상작"; perBrew.set(norm(c.brewery), (perBrew.get(norm(c.brewery)) ?? 0) + 1); }
  for (const c of ranked) {
    if (c.pick) continue;
    const bk = norm(c.brewery);
    if ((perBrew.get(bk) ?? 0) >= PER_BREWERY) { c.reason = `같은 양조장 ${PER_BREWERY}종 초과`; continue; }
    if (extra >= NON_AWARD_PICK) { c.reason = "점수 순위 밖"; continue; }
    if (c.score <= 0) { c.reason = "점수 없음(수상·거점·새 양조장·추천 음식·수요 모두 없음)"; continue; }
    c.pick = true; extra++; perBrew.set(bk, (perBrew.get(bk) ?? 0) + 1); c.reason = "추천";
  }
  for (const c of all) if (c.caution.length) c.reason = `확인 필요 — ${c.caution.join(", ")}`;
  return { all: all.sort((a, b) => Number(b.pick) - Number(a.pick) || b.score - a.score), years: [...years].sort((a, b) => b - a) };
}

/** 판매처 — buy-links(업체가 요즘이술·더술닷컴에 등록한 링크) 먼저, 없으면 buy-links-search(검색으로 찾은 양조장 공식 스토어, 확인 권장) */
type Shop = { url: string; kind: string; from: string; ok: boolean | null };
const readJson = <T,>(p: string): T | null => (existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as T) : null);
const shops: Record<string, Shop> = { ...(readJson<Record<string, Shop>>(join(ROOT, "research", "buy-links-search.json")) ?? {}) };
for (const [k, v] of Object.entries(readJson<Record<string, Shop>>(join(ROOT, "research", "buy-links.json")) ?? {})) if (v.ok !== false || !shops[k]) shops[k] = v;
const shopOf = (c: Cand) => { const s = shops[c.key]; return s && s.ok !== false ? s : null; };

async function write({ all, years }: ReturnType<typeof build>) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "페어링GO";
  const head = (ws: ExcelJS.Worksheet) => { ws.getRow(1).font = { bold: true }; ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF3F8" } }; ws.views = [{ state: "frozen", ySplit: 1 }]; };
  const awardText = (c: Cand) => [...c.awards].sort((a, b) => b.year - a.year).map((a) => drinkAwardString(a)).join(" · ");
  const picks = all.filter((c) => c.pick);
  const count = <T,>(xs: T[], k: (x: T) => string) => xs.reduce((m, x) => m.set(k(x), (m.get(k(x)) ?? 0) + 1), new Map<string, number>());

  const s0 = wb.addWorksheet("요약");
  s0.columns = [{ width: 30 }, { width: 90 }];
  const rows: [string, string][] = [
    ["만든 날", new Date().toISOString().slice(0, 10)],
    ["현재 카탈로그", `전통주 ${DATA.drinks.length}종`],
    ["후보", `${all.length}종 — 더술닷컴(aT) 중 카탈로그에 없는 제품 ${all.filter((c) => c.productId).length} + 수상작만 있는 제품 ${all.filter((c) => !c.productId).length}`],
    ["수상 기준", `우리술품평회 최근 ${awardYearCount("우리술품평회")}년 + 대한민국주류대상 우리술 부문 최근 ${awardYearCount("대한민국주류대상")}년(2026-09-20 사용자 결정) — 수상 후보 ${all.filter((c) => c.awards.length).length}종`],
    ["추천", `${picks.length}종 = 수상작 전부 ${picks.filter((c) => c.awards.length).length} + 수상 없는 후보 점수순 ${picks.filter((c) => !c.awards.length).length}(양조장당 ${PER_BREWERY}종) · 확인 필요 제외 — 넣으면 카탈로그 ${DATA.drinks.length + picks.length}종`],
    ["추천 — 종류", [...count(picks, (c) => c.category ?? "-")].map(([k, v]) => `${k} ${v}`).join(" · ")],
    ["추천 — 수상작", `${picks.filter((c) => c.awards.length).length}종 (우리술품평회 ${picks.filter((c) => c.awards.some((a) => a.competition === "우리술품평회")).length} · 대한민국주류대상 ${picks.filter((c) => c.awards.some((a) => a.competition === "대한민국주류대상")).length})`],
    ["추천 — 거점(충남·세종·대전)", `${picks.filter((c) => c.hub).length}종`],
    ["추천 — 카탈로그에 없는 양조장", `${picks.filter((c) => c.newBrewery).length}종 (${new Set(picks.filter((c) => c.newBrewery).map((c) => norm(c.brewery))).size}곳)`],
    ["추천 — 양조장 추천 음식 있음", `${picks.filter((c) => c.food).length}종 → 공식 페어링(근거 링크)으로 들어감`],
    ["점수", "수상: 우리술품평회 40 · 주류대상만 25 · 대통령상/Best of Best +15 · 품평회 대상 +8 · 여러 해 수상 +5/해(최대 15) | 거점 +20 | 카탈로그에 없는 양조장 +12 | 양조장 추천 음식 +8 | 쇼핑 수요 20 이상 +15, 조금 +6"],
    ["확인 필요(추천에서 뺌)", `${all.filter((c) => c.caution.length).length}종 — 수입 원료 ${all.filter((c) => c.caution.includes("수입 원료")).length} · 대형 주류회사 ${all.filter((c) => c.caution.includes("대형 주류회사")).length} · 종류 모름 ${all.filter((c) => c.caution.includes("종류 모름")).length}. 도수를 모르는 수상작(품평회 명단엔 도수가 없음) ${all.filter((c) => c.pick && c.notes.includes("도수 확인")).length}종은 넣을 때 확인. 온라인 판매는 전통주(민속주·지역특산주)만 가능`],
    ["판매처", `추천 ${picks.length}종 중 ${picks.filter((c) => shopOf(c)).length}종 채움 — 스마트스토어 ${picks.filter((c) => shopOf(c)?.kind === "스마트스토어").length} · 공식몰·홈페이지 ${picks.filter((c) => shopOf(c) && shopOf(c)!.kind !== "스마트스토어").length} · 빈칸 ${picks.filter((c) => !shopOf(c)).length}. 업체가 요즘이술·더술닷컴에 직접 등록한 링크가 먼저, '검색으로 찾음'은 확인 권장. 빈칸이면 지금처럼 네이버쇼핑 검색으로 연결`],
    ["넣기 전 확인", "넣지 않을 술은 지우고, 판매처가 틀렸으면 고쳐 주세요(빈칸은 채우지 않아도 됩니다). 우선순위 점수는 후보를 고르는 데만 쓴 값이라 페어링과 무관합니다"],
    ["넣는 방법", "확인 뒤 add(설명은 사실로 새로 씀 · 맛 프로필 추정 · 양조장 추천 음식은 공식 페어링 · 나머지 맛 분석 8개) → blog-counts → pf-recalc → export"],
  ];
  for (const r of rows) s0.addRow(r);
  s0.getColumn(1).font = { bold: true };

  const cols = [
    { header: "추천", key: "pick", width: 6 }, { header: "제품명", key: "name", width: 30 }, { header: "양조장", key: "brewery", width: 24 },
    { header: "판매처", key: "shop", width: 40 }, { header: "판매처 출처", key: "shopFrom", width: 30 },
    { header: "종류", key: "category", width: 8 }, { header: "도수", key: "abv", width: 6 }, { header: "시도", key: "sido", width: 6 }, { header: "시군구", key: "sigungu", width: 10 },
    { header: "거점", key: "hub", width: 6 }, { header: "새 양조장", key: "newBrewery", width: 8 }, { header: "수상", key: "awards", width: 60 },
    { header: "양조장 추천 음식", key: "food", width: 30 }, { header: "쇼핑 수요", key: "interest", width: 8 }, { header: "원료", key: "ingredients", width: 36 },
    { header: "판단", key: "reason", width: 28 }, { header: "출처", key: "source", width: 50 }, { header: "우선순위 점수(고르기용)", key: "score", width: 10 },
  ];
  const put = (ws: ExcelJS.Worksheet, list: Cand[]) => {
    ws.columns = cols; head(ws);
    for (const c of list) ws.addRow({
      pick: c.pick ? "○" : "", score: c.score, name: c.name, brewery: c.brewery, category: c.category ?? "", abv: c.abv, sido: c.sido === "미상" ? "" : c.sido, sigungu: c.sigungu,
      hub: c.hub ? "○" : "", newBrewery: c.newBrewery ? "○" : "", awards: awardText(c), food: c.food, interest: c.interest, ingredients: c.ingredients, reason: [c.reason, ...c.notes].join(" · "), source: c.sources.join("\n"),
      shop: shopOf(c)?.url ?? (shops[c.key]?.ok === false ? `(안 열림) ${shops[c.key].url}` : ""), shopFrom: shopOf(c)?.from ?? "",
    });
  };
  put(wb.addWorksheet(`추천 ${picks.length}`), picks);
  put(wb.addWorksheet("수상작 (카탈로그에 없음)"), all.filter((c) => c.awards.length));
  put(wb.addWorksheet(`후보 전체 ${all.length}`), all);
  await wb.xlsx.writeFile(XLSX);
  writeFileSync(JSON_OUT, JSON.stringify({ made: new Date().toISOString(), years, picks: picks.map((c) => ({ ...c, awards: c.awards.map(drinkAwardString) })) }, null, 1) + "\n");
  console.log(`후보 ${all.length} · 추천 ${picks.length} · 수상 후보 ${all.filter((c) => c.awards.length).length} · 확인 필요 ${all.filter((c) => c.caution.length).length}\n→ ${XLSX}`);
  console.log("추천 종류", Object.fromEntries(count(picks, (c) => c.category ?? "-")), "· 수상", picks.filter((c) => c.awards.length).length, "· 거점", picks.filter((c) => c.hub).length, "· 새 양조장", picks.filter((c) => c.newBrewery).length, "· 추천 음식", picks.filter((c) => c.food).length);
  console.log("점수 상위 15:\n" + picks.slice(0, 15).map((c) => `  ${c.score} ${c.name} (${c.brewery}, ${c.sido}) ${awardText(c)}`).join("\n"));
}

await write(build());
