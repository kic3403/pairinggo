/**
 * 엑셀 템플릿 생성 — templates/pairing-candidates.xlsx
 *   pnpm db:template
 * 시트: 후보(입력) · 술 목록 · 음식 목록 · 작성법
 */
import ExcelJS from "exceljs";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DATA } from "@pairinggo/shared";
import { SIDO_ORDER, SIDO_LABEL, sidoOfCatalogRegion, type Sido } from "./sido";
import { productsOfBrewery, norm } from "./research";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "templates");
mkdirSync(dir, { recursive: true });
const out = join(dir, "pairing-candidates.xlsx");

const wb = new ExcelJS.Workbook();
wb.creator = "페어링GO";

/* ---------- 후보 ---------- */
const ws = wb.addWorksheet("후보", { views: [{ state: "frozen", ySplit: 1 }] });
export const COLUMNS = [
  { header: "술이름*", key: "drink", width: 22 },
  { header: "음식이름*", key: "food", width: 16 },
  { header: "추천이유", key: "reason", width: 48 },
  { header: "출처명", key: "source", width: 22 },
  { header: "출처URL", key: "url", width: 40 },
  { header: "인용문(120자 이내)", key: "quote", width: 48 },
  { header: "추천자(이름·직함)", key: "who", width: 20 },
  { header: "출처등급", key: "tier", width: 12 },
  { header: "점수(84~97)", key: "score", width: 12 },
  { header: "메모", key: "note", width: 24 },
];
ws.columns = COLUMNS;
ws.getRow(1).font = { bold: true };
ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6ECF5" } };
const examples = [
  { drink: "복순도가 손막걸리", food: "육회", reason: "탄산과 산미가 육회의 기름기를 씻어주고 고소함만 남긴다", source: "복순도가 공식몰", url: "https://boksoon.com", quote: "육회와 함께 드시면 좋습니다", who: "복순도가", tier: "official", score: 96, note: "" },
  { drink: "한산소곡주", food: "간장게장", reason: "진한 단맛이 게장의 짠맛과 감칠맛을 감싼다", source: "OO 소믈리에 인터뷰", url: "https://example.com/interview", quote: "한산소곡주엔 게장이 최고", who: "홍길동 (전통주 소믈리에)", tier: "sommelier", score: 93, note: "" },
  { drink: "문배주", food: "육전", reason: "높은 도수가 기름진 전을 깔끔하게 정리", source: "매일경제", url: "https://www.mk.co.kr/...", quote: "", who: "", tier: "media", score: "", note: "점수 비우면 등급 기본값(media 89)" },
];
for (const e of examples) ws.addRow(e);
for (let r = 2; r <= 500; r++) {
  ws.getCell(`H${r}`).dataValidation = { type: "list", allowBlank: true, formulae: ['"official,sommelier,media,blog,user"'], showErrorMessage: true, error: "official / sommelier / media / blog / user 중 하나" };
  ws.getCell(`I${r}`).dataValidation = { type: "whole", allowBlank: true, operator: "between", formulae: [84, 97], showErrorMessage: true, error: "84~97 사이 정수" };
}
ws.getRow(2).font = { italic: true, color: { argb: "FF8C8C88" } };
ws.getRow(3).font = { italic: true, color: { argb: "FF8C8C88" } };
ws.getRow(4).font = { italic: true, color: { argb: "FF8C8C88" } };

