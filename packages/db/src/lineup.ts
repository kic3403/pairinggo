/**
 * 전통주 라인업 확장 — 쇼핑인사이트 수요(research/shop-insight.json)로 후보를 고르고, 새 술·페어링을 만든다.
 *   pnpm --filter @pairinggo/db lineup            분석만: templates/전통주_라인업_확장.xlsx + research/lineup-plan.json
 *   pnpm --filter @pairinggo/db lineup --apply    DB에 새 술·페어링 추가 + 카탈로그 버전 갱신(발행)
 * 이어서: `pnpm --filter @pairinggo/db blog-counts`(새 페어링 대중 언급 수) → `pnpm --filter @pairinggo/db export`(번들 JSON)
 *
 * 선정 규칙·맛 추정·페어링 규칙은 packages/shared/src/lineup/lineup.ts(테스트 있음). 이 파일은 데이터를 모아 넘기고 저장만 한다.
 * - 설명 문장은 사실(지역·양조장·원료·도수)로 새로 짓는다. 더술닷컴 소개글은 공공누리 4유형이라 옮기지 않는다.
 * - 양조장 추천 음식(더술닷컴 제품 정보에 양조장이 등록)은 음식 이름만 사실로 쓰고 official 근거에 출처 링크를 단다.
 * - 구매 링크는 비워 둔다 → 화면은 네이버쇼핑 검색으로 연결(스마트스토어 판매처가 여기서 나온다).
 */
import ExcelJS from "exceljs";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DATA, LINEUP_RULE, categoryAffinity, categoryOfKind, describeDrink, estimateProfile, isNameVariant, judgeLineup, matchFoods, planPairings, relativeInterest, shopKeyword,
  type DrinkProfile, type Interest, type Judged, type LineupCategory, type LineupRow, type PlannedPairing,
} from "@pairinggo/shared";
import { brewKey, loadResearch, norm, type ResearchProduct } from "./research";
import { ANCHOR, type InsightFile } from "./shop-insight";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const INSIGHT = join(ROOT, "research", "shop-insight.json");
const PLAN = join(ROOT, "research", "lineup-plan.json");
const XLSX = join(ROOT, "templates", "전통주_라인업_확장.xlsx");
const apply = process.argv.includes("--apply");

const corpStrip = (s: string) => (s || "").replace(/농업회사법인|영농조합법인|농업법인|영농조합|협동조합|주식회사|유한회사|\(주\)|㈜|\(농\)|\(유\)|\(영\)|\(합\)|합자회사|주0/g, "").replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
/** 화면 이름 — 괄호·용량을 떼고, 끝에 붙은 세 자리 이상 숫자(500·360 = 용량 표기)와 앞에 붙은 도수("14도 자색고구마 막걸리")를 뗀다. 도수 숫자(오매락 25)는 제품 구분이라 둔다 */
const cleanName = (s: string) => s.replace(/[\[(（【].*?[\])）】]/g, " ").replace(/\d+(\.\d+)?\s*(ml|mL|ML|l|L|리터)\b/g, " ")
  .replace(/^\s*\d+(\.\d+)?\s*도\s+/, "").replace(/\s+\d{3,}\s*$/, "").replace(/\s+/g, " ").trim();
const regionOf = (p: ResearchProduct) => {
  if (p.sido === "미상") return "";
  if (p.sido === "세종") return "세종";   // 세종은 시군구 없이 읍·면
  const city = (p.sigungu || "").split(/\s+/)[0].replace(/(특례)?[시군구]$/, "");
  return city.length >= 2 ? `${p.sido} ${city}` : p.sido;
};
import { slug } from "./catalog-write";
const awardsOf = (s: string) => (s || "").split(/,|\/(?=\s*\d{4})/).map((x) => x.trim()).filter((x) => /\d{4}/.test(x) && /우리술\s*품평회/.test(x.replace(/\s/g, "")))
  .map((x) => x.replace(/대한민국\s*우리술\s*품평회|우리술\s*품평회/, "우리술품평회").replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+/g, " ").trim());

type Row = LineupRow & { members: string[]; product: ResearchProduct; blogTotal: number | null };
type NewDrink = {
  id: string; name: string; alias: string | null; category: LineupCategory; abv: number; region: string; brewery: string; desc: string; flavor: string[]; profile: DrinkProfile; awards: string[];
  source: { name: string; url: string }; interest: Interest; blog: { share: number | null; hits: number; total: number | null }; pairings: PlannedPairing[];
};

