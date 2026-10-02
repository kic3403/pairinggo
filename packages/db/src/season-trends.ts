/**
 * 계절별·날씨별 검색 관심 데이터(2026-10-02) — 네이버 데이터랩 검색어 트렌드(NAVER API HUB)로 술 종류·음식 묶음의 월별 지수(3년)와
 * 일별 지수(2년, 날씨 대조용)를 받아 보고서(docs/28)와 엑셀(research/season-trends/)로 만든다. 날씨·계절 추천 규칙을 정하기 전의 근거 자료.
 *   pnpm --filter @pairinggo/db season-trends             받은 적 있으면 raw.json을 쓰고(할당량 아낌) 보고서만 다시 만든다
 *   pnpm --filter @pairinggo/db season-trends --fresh     다시 받는다(하루 1,000회 가운데 30회쯤)
 *   pnpm --filter @pairinggo/db season-trends --weather   기상청 ASOS 일자료(공공데이터포털 활용신청 필요)로 비·기온 대조까지
 *
 * - 주소: https://naverapihub.apigw.ntruss.com/search-trend/v1/search (2026-10-02 실측 — 개발자센터 openapi.naver.com은 신규 등록 중단)
 * - 키: packages/db/.env의 NCP_API_KEY_ID·NCP_API_KEY(쇼핑인사이트와 같은 앱, 채팅·커밋 금지)
 * - 지수는 요청 안 상대값(최댓값 100)이라 묶음끼리 크기 비교 금지 → shared season-trends.ts seasonalIndex로 묶음마다 평균 100으로 다시 놓는다.
 * - 한 요청에 묶음 5개·묶음마다 낱말 20개까지. 같은 요청에 넣은 묶음끼리만 같은 눈금.
 */
import "dotenv/config";
import ExcelJS from "exceljs";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SEASON_KO, peakTrough, seasonIndex, seasonalIndex, seasonalityLabel, splitByDay, tempBand, type Season, type TrendPoint } from "@pairinggo/shared";

const here = dirname(fileURLToPath(import.meta.url));
const DIR = join(here, "..", "research", "season-trends");
const DOC = join(here, "..", "..", "..", "docs", "28_계절_날씨_검색_데이터.md");
const fresh = process.argv.includes("--fresh"), weather = process.argv.includes("--weather");

/** 묶음 — 사람들이 실제로 치는 말로. '소주'는 희석식이 압도해 '안동소주·증류식 소주'로, '와인'은 모든 와인 */
type Group = { name: string; keywords: string[]; side: "술" | "음식" | "상황" };
const GROUPS: Group[] = [
  { side: "술", name: "막걸리", keywords: ["막걸리", "탁주", "생막걸리"] },
  { side: "술", name: "약주·청주", keywords: ["약주", "한국 청주", "전통 청주", "약주 추천", "청주 술"] },   // "청주"만 쓰면 청주시가 섞인다(2026-10-02 실측)
  { side: "술", name: "전통소주", keywords: ["안동소주", "증류식 소주", "전통소주", "화요", "문배주", "진도홍주"] },
  { side: "술", name: "과실주", keywords: ["복분자주", "오미자주", "과실주", "한국 와인", "사과와인"] },   // 매실주는 6월 담금 철 검색이라 뺀다
  { side: "술", name: "와인", keywords: ["와인", "레드와인", "화이트와인", "스파클링 와인"] },
  { side: "술", name: "위스키", keywords: ["위스키", "싱글몰트", "하이볼"] },
  { side: "술", name: "사케", keywords: ["사케", "니혼슈", "준마이"] },
  { side: "술", name: "맥주", keywords: ["맥주", "수제맥주"] },
  { side: "음식", name: "전·부침개", keywords: ["파전", "해물파전", "부침개", "김치전", "감자전", "빈대떡"] },
  { side: "음식", name: "냉면·물회", keywords: ["냉면", "물회", "막국수", "비빔국수", "평양냉면"] },
  { side: "음식", name: "국물·전골", keywords: ["전골", "어묵탕", "샤브샤브", "감자탕", "대구탕", "홍합탕"] },
  { side: "음식", name: "치킨", keywords: ["치킨", "후라이드치킨", "양념치킨"] },
  { side: "음식", name: "회", keywords: ["광어회", "방어회", "모둠회", "숙성회", "활어회", "회 포장"] },   // "회"만 쓰면 회식·송년회가 섞인다
  { side: "음식", name: "구이·고기", keywords: ["삼겹살", "대하구이", "장어구이", "조개구이", "곱창"] },
  { side: "음식", name: "안주", keywords: ["안주", "술안주", "막걸리 안주", "소주 안주", "와인 안주"] },
  { side: "상황", name: "비 오는 날 술·안주", keywords: ["비오는날 막걸리", "비오는날 파전", "비오는날 안주", "비오는날 술", "비 오는 날 막걸리"] },
  { side: "상황", name: "추운 날 술", keywords: ["따뜻한 술", "데운 술", "뱅쇼", "따뜻한 사케", "겨울 술"] },
  { side: "상황", name: "더운 날 술", keywords: ["시원한 술", "여름 술", "여름 안주", "차가운 술"] },
];
const MONTH_FROM = "2023-10-01", MONTH_TO = "2026-09-30";   // 3년(36달)
const DAY_FROM = "2024-10-01", DAY_TO = "2026-09-30";       // 2년(날씨 대조)
/** 데이터랩 연령 코드 — 3:19~24 · 4:25~29 · 5:30~34 · 6:35~39 · 7:40~44 · 8:45~49 · 9:50~54 · 10:55~59 · 11:60↑ (만 19세 미만은 뺀다) */
const AGES = [["20", "20대", ["3", "4"]], ["30", "30대", ["5", "6"]], ["40", "40대", ["7", "8"]], ["50", "50대 이상", ["9", "10", "11"]]] as const;

