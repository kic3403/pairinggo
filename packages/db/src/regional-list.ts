/**
 * 전통주 지역별 목록 엑셀 생성 — templates/전통주_지역별_목록.xlsx
 *   pnpm --filter @pairinggo/db regional
 *
 * 입력(research/):
 *   thesool-products.json   더술닷컴(농식품부·aT 운영) 우리술 찾기 전체 상세 (2026-09-11 수집)
 *   visiting-brewery.csv    공공데이터포털 15048756 "찾아가는양조장정보" (농식품부 선정, 2026·2027·2028 유효)
 *   naver-regional.json     네이버 전통주백과 「지역별 술」(향기로운 한식, 우리술 산책) 6개 항목
 *   품평회 수상작은 research/awards/woorisool-fair.json (농식품부 보도자료·더술닷컴 입상작 카탈로그 — drink-awards와 공용)
 */
import ExcelJS from "exceljs";
import { readFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DATA } from "@pairinggo/shared";
import { SIDO_ORDER, SIDO_LABEL, sidoOf, sigunguOf, sidoOfCatalogRegion, type Sido } from "./sido";
import { loadResearch, renameBrew } from "./research";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const R = (f: string) => join(root, "research", f);
mkdirSync(join(root, "templates"), { recursive: true });
const out = join(root, "templates", "전통주_지역별_목록.xlsx");
const COLLECTED = "2026-09-11";

