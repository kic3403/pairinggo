/**
 * 링크 공유 이미지용 한글 폰트 만들기 — Noto Sans KR(OFL) 가변 폰트에서 굵기 700만 뽑고, KS X 1001 한글 2,350자 + 영문·숫자·기호만 남긴다.
 *   pnpm --filter @pairinggo/db og-font <NotoSansKR[wght].ttf 경로>
 *   → apps/web/lib/fonts/NotoSansKR-Bold-ko.ttf (약 0.6MB). apps/web/lib/og.tsx가 이 파일을 읽는다.
 * 왜: 요청 때마다 Google Fonts에서 글자를 받으면 첫 생성이 5초를 넘겨 카카오 스크래퍼가 그림을 못 받았다(2026-09-15).
 * 원본: https://github.com/google/fonts/raw/main/ofl/notosanskr/NotoSansKR%5Bwght%5D.ttf (SIL Open Font License 1.1)
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import subsetFont from "subset-font";

const src = process.argv[2];
if (!src) { console.error("사용: og-font <NotoSansKR[wght].ttf>"); process.exit(2); }

// KS X 1001 완성형 한글 2,350자 — EUC-KR 한글 영역(선두 0xB0~0xC8, 후속 0xA1~0xFE)을 풀어서 얻는다. 전체 11,172자를 넣으면 2.4MB라 2,350자(약 0.7MB)로 줄인다.
// 이름에 여기 없는 글자가 들어가면 그 글자만 깨지므로, 새 술 이름은 add-drinks 미리보기에서 확인한다.
const KSX1001 = (() => {
  const dec = new TextDecoder("euc-kr");
  const out = new Set<string>();
  for (let lead = 0xb0; lead <= 0xc8; lead++) for (let trail = 0xa1; trail <= 0xfe; trail++) {
    const ch = dec.decode(new Uint8Array([lead, trail]));
    if (ch >= "가" && ch <= "힣") out.add(ch);
  }
  return [...out].join("");
})();
const ASCII = Array.from({ length: 0x7e - 0x20 + 1 }, (_, i) => String.fromCharCode(0x20 + i)).join("");
const SYMBOLS = "·×—–‘’“”…％℃°ㆍ㎖㎜";
// 카탈로그 이름에 든 글자는 2,350자 밖이어도 넣는다(예: 똠얌꿍의 '똠'). 새 술·음식을 넣은 뒤 이 스크립트를 다시 돌리면 된다
const catalog = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../shared/data/pairings.json"), "utf8")) as { drinks: { name: string }[]; foods: { name: string }[] };
const extra = [...new Set([...catalog.drinks, ...catalog.foods].flatMap((x) => [...x.name]).filter((ch) => ch >= "가" && ch <= "힣" && !KSX1001.includes(ch)))].join("");
const text = KSX1001 + ASCII + SYMBOLS + extra;
console.log(`2,350자 밖 카탈로그 글자: ${extra || "없음"}`);

const buf = readFileSync(resolve(src));
const out = await subsetFont(buf, text, { targetFormat: "truetype", variationAxes: { wght: 700 } });
const dest = resolve(import.meta.dirname, "../../../apps/web/lib/fonts/NotoSansKR-Bold-ko.ttf");
mkdirSync(resolve(dest, ".."), { recursive: true });
writeFileSync(dest, out);
console.log(`저장 → ${dest} (${(out.length / 1024).toFixed(0)}KB, 글자 ${text.length})`);
