/**
 * 사진 요청 명단 엑셀 — 인기 상위 N종의 양조장 연락처(더술닷컴 자료 + 찾아가는 양조장)와 진행 상태 열.
 *   pnpm --filter @pairinggo/db photo-request [--top 30]  →  templates/사진요청_상위30.xlsx
 * 순위는 packages/shared/data/pairings.json의 trend.rank(최근 export 기준). 연락처는 packages/db/research/thesool-products.json.
 * 메일 문안·절차는 docs/16_사진_요청_안내.md.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { DATA } from "@pairinggo/shared";

const here = dirname(fileURLToPath(import.meta.url));
const topArg = process.argv.indexOf("--top");
const N = topArg > 0 ? Number(process.argv[topArg + 1]) : 30;

type Prod = { name: string; detail: { brewery?: string; address?: string; homepage?: string; phone?: string } };
const raw = JSON.parse(readFileSync(join(here, "..", "research", "thesool-products.json"), "utf8"));
const products: Prod[] = Array.isArray(raw) ? raw : (raw.items || Object.values(raw));
const norm = (s: string) => (s || "").replace(/\s|\(주\)|주식회사|농업회사법인|영농조합법인|㈜|\(유\)|유한회사/g, "");
const clean = (s?: string) => (s || "").replace(/본 저작물은.*$/, "").trim();   // 더술닷컴 전화 칸에 저작권 문구가 붙어 있는 경우

const contact = (brewery: string) => {
  const b = norm(brewery);
  const hit = products.find((p) => { const a = norm(p.detail?.brewery || ""); return a && b && (a.includes(b) || b.includes(a)); });
  return hit ? { address: clean(hit.detail.address), homepage: clean(hit.detail.homepage), phone: clean(hit.detail.phone) } : { address: "", homepage: "", phone: "" };
};

const top = DATA.drinks.filter((d) => d.trend?.rank).sort((a, b) => a.trend!.rank! - b.trend!.rank!).slice(0, N);
const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet("사진 요청");
ws.columns = [
  { header: "순위", key: "rank", width: 6 }, { header: "술", key: "name", width: 22 }, { header: "양조장", key: "brewery", width: 20 },
  { header: "주소", key: "address", width: 40 }, { header: "홈페이지", key: "homepage", width: 34 }, { header: "전화", key: "phone", width: 16 },
  { header: "이메일", key: "email", width: 24 }, { header: "공식몰(우리 데이터)", key: "buy", width: 40 },
  { header: "요청일", key: "asked", width: 12 }, { header: "상태", key: "status", width: 12 }, { header: "허락 근거(메일·담당자)", key: "basis", width: 30 },
  { header: "받은 사진 주소", key: "image", width: 40 }, { header: "출처표기", key: "credit", width: 18 }, { header: "메모", key: "memo", width: 30 },
];
for (const d of top) {
  const c = contact(d.brewery);
  ws.addRow({ rank: d.trend!.rank, name: d.name, brewery: d.brewery, ...c, buy: d.buy?.url || "", status: "미요청", credit: d.brewery ? `${d.brewery} 제공` : "" });
}
ws.getRow(1).font = { bold: true };
ws.views = [{ state: "frozen", ySplit: 1 }];
for (let r = 2; r <= N + 1; r++) ws.getCell(`J${r}`).dataValidation = { type: "list", allowBlank: true, formulae: ['"미요청,요청함,회신 대기,허락,거절,등록 완료"'] };

const guide = wb.addWorksheet("작성법");
[
  "1. 홈페이지·전화로 담당자 이메일을 확인해 '이메일' 열에 적는다.",
  "2. docs/16_사진_요청_안내.md 의 메일 문안을 보내고 '요청일'·'상태'를 적는다.",
  "3. 허락 회신(메일 원문 보관)이 오면 '허락 근거'에 날짜·담당자, 사진은 Supabase Storage(pairinggo-images)에 올리고 그 주소를 '받은 사진 주소'에.",
  "4. 이 시트에서 '술, 받은 사진 주소, 출처표기, 허락 근거' 네 열을 CSV로 저장해 pnpm --filter @pairinggo/db images <csv> 로 넣는다.",
  "5. 더술닷컴·네이버·인스타에서 가져온 사진은 넣지 않는다(공공누리 4유형·저작권). 양조장이 준 사진만.",
].forEach((t) => guide.addRow([t]));
guide.getColumn(1).width = 110;

const out = join(here, "..", "templates", `사진요청_상위${N}.xlsx`);
await wb.xlsx.writeFile(out);
console.log(`${out} — ${top.length}종, 연락처 있는 양조장 ${top.filter((d) => contact(d.brewery).phone || contact(d.brewery).homepage).length}곳`);
