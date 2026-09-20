/**
 * 추가 후보(expand-candidates 추천)를 카탈로그에 넣는다 — 2026-09-20 사용자 요청 "1번 방법으로 목록 늘리기"
 *   pnpm --filter @pairinggo/db add-candidates            미리보기(넣을 술·페어링 수·빠지는 것)
 *   pnpm --filter @pairinggo/db add-candidates --apply    DB 추가 + 발행 → 이어서 blog-counts → pf-recalc → export
 *   ... --limit 50   앞에서부터 N종만 (시험용)
 *
 * 들어가는 값: 이름·양조장·종류·도수·지역은 공개된 사실(더술닷컴·수상 명단), **설명 문장은 사실로 새로 짓고**(aT 원문 금지),
 * 맛 프로필과 맛 분석 페어링은 추정값(`shared/lineup`), 수상 이력은 두 대회 명단, 구매 링크는 `buy-links`가 모은 업체 등록 링크.
 * 판매처가 없으면 buy를 비워 둔다 — 화면은 네이버쇼핑 검색으로 연결된다(`buyLink` 폴백).
 * 도수를 모르는 후보는 넣지 않는다(맛 프로필 추정이 도수에 기댄다) — 미리보기에 목록이 나온다.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DATA, categoryAffinity, describeDrink, estimateProfile, matchFoods, planPairings, shopKeyword,
  type DrinkProfile, type LineupCategory,
} from "@pairinggo/shared";
import { insertDrinks, nextDrinkNumber, slug, type DrinkInput } from "./catalog-write";
import { loadResearch } from "./research";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const apply = process.argv.includes("--apply");
const awardsOnly = process.argv.includes("--awards-only");   // 수상작만 (이미 넣은 뒤 남은 수상작을 채울 때)
const limit = Number(process.argv[process.argv.indexOf("--limit") + 1]) || 0;

type Pick = {
  key: string; name: string; brewery: string; category: LineupCategory | null; abv: number | null; sido: string; sigungu: string;
  ingredients: string; food: string; awards: string[]; sources: string[]; productId: string | null;
};
type Shop = { url: string; kind: string; from: string; ok: boolean | null };

/** 화면 이름 — 괄호·용량을 떼고, 끝에 붙은 세 자리 이상 숫자(용량)와 앞에 붙은 도수를 뗀다 (lineup.ts와 같은 규칙) */
const cleanName = (s: string) => s.replace(/[[(（【].*?[\])）】]/g, " ").replace(/\d+(\.\d+)?\s*(ml|mL|ML|l|L|리터)\b/g, " ")
  .replace(/^\s*\d+(\.\d+)?\s*도\s+/, "").replace(/\s+\d{3,}\s*$/, "").replace(/\s+/g, " ").trim();
const region = (p: Pick) => {
  if (!p.sido || p.sido === "미상") return "";
  if (p.sido === "세종") return "세종";
  const city = (p.sigungu || "").split(/\s+/)[0].replace(/(특례)?[시군구]$/, "");
  return city.length >= 2 ? `${p.sido} ${city}` : p.sido;
};
const storeLabel = (s: Shop) => (s.kind === "스마트스토어" ? "양조장 공식 스마트스토어" : "양조장 공식몰");

const picks = (JSON.parse(readFileSync(join(ROOT, "research", "expand-candidates.json"), "utf8")) as { picks: Pick[] }).picks
  .filter((p) => !awardsOnly || p.awards?.length);
/** 수상 명단에만 있어 도수를 모르는 후보 — 사람이 출처를 확인해 research/candidate-abv.json에 적은 값 */
const abvFix: Record<string, { abv: number; source: string }> = JSON.parse(readFileSync(join(ROOT, "research", "candidate-abv.json"), "utf8"));
const readJson = <T,>(p: string): T => (existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as T) : ({} as T));
const shops: Record<string, Shop> = { ...readJson<Record<string, Shop>>(join(ROOT, "research", "buy-links-search.json")) };
for (const [k, v] of Object.entries(readJson<Record<string, Shop>>(join(ROOT, "research", "buy-links.json")))) if (v.ok !== false || !shops[k]) shops[k] = v;