/* ---------- 술·음식 목록 ---------- */
// 술 목록은 시도별로 묶어서 (서울 → 경기 → 인천 → 충남 → 세종 → 충북 → 대전 → 강원 → 전북 → 전남·광주 → 경북 → 대구 → 경남 → 울산 → 부산 → 제주)
// 앱에 등록된 108종 + 같은 양조장의 다른 제품(더술닷컴 등록 기준, 양조장당 최대 3종) + 추가 양조장(세종 사일로·백경증류소)
const EXTRA_PER_BREWERY = 3;
const EXTRA_BREWERIES = ["사일로 브루어리", "백경증류소"];
const wd = wb.addWorksheet("술 목록", { views: [{ state: "frozen", ySplit: 1 }] });
wd.columns = [{ header: "시도", key: "sido", width: 12 }, { header: "시군구", key: "sigungu", width: 10 }, { header: "이름", key: "name", width: 26 }, { header: "별칭", key: "alias", width: 16 }, { header: "종류", key: "category", width: 12 }, { header: "도수", key: "abv", width: 8 }, { header: "양조장", key: "brewery", width: 18 }, { header: "앱 등록", key: "inApp", width: 8 }, { header: "현재 페어링 수", key: "n", width: 12 }, { header: "출처", key: "source", width: 18 }];
wd.getRow(1).font = { bold: true };
wd.autoFilter = "A1:J1";
const cnt = new Map<string, number>(); for (const p of DATA.pairings) cnt.set(p.d, (cnt.get(p.d) || 0) + 1);
const sidoIdx = (s: string) => { const i = SIDO_ORDER.indexOf(s as (typeof SIDO_ORDER)[number]); return i < 0 ? 99 : i; };
type ListRow = { sido: Sido; sigungu: string; name: string; alias: string; category: string; abv: number | null; brewery: string; inApp: boolean; n: number; source: string };
const list: ListRow[] = DATA.drinks.map((d) => ({ sido: sidoOfCatalogRegion(d.region || ""), sigungu: (d.region || "").split(/\s+/).slice(1).join(" "), name: d.name, alias: d.alias, category: d.category, abv: d.abv ?? null, brewery: d.brewery || "", inApp: true, n: cnt.get(d.id) || 0, source: "앱 카탈로그" }));
const catalogKeys = [...new Set(list.flatMap((r) => [norm(r.name), norm(r.alias)]).filter((k) => k.length >= 4))];
const known = new Set(list.map((r) => norm(r.name)));
const addFromBrewery = (brewery: string, sidoHint: Sido, limit: number) => {
  let added = 0;
  for (const p of productsOfBrewery(brewery)) {
    const k = norm(p.name);
    // 이미 앱에 있는 술(용량·도수 표기만 다른 것, 예: "나루 생 막걸리 6도" → 나루 생막걸리 6도)은 제외 — 비교는 앱 카탈로그 이름·별칭에만.
    // 이름 뒤에 "붉은말 에디션"처럼 별도 제품명이 붙으면 다른 제품으로 보고 남긴다
    const isVariant = (x: string) => (k.includes(x) && /^[0-9.도%ml리터생]*$/.test(k.replace(x, ""))) || (x.includes(k) && k.length >= 4);
    if (!k || known.has(k) || catalogKeys.some(isVariant)) continue;
    if (added >= limit && !p.id.startsWith("MANUAL")) continue;
    known.add(k); added++;
    list.push({ sido: p.sido === "미상" ? sidoHint : p.sido, sigungu: p.sigungu, name: p.name, alias: "", category: p.kind, abv: p.abv, brewery: p.brewery, inApp: false, n: 0, source: p.source });
  }
};
for (const d of DATA.drinks) if (d.brewery) addFromBrewery(d.brewery, sidoOfCatalogRegion(d.region || ""), EXTRA_PER_BREWERY);
for (const b of EXTRA_BREWERIES) addFromBrewery(b, "세종", EXTRA_PER_BREWERY);
list.sort((a, b) => sidoIdx(a.sido) - sidoIdx(b.sido) || a.sigungu.localeCompare(b.sigungu, "ko") || a.brewery.localeCompare(b.brewery, "ko") || Number(b.inApp) - Number(a.inApp) || a.name.localeCompare(b.name, "ko"));
let prevSido = "";
for (const r of list) {
  const row = wd.addRow({ ...r, sido: SIDO_LABEL[r.sido], inApp: r.inApp ? "○" : "×" });
  if (!r.inApp) { row.font = { color: { argb: "FF6B6B66" } }; row.getCell("inApp").font = { color: { argb: "FFB0561E" }, bold: true }; }
  if (r.sido !== prevSido) { row.getCell("sido").font = { bold: true, color: r.inApp ? undefined : { argb: "FF6B6B66" } }; row.border = { top: { style: "thin", color: { argb: "FF22406B" } } }; prevSido = r.sido; }
}
const inAppCount = list.filter((r) => r.inApp).length;
const wf = wb.addWorksheet("음식 목록");
wf.columns = [{ header: "이름", key: "name", width: 20 }, { header: "분류", key: "category", width: 10 }, { header: "맛 태그", key: "tags", width: 24 }, { header: "별칭", key: "alias", width: 16 }, { header: "현재 페어링 수", key: "n", width: 12 }];
wf.getRow(1).font = { bold: true };
const fcnt = new Map<string, number>(); for (const p of DATA.pairings) fcnt.set(p.f, (fcnt.get(p.f) || 0) + 1);
for (const f of DATA.foods) wf.addRow({ name: f.name, category: f.category, tags: f.tags.join(", "), alias: (f.alias || []).join(", "), n: fcnt.get(f.id) || 0 });