function build() {
  if (!existsSync(INSIGHT)) throw new Error("research/shop-insight.json이 없습니다 — 먼저 `pnpm --filter @pairinggo/db shop-insight` 후 `--blog`");
  const file = JSON.parse(readFileSync(INSIGHT, "utf8")) as InsightFile;
  const research = loadResearch();
  const byId = new Map(research.map((p) => [p.id, p]));
  const groups = Object.values(file.groups);

  const kwCount = new Map<string, number>();
  for (const g of groups) if (g.kind === "candidate") kwCount.set(g.params[0], (kwCount.get(g.params[0]) ?? 0) + 1);

  const rows: Row[] = [];
  for (const g of groups) {
    if (g.kind !== "candidate" || !g.points) continue;
    const members = g.members.map((id) => byId.get(id)!).filter(Boolean);
    // 대표 제품: 양조장 추천 음식이 적힌 것 → 원료 정보가 긴 것
    const product = [...members].sort((a, b) => Number(!!b.food) - Number(!!a.food) || b.ingredients.length - a.ingredients.length)[0];
    if (!product) continue;
    const category = categoryOfKind(product.kind, product.name, product.ingredients);
    const variantOfCatalog = DATA.drinks.some((d) => d.brewery && brewKey(d.brewery) === brewKey(product.brewery) && d.category === category && isNameVariant(product.name, d.name));
    const bn = norm(corpStrip(product.brewery));
    rows.push({
      key: g.key, keyword: g.params[0], brewery: corpStrip(product.brewery), category, abv: product.abv,
      interest: relativeInterest(g.points, g.anchor ?? [], file.meta.periods),
      blog: g.blog ? { hits: g.blog.hits, share: g.blog.share } : null, blogTotal: g.blog?.total ?? null,
      variantOfCatalog, breweryName: bn.length >= 2 && (norm(g.params[0]) === bn || brewKey(g.params[0]) === brewKey(product.brewery)),
      duplicateKeyword: (kwCount.get(g.params[0]) ?? 0) > 1, members: g.members, product,
    });
  }
  const judged = judgeLineup(rows);

  // 현재 라인업의 같은 눈금 수요(비교표)
  const catalog = groups.filter((g) => g.kind === "catalog").map((g) => {
    const d = DATA.drinks.find((x) => x.id === g.members[0])!;
    return { id: d.id, name: d.name, category: d.category, keyword: g.params[0], interest: relativeInterest(g.points ?? [], g.anchor ?? [], file.meta.periods) };
  }).sort((a, b) => b.interest.total - a.interest.total);

  // 새 술 만들기
  const maxId = Math.max(...DATA.drinks.map((d) => Number(d.id.slice(1))));
  const usedSlugs = new Set(DATA.drinks.map((d) => slug(d.name)));
  const foods = DATA.foods.map((f) => ({ id: f.id, name: f.name, category: f.category, profile: f.profile, trend: f.trend, alias: f.alias }));
  const usage = new Map<string, number>();   // 새 술들 사이 음식 쏠림 방지
  const affinityOf = new Map<string, ReturnType<typeof categoryAffinity>>();   // 종류별 전문가 조합 빈도(현재 라인업 기준)
  const drinks: NewDrink[] = [];
  for (const r of judged.filter((x) => x.selected)) {
    const p = r.product;
    const name = cleanName(p.name);
    if (usedSlugs.has(slug(name))) { r.selected = false; r.reason = "이름이 겹치는 술이 이미 있음"; continue; }
    usedSlugs.add(slug(name));
    const category = r.category!;
    const { profile, flavor } = estimateProfile({ category, abv: p.abv, name: p.name, ingredients: p.ingredients, intro: p.intro });
    const region = regionOf(p);
    const official = p.url.includes("thesool.com") ? matchFoods(p.food, foods) : [];
    const kw = shopKeyword(name);
    drinks.push({
      id: `d${maxId + drinks.length + 1}`, name, alias: kw !== name ? kw : null, category, abv: p.abv!, region, brewery: r.brewery,
      desc: describeDrink({ category, abv: p.abv, region, brewery: r.brewery, ingredients: p.ingredients, flavor }), flavor, profile, awards: awardsOf(p.awards),
      source: { name: p.url.includes("thesool.com") ? "더술닷컴 제품 정보" : p.source, url: p.url }, interest: r.interest, blog: { share: r.blog?.share ?? null, hits: r.blog?.hits ?? 0, total: r.blogTotal },
      pairings: planPairings({ profile, abv: p.abv }, foods, official, undefined, usage,
        affinityOf.get(category) ?? (affinityOf.set(category, categoryAffinity(DATA.pairings, DATA.drinks, category)), affinityOf.get(category))),
    });
  }
  return { file, judged, catalog, drinks };
}