const research = new Map(loadResearch().map((p) => [p.id, p]));
const foods = DATA.foods.map((f) => ({ id: f.id, name: f.name, category: f.category, profile: f.profile, trend: f.trend, alias: f.alias }));
const usedSlugs = new Set(DATA.drinks.map((d) => slug(d.name)));
const usage = new Map<string, number>();                     // 새 술들 사이 음식 쏠림 방지
const affinityOf = new Map<string, ReturnType<typeof categoryAffinity>>();
const start = await nextDrinkNumber();

const drinks: (DrinkInput & { official: number })[] = [];
const skipped: { name: string; why: string }[] = [];
for (const p of picks) {
  if (limit && drinks.length >= limit) break;
  if (!p.category) { skipped.push({ name: p.name, why: "종류 모름" }); continue; }
  if (p.abv == null && abvFix[p.key]) p.abv = abvFix[p.key].abv;
  if (p.abv == null) { skipped.push({ name: p.name, why: `도수 모름 — 확인 뒤 research/candidate-abv.json에 "${p.key}"` }); continue; }
  const name = cleanName(p.name);
  if (!name || usedSlugs.has(slug(name))) { skipped.push({ name: p.name, why: "이름이 겹치는 술이 이미 있음" }); continue; }
  usedSlugs.add(slug(name));

  const prod = p.productId ? research.get(p.productId) : null;
  const ingredients = p.ingredients || prod?.ingredients || "";
  const intro = prod?.intro ?? "";                            // 맛 추정에만 쓰고 화면에는 싣지 않는다(공공누리 4유형)
  const category = p.category;
  const { profile, flavor } = estimateProfile({ category, abv: p.abv, name: p.name, ingredients, intro });
  const official = prod?.url.includes("thesool.com") ? matchFoods(prod.food, foods) : [];
  const shop = shops[p.key];
  const kw = shopKeyword(name);
  const brewery = p.brewery;
  drinks.push({
    id: `d${start + drinks.length}`, name, alias: kw !== name ? kw : null, category, abv: p.abv, region: region(p), brewery,
    desc: describeDrink({ category, abv: p.abv, region: region(p), brewery, ingredients, flavor }),
    flavor, profile: profile as DrinkProfile, awards: p.awards ?? [],
    buy: shop && shop.ok !== false ? { url: shop.url, store: storeLabel(shop) } : null,
    offline: null,
    official: official.length,
    pairings: planPairings({ profile, abv: p.abv }, foods, official, undefined, usage,
      affinityOf.get(category) ?? (affinityOf.set(category, categoryAffinity(DATA.pairings, DATA.drinks, category)), affinityOf.get(category))).map((x) => ({
        ...x,
        evidence: x.src === "official" && prod
          ? [{ source: "더술닷컴 제품 정보(양조장 등록 추천 음식)", url: prod.url, quote: null, who: brewery, tier: "official" as const }]
          : [],
      })),
  });
}

const pairs = drinks.reduce((s, d) => s + d.pairings.length, 0);
const byCat = drinks.reduce((m, d) => { m[d.category] = (m[d.category] ?? 0) + 1; return m; }, {} as Record<string, number>);
console.log(`넣을 술 ${drinks.length}종 (${start}번부터) · 페어링 ${pairs} · 양조장 추천 음식으로 만든 공식 근거 ${drinks.reduce((s, d) => s + d.official, 0)}건`);
console.log("종류", byCat, "· 수상 있는 술", drinks.filter((d) => d.awards.length).length, "· 구매 링크 있는 술", drinks.filter((d) => d.buy).length);
console.log(`빠진 후보 ${skipped.length}종`);
for (const s of skipped) console.log(`  ${s.name} — ${s.why}`);
console.log("\n보기 —");
for (const d of drinks.slice(0, 5)) console.log(`  ${d.id} ${d.name} (${d.brewery}, ${d.region}) ${d.category} ${d.abv}%\n    ${d.desc}\n    수상: ${d.awards.join(" · ") || "-"}\n    구매: ${d.buy?.url ?? "(네이버쇼핑 검색)"}\n    페어링: ${d.pairings.map((x) => `${DATA.foods.find((f) => f.id === x.f)?.name}${x.src === "official" ? "*" : ""}`).join(", ")}`);

if (apply) {
  await insertDrinks(drinks.map(({ official: _official, ...d }) => d), `목록 확장 +${drinks.length}종 (수상작·더술닷컴 후보, 2026-09-20)`);
  console.log("이어서: blog-counts → pf-recalc → export");
} else console.log("\n미리보기입니다. 넣으려면 --apply");