type Raw = { monthly: Record<string, TrendPoint[]>; daily: Record<string, TrendPoint[]>; byAge: Record<string, Record<string, TrendPoint[]>>; byGender: Record<string, Record<string, TrendPoint[]>>; fetchedAt: string; calls: number };

async function datalab(body: Record<string, unknown>): Promise<{ title: string; data: TrendPoint[] }[]> {
  const id = process.env.NCP_API_KEY_ID, key = process.env.NCP_API_KEY;
  if (!id || !key) throw new Error("packages/db/.env에 NCP_API_KEY_ID·NCP_API_KEY가 필요합니다");
  const r = await fetch("https://naverapihub.apigw.ntruss.com/search-trend/v1/search", { method: "POST", headers: { "X-NCP-APIGW-API-KEY-ID": id, "X-NCP-APIGW-API-KEY": key, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`데이터랩 ${r.status}: ${(await r.text()).slice(0, 160)}`);
  const j = (await r.json()) as { results: { title: string; data: TrendPoint[] }[] };
  return j.results;
}
const chunk = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

async function fetchAll(): Promise<Raw> {
  const raw: Raw = { monthly: {}, daily: {}, byAge: {}, byGender: {}, fetchedAt: new Date().toISOString(), calls: 0 };
  const req = async (groups: Group[], extra: Record<string, unknown>, into: Record<string, TrendPoint[]>) => {
    for (const batch of chunk(groups, 5)) {
      const res = await datalab({ ...extra, keywordGroups: batch.map((g) => ({ groupName: g.name, keywords: g.keywords })) });
      raw.calls++;
      for (const r of res) into[r.title] = r.data;
      await new Promise((ok) => setTimeout(ok, 250));
    }
  };
  console.log("월별 3년치 받는 중…");
  await req(GROUPS, { startDate: MONTH_FROM, endDate: MONTH_TO, timeUnit: "month" }, raw.monthly);
  console.log("일별 2년치(날씨 대조용) 받는 중…");
  await req(GROUPS.filter((g) => ["막걸리", "전통소주", "약주·청주", "전·부침개", "냉면·물회", "국물·전골", "비 오는 날 술·안주", "추운 날 술", "더운 날 술", "와인"].includes(g.name)), { startDate: DAY_FROM, endDate: DAY_TO, timeUnit: "date" }, raw.daily);
  console.log("연령대·성별(술 묶음만) 받는 중…");
  const drinks = GROUPS.filter((g) => g.side === "술");
  for (const [k, , ages] of AGES) { raw.byAge[k] = {}; await req(drinks, { startDate: MONTH_FROM, endDate: MONTH_TO, timeUnit: "month", ages: [...ages] }, raw.byAge[k]); }
  for (const g of ["m", "f"] as const) { raw.byGender[g] = {}; await req(drinks, { startDate: MONTH_FROM, endDate: MONTH_TO, timeUnit: "month", gender: g }, raw.byGender[g]); }
  return raw;
}

/* ---------- 기상청 ASOS 일자료(서울 108) — --weather 때만 ---------- */
type Day = { date: string; avgTa: number | null; sumRn: number | null };
async function asosSeoul(from: string, to: string): Promise<Day[] | null> {
  const key = process.env.DATA_GO_KR_KEY; if (!key) return null;
  const out: Day[] = [];
  for (let page = 1; page <= 10; page++) {
    const u = new URL("https://apis.data.go.kr/1360000/AsosDalyInfoService/getWthrDataList");
    Object.entries({ serviceKey: key, pageNo: String(page), numOfRows: "999", dataType: "JSON", dataCd: "ASOS", dateCd: "DAY", startDt: from.replace(/-/g, ""), endDt: to.replace(/-/g, ""), stnIds: "108" }).forEach(([k, v]) => u.searchParams.set(k, v));
    const r = await fetch(u, { signal: AbortSignal.timeout(20000) });
    const t = await r.text();
    if (!r.ok || !t.trim().startsWith("{")) { console.log("기상청 응답:", r.status, t.replace(/\s+/g, " ").slice(0, 160)); return null; }
    const j = JSON.parse(t) as { response: { header: { resultCode: string; resultMsg: string }; body?: { items?: { item: Record<string, string>[] }; totalCount: number } } };
    if (j.response.header.resultCode !== "00") { console.log("기상청:", j.response.header.resultMsg); return null; }
    const items = j.response.body?.items?.item ?? [];
    for (const it of items) out.push({ date: it.tm, avgTa: it.avgTa === "" ? null : Number(it.avgTa), sumRn: it.sumRn === "" ? 0 : Number(it.sumRn) });
    if (out.length >= (j.response.body?.totalCount ?? 0)) break;
  }
  return out;
}

/* ---------- 보고서 ---------- */
const MON = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
const SEASONS: Season[] = ["spring", "summer", "autumn", "winter"];
const fmt = (n: number) => (n ? String(Math.round(n)) : "-");

function report(raw: Raw, days: Day[] | null): { md: string; rows: Record<string, unknown>[] } {
  const L: string[] = [];
  const rows: Record<string, unknown>[] = [];
  L.push("# 계절별·날씨별 검색 관심 데이터 (2026-10-02)", "", `네이버 데이터랩 검색어 트렌드(NAVER API HUB) — 월별 ${MONTH_FROM}~${MONTH_TO}(3년), 일별 ${DAY_FROM}~${DAY_TO}(2년). 받은 시각 ${raw.fetchedAt.slice(0, 16).replace("T", " ")} UTC, 호출 ${raw.calls}번. 스크립트 \`packages/db season-trends\`, 계산 규칙 \`shared/season-trends.ts\`, 원본 \`research/season-trends/raw.json\`.`, "",
    "**읽는 법** — 데이터랩 지수는 요청 안 상대값이라 묶음끼리 크기를 비교할 수 없다. 아래 표는 묶음마다 **3년 평균을 100**으로 놓은 계절 지수다. 120이면 평소보다 20% 더 찾는 달. '소주'는 희석식이 압도해 안동소주·증류식 소주 묶음으로 봤고, '와인'은 모든 와인이다. 검색 관심 ≠ 구매지만 지금 얻을 수 있는 가장 좋은 대리 지표다.", "");
  for (const side of ["술", "음식", "상황"] as const) {
    L.push(`## ${side === "술" ? "술 종류별" : side === "음식" ? "음식 묶음별" : "상황 검색어"} 월별 계절 지수`, "", `| 묶음 | ${MON.join(" | ")} | 최고 | 최저 | 차이 | 계절성 |`, `|---|${MON.map(() => "---:").join("|")}|---|---|---:|---|`);
    for (const g of GROUPS.filter((x) => x.side === side)) {
      const pts = raw.monthly[g.name]; if (!pts) continue;
      const idx = seasonalIndex(pts), pk = peakTrough(idx), s = seasonIndex(idx);
      L.push(`| ${g.name} | ${MON.map((_, i) => fmt(idx[i + 1])).join(" | ")} | ${MON[pk.peak - 1]} | ${MON[pk.trough - 1]} | ${pk.ratio}배 | ${seasonalityLabel(pk.ratio)} |`);
      rows.push({ 구분: side, 묶음: g.name, 검색어: g.keywords.join(", "), ...Object.fromEntries(MON.map((m, i) => [m, idx[i + 1]])), ...Object.fromEntries(SEASONS.map((x) => [SEASON_KO[x], s[x]])), 최고: MON[pk.peak - 1], 최저: MON[pk.trough - 1], 차이배: pk.ratio, 계절성: seasonalityLabel(pk.ratio) });
    }
    L.push("");
    L.push(`| 묶음 | ${SEASONS.map((x) => SEASON_KO[x]).join(" | ")} |`, `|---|---:|---:|---:|---:|`);
    for (const g of GROUPS.filter((x) => x.side === side)) { const pts = raw.monthly[g.name]; if (!pts) continue; const s = seasonIndex(seasonalIndex(pts)); L.push(`| ${g.name} | ${SEASONS.map((x) => fmt(s[x])).join(" | ")} |`); }
    L.push("");
  }
  // 연령대·성별 — 술 묶음의 계절 지수가 사람에 따라 다른지(겨울 고도수가 특정 연령대 이야기인지)
  L.push("## 연령대별 — 술 묶음의 계절 평균 지수", "", "같은 묶음을 연령대마다 따로 받아 각각 평균 100으로 놓았다. 숫자가 비슷하면 계절 흐름이 연령과 무관하다는 뜻.", "");
  L.push(`| 묶음 | 연령대 | ${SEASONS.map((x) => SEASON_KO[x]).join(" | ")} | 최고 | 최저 |`, `|---|---|---:|---:|---:|---:|---|---|`);
  for (const g of GROUPS.filter((x) => x.side === "술")) for (const [k, label] of AGES) {
    const pts = raw.byAge[k]?.[g.name]; if (!pts) continue;
    const idx = seasonalIndex(pts), s = seasonIndex(idx), pk = peakTrough(idx);
    L.push(`| ${g.name} | ${label} | ${SEASONS.map((x) => fmt(s[x])).join(" | ")} | ${MON[pk.peak - 1]} | ${MON[pk.trough - 1]} |`);
    rows.push({ 구분: "연령대", 묶음: g.name, 연령대: label, ...Object.fromEntries(SEASONS.map((x) => [SEASON_KO[x], s[x]])), 최고: MON[pk.peak - 1], 최저: MON[pk.trough - 1] });
  }
  L.push("", "## 성별 — 술 묶음의 계절 평균 지수", "", `| 묶음 | 성별 | ${SEASONS.map((x) => SEASON_KO[x]).join(" | ")} | 최고 | 최저 |`, `|---|---|---:|---:|---:|---:|---|---|`);
  for (const g of GROUPS.filter((x) => x.side === "술")) for (const [k, label] of [["m", "남"], ["f", "여"]] as const) {
    const pts = raw.byGender[k]?.[g.name]; if (!pts) continue;
    const idx = seasonalIndex(pts), s = seasonIndex(idx), pk = peakTrough(idx);
    L.push(`| ${g.name} | ${label} | ${SEASONS.map((x) => fmt(s[x])).join(" | ")} | ${MON[pk.peak - 1]} | ${MON[pk.trough - 1]} |`);
    rows.push({ 구분: "성별", 묶음: g.name, 성별: label, ...Object.fromEntries(SEASONS.map((x) => [SEASON_KO[x], s[x]])), 최고: MON[pk.peak - 1], 최저: MON[pk.trough - 1] });
  }
  // 날씨 대조
  L.push("", "## 날씨 대조 — 서울, 일별 2년치");
  if (!days) {
    L.push("", "기상청 지상관측(ASOS) 일자료를 아직 받지 못했다(공공데이터포털 활용신청 뒤 `--weather`로 다시). 일별 검색 지수는 `raw.json`에 받아 두었다.", "");
  } else {
    const rainMap = new Map(days.map((d) => [d.date, (d.sumRn ?? 0) >= 1 ? "비·눈 1mm↑" : "안 옴"]));
    const tempMap = new Map(days.filter((d) => d.avgTa != null).map((d) => [d.date, tempBand(d.avgTa!)]));
    L.push("", `기상청 서울(108) 일자료 ${days.length}일. 비 온 날 = 일 강수량 1mm 이상. 묶음마다 일별 지수의 평균을 비교한다(지수는 그 묶음 요청 안 상대값이라 묶음끼리 비교는 안 됨).`, "", "| 묶음 | 비·눈 온 날 평균 | 안 온 날 평균 | 비 온 날 ÷ 안 온 날 |", "|---|---:|---:|---:|");
    for (const [name, pts] of Object.entries(raw.daily)) {
      const r = splitByDay(pts, rainMap); const a = r["비·눈 1mm↑"], b = r["안 옴"]; if (!a || !b) continue;
      L.push(`| ${name} | ${a.mean} (${a.days}일) | ${b.mean} (${b.days}일) | ${b.mean ? Math.round((a.mean / b.mean) * 100) / 100 : "-"}배 |`);
      rows.push({ 구분: "비", 묶음: name, 비온날평균: a.mean, 비온날수: a.days, 안온날평균: b.mean, 안온날수: b.days, 배: b.mean ? Math.round((a.mean / b.mean) * 100) / 100 : null });
    }
    const bands = ["5℃ 미만", "5~15℃", "15~25℃", "25℃ 이상"];
    L.push("", "| 묶음 | " + bands.join(" | ") + " |", "|---|---:|---:|---:|---:|");
    for (const [name, pts] of Object.entries(raw.daily)) {
      const r = splitByDay(pts, tempMap);
      L.push(`| ${name} | ${bands.map((b) => (r[b] ? `${r[b].mean} (${r[b].days}일)` : "-")).join(" | ")} |`);
      rows.push({ 구분: "기온", 묶음: name, ...Object.fromEntries(bands.map((b) => [b, r[b]?.mean ?? null])) });
    }
    L.push("");
  }
  L.push("## 묶음에 넣은 검색어", "", ...GROUPS.map((g) => `- **${g.name}**(${g.side}): ${g.keywords.join(", ")}`), "");
  return { md: L.join("\n"), rows };
}

async function writeXlsx(rows: Record<string, unknown>[], raw: Raw) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("계절 지수");
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  ws.columns = keys.map((k) => ({ header: k, key: k, width: Math.min(28, Math.max(8, k.length + 4)) }));
  for (const r of rows) ws.addRow(r);
  ws.getRow(1).font = { bold: true };
  const m = wb.addWorksheet("월별 원본(지수)");
  const names = Object.keys(raw.monthly); const periods = raw.monthly[names[0]]?.map((p) => p.period.slice(0, 7)) ?? [];
  m.columns = [{ header: "월", key: "p", width: 10 }, ...names.map((n) => ({ header: n, key: n, width: 12 }))];
  periods.forEach((p, i) => m.addRow({ p, ...Object.fromEntries(names.map((n) => [n, raw.monthly[n][i]?.ratio ?? null])) }));
  m.getRow(1).font = { bold: true };
  const d = wb.addWorksheet("일별 원본(지수)");
  const dn = Object.keys(raw.daily); const dp = raw.daily[dn[0]]?.map((p) => p.period.slice(0, 10)) ?? [];
  d.columns = [{ header: "날짜", key: "p", width: 12 }, ...dn.map((n) => ({ header: n, key: n, width: 12 }))];
  dp.forEach((p, i) => d.addRow({ p, ...Object.fromEntries(dn.map((n) => [n, raw.daily[n][i]?.ratio ?? null])) }));
  d.getRow(1).font = { bold: true };
  const out = join(DIR, "season-trends.xlsx");
  await wb.xlsx.writeFile(out);
  return out;
}

mkdirSync(DIR, { recursive: true });
const rawPath = join(DIR, "raw.json");
let raw: Raw;
if (!fresh && existsSync(rawPath)) { raw = JSON.parse(readFileSync(rawPath, "utf8")); console.log(`받아 둔 데이터 사용(${raw.fetchedAt.slice(0, 10)}) — 다시 받으려면 --fresh`); }
else { raw = await fetchAll(); writeFileSync(rawPath, JSON.stringify(raw)); console.log(`받기 완료 — 호출 ${raw.calls}번 → ${rawPath}`); }
let days: Day[] | null = null;
if (weather) { days = await asosSeoul(DAY_FROM, DAY_TO); if (days) { writeFileSync(join(DIR, "seoul-asos.json"), JSON.stringify(days)); console.log(`기상청 서울 일자료 ${days.length}일`); } }
else if (existsSync(join(DIR, "seoul-asos.json"))) days = JSON.parse(readFileSync(join(DIR, "seoul-asos.json"), "utf8"));
const { md, rows } = report(raw, days);
writeFileSync(DOC, md);
const x = await writeXlsx(rows, raw);
console.log(`보고서 → ${DOC}\n엑셀 → ${x}`);
