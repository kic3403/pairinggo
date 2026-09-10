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
const wd = wb.addWorksheet("술 목록");
wd.columns = [{ header: "이름", key: "name", width: 26 }, { header: "별칭", key: "alias", width: 16 }, { header: "종류", key: "category", width: 10 }, { header: "도수", key: "abv", width: 8 }, { header: "지역", key: "region", width: 14 }, { header: "양조장", key: "brewery", width: 18 }, { header: "현재 페어링 수", key: "n", width: 12 }];
wd.getRow(1).font = { bold: true };
const cnt = new Map<string, number>(); for (const p of DATA.pairings) cnt.set(p.d, (cnt.get(p.d) || 0) + 1);
for (const d of DATA.drinks) wd.addRow({ name: d.name, alias: d.alias, category: d.category, abv: d.abv, region: d.region, brewery: d.brewery, n: cnt.get(d.id) || 0 });
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
  "2. 출처등급: official(양조장·제조사가 직접) / sommelier(실명 소믈리에·명인·양조장 대표 발언) / media(전문 매체·기사) / blog(블로그·카페 후기) / user(지인·본인 시음)",
  "3. 점수대: official 95~97 · sommelier 92~94 · media 88~91 · blog·user 84~87. 비우면 등급 기본값이 들어갑니다.",
  "4. 인용문은 원문 그대로 120자 이내로 짧게, 출처URL은 반드시. 통째로 옮겨 적지 마세요(저작권). 검수 시 출처와 링크가 함께 표시됩니다.",
  "5. 같은 조합에 근거가 여러 개면 줄을 여러 개 쓰세요. 근거 2개 이상이거나 official/sommelier 1개면 승인 시 바로 게시(curated)됩니다.",
  "6. 저장 후: pnpm db:import 파일경로.xlsx  → 결과 요약과 확인 필요 목록(import-report.md)이 나옵니다.",
  "7. 예시 3줄(회색 글씨)은 가져오기에서 자동으로 건너뜁니다. 지우고 써도 됩니다.",
].forEach((t) => wg.addRow([t]));
wg.getRow(1).font = { bold: true, size: 13 };

await wb.xlsx.writeFile(out);
console.log(`템플릿 생성 → ${out} · 술 ${DATA.drinks.length} · 음식 ${DATA.foods.length}`);