/* ---------- 작성법 ---------- */
const wg = wb.addWorksheet("작성법");
wg.columns = [{ width: 100 }];
[
  "페어링GO 후보 입력 양식 — 한 줄 = 술 하나 × 음식 하나 × 근거 하나",
  "",
  "1. 술이름·음식이름은 '술 목록'·'음식 목록' 시트의 이름을 그대로 쓰면 자동 매칭됩니다. 별칭(복순도가)도 됩니다. 목록에 없는 이름은 그대로 적어 두면 '확인 필요'로 들어가 검수 화면에서 지정합니다.",
  "   '술 목록'의 '앱 등록' ×(회색 줄)는 같은 양조장의 다른 제품(더술닷컴 등록 기준, 양조장당 최대 3종)으로 아직 앱에 없는 술입니다. 그 이름으로 후보를 적으면 '확인 필요'로 들어오고, 승인 전에 술을 카탈로그에 추가해야 합니다(추가 요청은 운영자에게).",
  "2. 출처등급: official(양조장·제조사가 직접) / sommelier(실명 소믈리에·명인·양조장 대표 발언) / media(전문 매체·기사) / blog(블로그·카페 후기) / user(지인·본인 시음)",
  "3. 점수대: official 95~97 · sommelier 92~94 · media 88~91 · blog·user 84~87. 비우면 등급 기본값이 들어갑니다.",
  "4. 인용문은 원문 그대로 120자 이내로 짧게, 출처URL은 반드시. 통째로 옮겨 적지 마세요(저작권). 검수 시 출처와 링크가 함께 표시됩니다.",
  "5. 같은 조합에 근거가 여러 개면 줄을 여러 개 쓰세요. 근거 2개 이상이거나 official/sommelier 1개면 승인 시 바로 게시(curated)됩니다.",
  "6. 저장 후: pnpm db:import 파일경로.xlsx  → 결과 요약과 확인 필요 목록(import-report.md)이 나옵니다.",
  "7. 예시 3줄(회색 글씨)은 가져오기에서 자동으로 건너뜁니다. 지우고 써도 됩니다.",
].forEach((t) => wg.addRow([t]));
wg.getRow(1).font = { bold: true, size: 13 };

/* ---------- 규격·가격 (2026-09-24, specs-import 입력) ---------- */
const wsp = wb.addWorksheet("규격·가격", { views: [{ state: "frozen", ySplit: 1 }] });
wsp.columns = [
  { header: "술(id 또는 이름)*", key: "drink", width: 24 }, { header: "용량(mL)", key: "ml", width: 10 }, { header: "도수", key: "abv", width: 8 }, { header: "빈티지", key: "vintage", width: 10 },
  { header: "병수(세트면 2 이상)", key: "bottles", width: 12 }, { header: "가격(원)", key: "krw", width: 12 }, { header: "가격유형(msrp|retail)", key: "type", width: 14 }, { header: "출처*", key: "source", width: 22 },
  { header: "출처URL", key: "url", width: 40 }, { header: "확인일(YYYY-MM-DD)*", key: "checked", width: 16 }, { header: "메모", key: "note", width: 24 },
];
wsp.getRow(1).font = { bold: true };
wsp.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6ECF5" } };
[
  { drink: "d01", ml: 935, abv: 6.5, vintage: "", bottles: 1, krw: 12000, type: "retail", source: "양조장 공식몰", url: "https://boksoon.com", checked: "2026-09-24", note: "예시 — 가져오기에서 건너뜁니다" },
].forEach((r) => wsp.addRow(r));
wsp.getRow(2).font = { italic: true, color: { argb: "FF8C8C88" } };
for (let r = 2; r <= 500; r++) wsp.getCell(`G${r}`).dataValidation = { type: "list", allowBlank: true, formulae: ['"msrp,retail"'], showErrorMessage: true, error: "msrp(권장소비자가) / retail(판매처 가격)" };
wsp.addRow([]); wsp.addRow(["작성법: 한 줄 = 술 × 규격(용량·빈티지·병수) × 가격 하나. 용량은 '720ml'·'1.8L'도 됩니다(0 금지, 모르면 비움). 가격은 그 규격 한 병 기준, 배송비·쿠폰 제외. 가격을 비우면 규격만 만듭니다. 같은 규격의 옛 가격은 자동으로 무효 처리되고 새 가격이 더해집니다."]);

await wb.xlsx.writeFile(out);
console.log(`템플릿 생성 → ${out} · 술 목록 ${list.length}행(앱 등록 ${inAppCount} + 양조장 추가 제품 ${list.length - inAppCount}) · 음식 ${DATA.foods.length}`);