/* ---------- 입력 로드 ---------- */
type Detail = { name?: string; kind: string; ingredients: string; abv: string; volume: string; awards: string; tags: string; intro: string; food: string; brewery: string; address: string; homepage: string; phone: string };
type Product = { id: string; name: string; labels?: string[]; region?: string; detail?: Detail };
const raw = JSON.parse(readFileSync(R("thesool-products.json"), "utf8")) as Record<string, Product | boolean>;
const products = Object.values(raw).filter((p): p is Product => typeof p === "object" && !!p.detail?.brewery);
// 등록 문구의 HTML 엔티티·파싱 잔여물 정리
const unent = (s: string) => (s || "").replace(/&amp;/g, "&").replace(/&quot;|&#0?34;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
for (const p of products) {
  const d = p.detail!;
  for (const k of ["ingredients", "intro", "food", "awards", "brewery", "address"] as const) d[k] = unent(d[k]);
  d.brewery = renameBrew(d.brewery);
  d.homepage = /^(https?:\/\/|www\.|[a-z0-9-]+\.(com|kr|net|co\.kr|modoo\.at))/i.test(d.homepage.trim()) ? d.homepage.trim().split(/\s+/)[0] : "";
  d.phone = /^[\d\-().\s~,/]{7,40}$/.test(d.phone.trim()) ? d.phone.trim() : "";
}

const visitingCsv = readFileSync(R("visiting-brewery.csv"), "utf8").replace(/^﻿/, "");
const parseCsv = (t: string) => t.split(/\r?\n/).filter(Boolean).map((line) => { const cells: string[] = []; let cur = "", q = false; for (const ch of line) { if (ch === '"') q = !q; else if (ch === "," && !q) { cells.push(cur); cur = ""; } else cur += ch; } cells.push(cur); return cells; });
const [vHead, ...vRows] = parseCsv(visitingCsv);
const visiting = vRows.map((r) => Object.fromEntries(vHead.map((h, i) => [h, r[i] ?? ""])) as Record<string, string>);

type NaverRow = { name: string; group: string; url: string; 주종?: string; 양조장?: string; 지역?: string; "알코올 도수"?: string; 주원료?: string; 제품설명?: string; 제품특징?: string };
const naver = JSON.parse(readFileSync(R("naver-regional.json"), "utf8")) as NaverRow[];

/* ---------- 우리술 품평회 수상작 (research/awards/woorisool-fair.json — 농식품부 보도자료·더술닷컴 카탈로그) ---------- */
type Fair = { year: number; part: string; prize: string; name: string; brewery: string; region: string; source: string };
const fairFile = JSON.parse(readFileSync(R("awards/woorisool-fair.json"), "utf8")) as { meta: { years: number[] }; items: Fair[] };
const FAIR: Fair[] = fairFile.items;
const FAIR_RANGE = `${Math.min(...fairFile.meta.years)}~${Math.max(...fairFile.meta.years)}`;

/* ---------- 매칭 유틸 ---------- */
const norm = (s: string) => (s || "").toLowerCase().replace(/\(.*?\)/g, "").replace(/[^0-9a-z가-힣]/g, "");
const normBrew = (s: string) => norm(s.replace(/농업회사법인|영농조합법인|영농조합|협동조합|주식회사|유한회사|\(주\)|㈜|\(농\)|\(유\)|\(영\)|\(합\)|합자회사/g, ""));
// 카탈로그 이름과 aT 등록명이 다른 경우의 보조 별칭
const EXTRA_ALIAS: Record<string, string[]> = { d03: ["지평생쌀막걸리", "지평쌀막걸리", "지평막걸리"], d20: ["문배술"], d35: ["예담"], d50: ["려25"], d92: ["려증류소주40", "려고구마소주40"] };
const catDrinks = DATA.drinks.map((d) => ({ d, keys: [norm(d.name), norm(d.alias), ...(EXTRA_ALIAS[d.id] || []).map(norm)].filter((k) => k.length >= 2), brew: normBrew(d.brewery || "") }));
function matchCatalog(name: string, brewery = "") {
  const n = norm(name);
  if (!n) return null;
  let hit = catDrinks.find((c) => c.keys.includes(n));
  // aT 등록명이 카탈로그 이름·별칭을 포함 (예: "명인 안동소주 35%" ⊃ "안동소주")
  if (!hit && n.length >= 3) hit = catDrinks.find((c) => c.keys.some((k) => k.length >= 3 && n.includes(k)));
  // 반대 방향(카탈로그 이름이 aT 등록명을 포함)은 양조장이 같을 때만 (예: "청명주"[중원당] → "중원당 청명주")
  if (!hit && n.length >= 3 && brewery) { const b = normBrew(brewery); hit = catDrinks.find((c) => c.brew && (b.includes(c.brew) || c.brew.includes(b)) && c.keys.some((k) => k.includes(n))); }
  return hit?.d ?? null;
}
const visitingByBrew = new Map(visiting.map((v) => [normBrew(v["상호명"]), v]));
function matchVisiting(brewery: string) {
  const b = normBrew(brewery);
  if (visitingByBrew.has(b)) return visitingByBrew.get(b)!;
  for (const [k, v] of visitingByBrew) if (k.length >= 3 && (b.includes(k) || k.includes(b))) return v;
  return null;
}
const fairByName = new Map<string, Fair[]>();
for (const f of FAIR) { const k = norm(f.name); fairByName.set(k, [...(fairByName.get(k) || []), f]); }
function matchFair(name: string) {
  const n = norm(name);
  const hits = [...fairByName.entries()].filter(([k]) => k === n || (k.length >= 4 && n.length >= 4 && (n.includes(k) || k.includes(n)))).flatMap(([, v]) => v);
  return [...new Set(hits)].sort((a, b) => b.year - a.year);
}
const kindGroup = (k: string) => (/탁주/.test(k) ? "탁주" : /약주|청주/.test(k) ? "약·청주" : /과실/.test(k) ? "과실주" : /증류|소주/.test(k) ? "증류주" : /리큐르|기타/.test(k) ? "리큐르·기타" : k || "-");
const abvNum = (s: string) => { const m = (s || "").match(/(\d+(?:\.\d+)?)\s*%/); return m ? Number(m[1]) : null; };

/* ---------- 행 조립 ---------- */
type Row = { sido: Sido; sigungu: string; name: string; kind: string; group: string; abv: number | null; volume: string; brewery: string; address: string; ingredients: string; intro: string; food: string; awards: string; fair: string; visiting: string; catalog: string; homepage: string; phone: string; tags: string; source: string; url: string };
const rows: Row[] = [];
const regionTagToSido: Record<string, Sido> = { 서울: "서울", 부산: "부산", 대구: "대구", 인천: "인천", 광주: "전남", 대전: "대전", 울산: "울산", 세종: "세종", 경기: "경기", 강원: "강원", 충북: "충북", 충남: "충남", 전북: "전북", 전남: "전남", 경북: "경북", 경남: "경남", 제주: "제주" };
let unresolved = 0;
// 주소 없는 제품 → 같은 양조장의 다른 제품 주소 / 찾아가는 양조장 / 네이버 백과 양조장으로 보정
const brewSido = new Map<string, Sido>();
for (const p of products) { const s = sidoOf(p.detail!.address); if (s !== "미상") brewSido.set(normBrew(p.detail!.brewery), s); }
for (const n of naver) { const s = sidoOf((n.지역 || "").replace(/^전남광주통합특별시/, "전남").replace(/^서울시/, "서울")); if (s !== "미상" && n.양조장) brewSido.set(normBrew(n.양조장), s); }
function sidoOfBrewery(brewery: string): Sido {
  const b = normBrew(brewery);
  if (brewSido.has(b)) return brewSido.get(b)!;
  for (const [k, s] of brewSido) if (k.length >= 3 && b.length >= 3 && (b.includes(k) || k.includes(b))) return s;
  return "미상";
}
for (const p of products) {
  const d = p.detail!;
  let sido = sidoOf(d.address);
  if (sido === "미상" && p.region) sido = regionTagToSido[p.region] ?? "미상";
  if (sido === "미상") { const v = matchVisiting(d.brewery); if (v) sido = sidoOf(v["주소"]); }
  if (sido === "미상") sido = sidoOfBrewery(d.brewery);
  if (sido === "미상") unresolved++;
  const v = matchVisiting(d.brewery);
  const fair = matchFair(d.name || p.name);
  const cat = matchCatalog(d.name || p.name, d.brewery);
  rows.push({
    sido, sigungu: sigunguOf(d.address), name: d.name || p.name, kind: d.kind || "-", group: kindGroup(d.kind), abv: abvNum(d.abv), volume: d.volume, brewery: d.brewery, address: d.address, ingredients: d.ingredients,
    intro: d.intro, food: d.food, awards: d.awards === "-" ? "" : d.awards, fair: fair.map((f) => `${f.year} ${f.part} ${f.prize}`).join(" · "),
    visiting: v ? `○ (~${v["양조장선정유효기간년도"]}${v["양조장상시방문가능여부"] === "Y" ? ", 상시" : ""}${v["양조장예약방문가능여부"] === "Y" ? ", 예약" : ""})` : "",
    catalog: cat ? `○ ${cat.id} ${cat.name}` : "", homepage: d.homepage, phone: d.phone, tags: d.tags, source: "더술닷컴(aT)", url: `https://thesool.com/front/find/M000000082/view.do?productId=${p.id}`,
  });
}
// 네이버 전통주백과 지역 술 — 더술닷컴에 없는 것만 추가
const seen = new Set(rows.map((r) => norm(r.name)));
let naverAdded = 0;
for (const n of naver) {
  const k = norm(n.name);
  if (!k || seen.has(k) || rows.some((r) => norm(r.name).includes(k) || k.includes(norm(r.name)) && norm(r.name).length >= 4)) continue;
  seen.add(k); naverAdded++;
  const region = (n.지역 || "").replace(/^전남광주통합특별시/, "전남").replace(/^서울시/, "서울");
  const cat = matchCatalog(n.name), fair = matchFair(n.name), v = matchVisiting(n.양조장 || "");
  rows.push({
    sido: sidoOf(region), sigungu: sigunguOf(region), name: n.name, kind: n.주종 || "-", group: kindGroup(n.주종 || ""), abv: abvNum(n["알코올 도수"] || ""), volume: "", brewery: n.양조장 || "", address: n.지역 || "", ingredients: n.주원료 || "",
    intro: n.제품설명 || "", food: "", awards: "", fair: fair.map((f) => `${f.year} ${f.part} ${f.prize}`).join(" · "), visiting: v ? `○ (~${v["양조장선정유효기간년도"]})` : "",
    catalog: cat ? `○ ${cat.id} ${cat.name}` : "", homepage: "", phone: "", tags: n.제품특징 || "", source: "네이버 전통주백과(우리술 산책)", url: n.url,
  });
}
// 앱 카탈로그에만 있는 술 (더술닷컴·백과에 없음) — 지역 시트에 같이 보이도록 추가
let catalogOnly = 0;
for (const d of DATA.drinks) {
  if (rows.some((r) => r.catalog.includes(` ${d.id} `))) continue;
  catalogOnly++;
  const fair = matchFair(d.name), v = matchVisiting(d.brewery || "");
  rows.push({
    sido: sidoOfCatalogRegion(d.region || ""), sigungu: (d.region || "").split(/\s+/).slice(1).join(" "), name: d.name, kind: d.category, group: kindGroup(d.category), abv: d.abv ?? null, volume: "", brewery: d.brewery || "", address: d.region || "",
    ingredients: "", intro: d.desc || "", food: "", awards: (d.awards || []).join(", "), fair: fair.map((f) => `${f.year} ${f.part} ${f.prize}`).join(" · "), visiting: v ? `○ (~${v["양조장선정유효기간년도"]})` : "",
    catalog: `○ ${d.id} ${d.name}`, homepage: d.buy?.url || "", phone: "", tags: (d.flavor || []).join(", "), source: "페어링GO 카탈로그", url: d.buy?.url || "",
  });
}
// 수동 추가분 (research/manual-additions.json — 더술닷컴에 없는 제품, 웹 조사)
let manualAdded = 0;
for (const m of loadResearch().filter((p) => p.id.startsWith("MANUAL"))) {
  if (seen.has(norm(m.name))) continue;
  seen.add(norm(m.name)); manualAdded++;
  const cat = matchCatalog(m.name, m.brewery), fair = matchFair(m.name), v = matchVisiting(m.brewery);
  rows.push({ sido: m.sido, sigungu: m.sigungu, name: m.name, kind: m.kind, group: kindGroup(m.kind), abv: m.abv, volume: m.volume, brewery: m.brewery, address: m.address, ingredients: m.ingredients, intro: m.intro, food: "", awards: "", fair: fair.map((f) => `${f.year} ${f.part} ${f.prize}`).join(" · "), visiting: v ? `○ (~${v["양조장선정유효기간년도"]})` : "", catalog: cat ? `○ ${cat.id} ${cat.name}` : "", homepage: "", phone: "", tags: "", source: m.source, url: m.url });
}
const idx = (s: Sido) => SIDO_ORDER.indexOf(s);
rows.sort((a, b) => idx(a.sido) - idx(b.sido) || a.sigungu.localeCompare(b.sigungu, "ko") || a.brewery.localeCompare(b.brewery, "ko") || a.name.localeCompare(b.name, "ko"));

/* ---------- 엑셀 ---------- */
const wb = new ExcelJS.Workbook();
wb.creator = "페어링GO";
const HEAD_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6ECF5" } };
const COLS = [
  { header: "No", key: "no", width: 6 }, { header: "시도", key: "sidoLabel", width: 14 }, { header: "시군구", key: "sigungu", width: 14 }, { header: "술 이름", key: "name", width: 28 }, { header: "주종(aT 분류)", key: "kind", width: 14 }, { header: "대분류", key: "group", width: 10 },
  { header: "도수(%)", key: "abv", width: 8 }, { header: "용량", key: "volume", width: 10 }, { header: "양조장", key: "brewery", width: 24 }, { header: "주소", key: "address", width: 36 }, { header: "주원료", key: "ingredients", width: 26 },
  { header: "제품 특징(aT 소개)", key: "intro", width: 60 }, { header: "어울리는 음식(aT)", key: "food", width: 30 }, { header: "수상내역(aT 등록)", key: "awards", width: 26 }, { header: `우리술품평회 ${FAIR_RANGE}`, key: "fair", width: 30 },
  { header: "찾아가는 양조장", key: "visiting", width: 16 }, { header: "앱 카탈로그", key: "catalog", width: 22 }, { header: "홈페이지", key: "homepage", width: 30 }, { header: "문의", key: "phone", width: 14 }, { header: "태그", key: "tags", width: 18 }, { header: "출처", key: "source", width: 16 }, { header: "출처 URL", key: "url", width: 40 },
];
function fillSheet(ws: ExcelJS.Worksheet, list: Row[]) {
  ws.columns = COLS;
  ws.getRow(1).font = { bold: true }; ws.getRow(1).fill = HEAD_FILL;
  ws.views = [{ state: "frozen", xSplit: 4, ySplit: 1 }];
  ws.autoFilter = { from: "A1", to: `${String.fromCharCode(64 + COLS.length)}1` };
  list.forEach((r, i) => {
    const row = ws.addRow({ no: i + 1, sidoLabel: SIDO_LABEL[r.sido], ...r });
    if (r.catalog) row.getCell("catalog").font = { color: { argb: "FF1F5FAD" }, bold: true };
    if (r.fair) row.getCell("fair").font = { color: { argb: "FFB0561E" } };
    if (r.source !== "더술닷컴(aT)") row.getCell("source").font = { italic: true, color: { argb: "FF8C8C88" } };
    row.getCell("url").value = r.url ? { text: r.url.length > 60 ? r.url.slice(0, 57) + "…" : r.url, hyperlink: r.url } : "";
    row.alignment = { vertical: "top", wrapText: false };
  });
}

/* 요약 */
const ws0 = wb.addWorksheet("요약");
ws0.columns = [{ width: 30 }, { width: 12 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 14 }];
ws0.addRow([`전통주 지역별 목록 — 수집 ${COLLECTED}`]).font = { bold: true, size: 14 };
ws0.addRow([`더술닷컴(농식품부·한국농수산식품유통공사 운영) 우리술 ${products.length}종 + 네이버 전통주백과 지역 술 ${naverAdded}종 + 앱 카탈로그 전용 ${catalogOnly}종 = ${rows.length}행`]).font = { color: { argb: "FF555555" } };
ws0.addRow([]);
const H = ws0.addRow(["시도", "술 수", "양조장 수", "찾아가는 양조장", "품평회 수상 술", "앱 카탈로그", "탁주", "약·청주", "과실주", "증류주", "리큐르·기타"]); H.font = { bold: true }; H.fill = HEAD_FILL;
for (const s of SIDO_ORDER) {
  const rs = rows.filter((r) => r.sido === s);
  if (!rs.length) continue;
  const brews = new Set(rs.map((r) => normBrew(r.brewery)).filter(Boolean));
  const vis = new Set(rs.filter((r) => r.visiting).map((r) => matchVisiting(r.brewery)?.["상호명"]));
  ws0.addRow([SIDO_LABEL[s], rs.length, brews.size, vis.size, rs.filter((r) => r.fair).length, rs.filter((r) => r.catalog).length, ...["탁주", "약·청주", "과실주", "증류주", "리큐르·기타"].map((g) => rs.filter((r) => r.group === g).length)]);
}
const T = ws0.addRow(["합계", rows.length, new Set(rows.map((r) => normBrew(r.brewery)).filter(Boolean)).size, new Set(rows.filter((r) => r.visiting).map((r) => matchVisiting(r.brewery)?.["상호명"])).size, rows.filter((r) => r.fair).length, rows.filter((r) => r.catalog).length, ...["탁주", "약·청주", "과실주", "증류주", "리큐르·기타"].map((g) => rows.filter((r) => r.group === g).length)]); T.font = { bold: true };
ws0.addRow([]);
[
  "읽는 법",
  "· 시트는 시도별(서울 → 경기 → 인천 → 충남 → 세종 → 충북 → 대전 → 강원 → 전북 → 전남·광주 → 경북 → 대구 → 경남 → 울산 → 부산 → 제주). '전체 목록' 시트는 같은 열로 한 번에 필터할 수 있음.",
  "· 광주광역시는 2026-07-01 전남광주통합특별시로 통합돼 전남 시트에 함께 둠. 대구·경북은 아직 별도(통합 추진 중).",
  "· '주종(aT 분류)'은 더술닷컴 등록 기준: 탁주(저도)=8도 미만, 탁주(고도)=8도 이상. '어울리는 음식(aT)'은 양조장이 등록한 공식 추천 → 페어링 후보(official 등급) 입력에 그대로 쓸 수 있음.",
  `· '찾아가는 양조장' ○는 농식품부 선정(공공데이터포털 15048756, 유효기간 연도·상시/예약 방문 표시). '우리술품평회' 열은 ${FAIR_RANGE} 수상 이력(국가 공인 품평회, 이름 매칭이라 동명이주는 확인 필요).`,
  "· '앱 카탈로그' ○는 페어링GO에 이미 등록된 술(id). 비어 있으면 아직 앱에 없는 술 → 입점·페어링 확장 후보.",
  "· 출처: 더술닷컴(aT) 상세 페이지 URL / 네이버 전통주백과 「지역별 술」 / 페어링GO 카탈로그. 제품 특징·어울리는 음식 문구는 aT 등록 원문(공공누리 4유형: 출처표시·비상업·변경금지) → 앱에는 요약해서 재작성해 쓸 것.",
  `· 지역 미상 ${unresolved}건은 주소가 비어 있거나 상호만 있는 경우 — '미상' 시트에서 확인.`,
].forEach((t, i) => { const r = ws0.addRow([t]); if (i === 0) r.font = { bold: true }; });

/* 전체 목록 */
fillSheet(wb.addWorksheet("전체 목록"), rows);
/* 시도별 */
for (const s of SIDO_ORDER) {
  const rs = rows.filter((r) => r.sido === s);
  if (!rs.length) continue;
  const title = s === "전남" ? "전남·광주" : s === "미상" ? "미상(확인)" : s;
  fillSheet(wb.addWorksheet(`${String(idx(s) + 1).padStart(2, "0")} ${title}`), rs);
}
/* 품평회 */
const wf = wb.addWorksheet(`우리술품평회 ${FAIR_RANGE}`);
wf.columns = [{ header: "연도", key: "year", width: 8 }, { header: "부문", key: "part", width: 12 }, { header: "수상", key: "prize", width: 14 }, { header: "제품명", key: "name", width: 30 }, { header: "양조장", key: "brewery", width: 26 }, { header: "지역", key: "region", width: 14 }, { header: "앱 카탈로그", key: "catalog", width: 24 }, { header: "출처", key: "src", width: 60 }];
wf.getRow(1).font = { bold: true }; wf.getRow(1).fill = HEAD_FILL; wf.views = [{ state: "frozen", ySplit: 1 }];

for (const f of FAIR) { const cat = matchCatalog(f.name); wf.addRow({ ...f, catalog: cat ? `○ ${cat.id} ${cat.name}` : "", src: f.source }); }
/* 찾아가는 양조장 */
const wv = wb.addWorksheet("찾아가는 양조장 64");
wv.columns = [{ header: "시도", key: "sido", width: 12 }, { header: "상호명", key: "n", width: 30 }, { header: "주소", key: "a", width: 44 }, { header: "주종", key: "k", width: 30 }, { header: "홈페이지", key: "h", width: 36 }, { header: "상시방문", key: "v1", width: 9 }, { header: "예약방문", key: "v2", width: 9 }, { header: "유효기간", key: "y", width: 9 }, { header: "등록 술 수(aT)", key: "cnt", width: 12 }];
wv.getRow(1).font = { bold: true }; wv.getRow(1).fill = HEAD_FILL; wv.views = [{ state: "frozen", ySplit: 1 }];
visiting.map((v) => ({ v, s: sidoOf(v["주소"]) })).sort((a, b) => idx(a.s) - idx(b.s)).forEach(({ v, s }) => wv.addRow({ sido: SIDO_LABEL[s], n: v["상호명"], a: v["주소"], k: v["주종"], h: v["홈페이지"], v1: v["양조장상시방문가능여부"], v2: v["양조장예약방문가능여부"], y: v["양조장선정유효기간년도"], cnt: rows.filter((r) => r.source === "더술닷컴(aT)" && matchVisiting(r.brewery)?.["상호명"] === v["상호명"]).length }));
/* 출처 */
const wsrc = wb.addWorksheet("출처·기준");
wsrc.columns = [{ width: 26 }, { width: 90 }];
[
  ["더술닷컴 우리술 찾기", "https://thesool.com/front/find/M000000082/list.do — 농림축산식품부·한국농수산식품유통공사(aT) 운영 공식 전통주 DB. 제품별 종류·원재료·도수·용량·수상내역·제품소개·어울리는 음식·양조장 주소. 총 1,251건 등록(수집 시점), 상세 페이지 전수 수집"],
  ["찾아가는 양조장", "https://www.data.go.kr/data/15048756/fileData.do — 농식품부 선정 '찾아가는 양조장' 64개소 (2026·2027·2028 유효). 농식품부 공지: https://www.mafra.go.kr/bbs/home/798/587598/artclView.do"],
  ["우리술 품평회", "국내 유일 정부 주관 전통주 경연(2010~). 2024 보도자료 https://www.mafra.go.kr/bbs/home/792/579772/download.do · 2023 https://www.mafra.go.kr/bbs/home/792/570180/download.do · 2022 카탈로그 https://thesool.com/file/download.do?fileId=5915 · 2020 https://www.mafra.go.kr/bbs/mafra/68/244883/download.do · 2021/2025/2026은 언론 보도 종합(2026 수상작 목록: 식품음료신문 2026.9.8)"],
  ["네이버 전통주백과", "「향기로운 한식, 우리술 산책」 지역별 술 6항목 (docId 5701769 서울·경기·인천 / 5701768 강원 / 5701761 충청·대전 / 5701760 전라·광주 / 5701763 경상·대구·부산·울산 / 5701762 제주) — 무형문화재·식품명인·품평회·찾아가는 양조장·지역 매출 상위 기준 선정"],
  ["행정구역", "2026-07-01 전남광주통합특별시 출범(전남+광주). 강원·전북은 특별자치도. 대구경북·충남대전·부산경남 통합은 추진 중(미출범)"],
  ["주의", "aT 등록 문구는 공공누리 제4유형(출처표시·비상업·변경금지)이라 앱 화면에는 그대로 싣지 말고 요약·재작성. 도수·용량은 등록 시점 값이라 제품 변경 시 다를 수 있음. 이름 매칭(품평회·카탈로그)은 자동이라 동명이주는 검수 필요"],
].forEach(([k, v], i) => { const r = wsrc.addRow([k, v]); r.getCell(1).font = { bold: true }; r.alignment = { vertical: "top", wrapText: true }; void i; });

await wb.xlsx.writeFile(out);
console.log(`→ ${out}`);
console.log(`aT ${products.length} · 백과 추가 ${naverAdded} · 카탈로그 전용 ${catalogOnly} · 총 ${rows.length}행 · 지역 미상 ${unresolved}`);
for (const s of SIDO_ORDER) { const n = rows.filter((r) => r.sido === s).length; if (n) console.log(`  ${SIDO_LABEL[s].padEnd(20)} ${n}`); }
const matchedIds = new Set(rows.filter((r) => r.catalog && r.source === "더술닷컴(aT)").map((r) => r.catalog.split(" ")[1]));
console.log(`앱 카탈로그 매칭 ${matchedIds.size}/${DATA.drinks.length} 종(aT 행 ${rows.filter((r) => r.catalog && r.source === "더술닷컴(aT)").length}) · 품평회 매칭 ${rows.filter((r) => r.fair).length} · 찾아가는 양조장 매칭 ${new Set(rows.filter((r) => r.visiting).map((r) => matchVisiting(r.brewery)?.["상호명"])).size}/64`);
if (process.env.DEBUG) {
  console.log("--- 카탈로그 매칭 (aT 이름 → 카탈로그) ---");
  for (const r of rows.filter((r) => r.catalog && r.source === "더술닷컴(aT)")) console.log(`${r.name} [${r.brewery}] → ${r.catalog}`);
  console.log("--- 카탈로그에 없는 술 ---", DATA.drinks.filter((d) => !matchedIds.has(d.id)).map((d) => d.name).join(", "));
  console.log("--- 지역 미상 ---");
  for (const r of rows.filter((r) => r.sido === "미상")) console.log(`${r.name} [${r.brewery}] "${r.address}" (${r.source})`);
}