async function writeReport(x: ReturnType<typeof build>) {
  const { judged, catalog, drinks, file } = x;
  const wb = new ExcelJS.Workbook();
  wb.creator = "페어링GO";
  const head = (ws: ExcelJS.Worksheet) => { ws.getRow(1).font = { bold: true }; ws.views = [{ state: "frozen", ySplit: 1 }]; };
  const q = (arr: number[], p: number) => { const a = [...arr].sort((m, n) => m - n); return a[Math.floor((a.length - 1) * p)] ?? 0; };
  const cat = catalog.map((c) => c.interest.total);
  const sel = judged.filter((j) => j.selected);
  const foodName = new Map(DATA.foods.map((f) => [f.id, f.name]));

  const s0 = wb.addWorksheet("요약");
  s0.columns = [{ width: 34 }, { width: 70 }];
  const reasons = new Map<string, number>();
  for (const j of judged) if (!j.selected) { const k = j.reason.replace(/\(.*\)/, "").trim(); reasons.set(k, (reasons.get(k) ?? 0) + 1); }
  const perCat = new Map<string, number>(); for (const d of drinks) perCat.set(d.category, (perCat.get(d.category) ?? 0) + 1);
  [
    ["분석일", file.meta.ran_at.slice(0, 10)],
    ["데이터", `네이버 쇼핑인사이트(식품 카테고리 키워드 클릭, ${file.meta.start} ~ ${file.meta.end} 월별) + 네이버 블로그 교차 확인`],
    ["왜 스마트스토어 목록이 아닌가", "네이버 쇼핑 검색 API는 2026-07-31 종료, 스마트스토어 페이지 자동 수집은 네이버 약관 위반. 쇼핑인사이트는 스마트스토어를 포함한 네이버 쇼핑 전체 클릭을 반영한다."],
    ["눈금", `기준 제품 '${ANCHOR}' = 100. 현재 라인업 108종: 상위 25% ${q(cat, 0.75)} · 중앙값 ${q(cat, 0.5)} · 하위 25% ${q(cat, 0.25)}`],
    ["후보", `더술닷컴 1,300종 + 수동 추가 중 앱에 없는 제품 ${judged.length}개 묶음`],
    ["선정 기준", `수요 ≥ ${LINEUP_RULE.minTotal}, 12개월 중 ${LINEUP_RULE.minMonths}개월 이상 클릭, 블로그 글 ${LINEUP_RULE.minHits}건 이상 중 술 이야기 ${LINEUP_RULE.minShare * 100}% 이상(이름에 술 단어가 있으면 ${LINEUP_RULE.minShareDrinkWord * 100}%), 양조장당 ${LINEUP_RULE.perBrewery}종`],
    ["선정", `${drinks.length}종 — ${[...perCat.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" · ")}`],
    ["새 페어링", `${drinks.reduce((s, d) => s + d.pairings.length, 0)}개 (양조장 추천 ${drinks.reduce((s, d) => s + d.pairings.filter((p) => p.src === "official").length, 0)} · 맛 분석 ${drinks.reduce((s, d) => s + d.pairings.filter((p) => p.src === "profile").length, 0)})`],
    ["제외 사유", [...reasons.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" · ")],
    ["주의", "맛 프로필·맛 분석 페어링은 공개 정보로 추정한 값 — 화면에서 '맛 분석'으로 표시된다. 시음·양조장 확인으로 고쳐 나가야 한다."],
  ].forEach((r) => s0.addRow(r));
  s0.getColumn(1).font = { bold: true };
  s0.getColumn(2).alignment = { wrapText: true, vertical: "top" };

  const s1 = wb.addWorksheet("선정");
  s1.columns = [
    { header: "id", key: "id", width: 7 }, { header: "술", key: "name", width: 26 }, { header: "종류", key: "category", width: 8 }, { header: "도수", key: "abv", width: 6 },
    { header: "지역", key: "region", width: 12 }, { header: "양조장", key: "brewery", width: 18 }, { header: "쇼핑 수요", key: "total", width: 9 }, { header: "최근 3개월", key: "recent", width: 9 },
    { header: "성장", key: "growth", width: 6 }, { header: "블로그 술 비율", key: "share", width: 9 }, { header: "설명(자동 작성)", key: "desc", width: 50 }, { header: "맛 태그", key: "flavor", width: 18 },
    { header: "단·산·바디·탄산·향", key: "profile", width: 14 }, { header: "양조장 추천 음식", key: "official", width: 22 }, { header: "맛 분석 음식", key: "profileFoods", width: 40 }, { header: "출처", key: "url", width: 40 },
  ];
  for (const d of drinks) s1.addRow({
    ...d, total: d.interest.total, recent: d.interest.recent, growth: d.interest.growth, share: d.blog.share, flavor: d.flavor.join(", "),
    profile: [d.profile.sweet, d.profile.acid, d.profile.body, d.profile.fizz, d.profile.aroma].join("·"),
    official: d.pairings.filter((p) => p.src === "official").map((p) => foodName.get(p.f)).join(", "),
    profileFoods: d.pairings.filter((p) => p.src === "profile").map((p) => foodName.get(p.f)).join(", "), url: d.source.url,
  });
  head(s1);

  const s2 = wb.addWorksheet("후보 전체");
  s2.columns = [
    { header: "선정", key: "sel", width: 6 }, { header: "사유", key: "reason", width: 34 }, { header: "검색어", key: "keyword", width: 26 }, { header: "제품", key: "name", width: 26 },
    { header: "양조장", key: "brewery", width: 18 }, { header: "종류", key: "category", width: 8 }, { header: "쇼핑 수요", key: "total", width: 9 }, { header: "클릭 달", key: "months", width: 7 },
    { header: "성장", key: "growth", width: 6 }, { header: "블로그 글", key: "hits", width: 8 }, { header: "술 비율", key: "share", width: 8 }, { header: "블로그 총수", key: "blogTotal", width: 10 },
  ];
  for (const j of judged as Judged<Row>[]) s2.addRow({
    sel: j.selected ? "○" : "", reason: j.reason, keyword: j.keyword, name: j.product.name, brewery: j.brewery, category: j.category ?? "", total: j.interest.total, months: j.interest.months,
    growth: j.interest.growth, hits: j.blog?.hits ?? "", share: j.blog?.share ?? "", blogTotal: j.blogTotal ?? "",
  });
  head(s2);
  s2.autoFilter = { from: "A1", to: "L1" };

  const s3 = wb.addWorksheet("현재 라인업 수요");
  s3.columns = [{ header: "id", key: "id", width: 7 }, { header: "술", key: "name", width: 28 }, { header: "종류", key: "category", width: 8 }, { header: "검색어", key: "keyword", width: 26 },
    { header: "쇼핑 수요", key: "total", width: 9 }, { header: "클릭 달", key: "months", width: 7 }, { header: "성장", key: "growth", width: 6 }];
  for (const c of catalog) s3.addRow({ ...c, total: c.interest.total, months: c.interest.months, growth: c.interest.growth });
  head(s3);

  mkdirSync(dirname(XLSX), { recursive: true });
  await wb.xlsx.writeFile(XLSX);
}

async function applyToDb(drinks: NewDrink[]) {
  const { insertDrinks } = await import("./catalog-write");
  await insertDrinks(drinks.map((d) => ({
    ...d, buy: null, offline: null,
    pairings: d.pairings.map((p) => ({ ...p, evidence: p.src === "official" ? [{ source: d.source.name, url: d.source.url, quote: null, who: d.brewery, tier: "official" as const }] : [] })),
  })), `라인업 확장 +${drinks.length}종 (쇼핑인사이트)`);
}

const x = build();
writeFileSync(PLAN, JSON.stringify({ generated_at: new Date().toISOString(), rule: LINEUP_RULE, drinks: x.drinks }, null, 1));
await writeReport(x);
const sel = x.judged.filter((j) => j.selected);
console.log(`후보 ${x.judged.length} · 선정 ${x.drinks.length} · 페어링 ${x.drinks.reduce((s, d) => s + d.pairings.length, 0)}`);
console.log(`→ ${XLSX}\n→ ${PLAN}`);
console.log(sel.slice(0, 15).map((j) => `  ${j.interest.total}\t${j.keyword}\t${j.brewery}`).join("\n"));
if (apply) await applyToDb(x.drinks);
else console.log("DB에는 아직 넣지 않았습니다. 넣으려면 --apply");
