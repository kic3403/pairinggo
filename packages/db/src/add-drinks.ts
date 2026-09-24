/**
 * 양조장 라인 추가 — 사람이 확인한 제품 사실·근거 조합(JSON)으로 새 술을 넣는다.
 *   pnpm --filter @pairinggo/db add-drinks research/additions/<파일>.json            미리보기(DB 안 건드림)
 *   pnpm --filter @pairinggo/db add-drinks research/additions/<파일>.json --apply    DB 추가 + 발행
 * 이어서 `blog-counts` → `db:export`.
 *
 * JSON 형식은 research/additions/baekgyeong-distillery.json 참고.
 * - 근거 조합(evidence): 출처 URL 필수, 인용문은 120자 이내(원문을 길게 옮기지 않는다). 음식 이름은 카탈로그 이름 그대로.
 * - 근거가 8개 미만이면 나머지는 맛 분석(같은 종류 전문가 조합 친화도 + 맛 프로필, `planPairings`)으로 채운다.
 * - 설명(desc)은 사실로 직접 쓴 문장 — 더술닷컴 소개글 원문 금지(공공누리 4유형).
 */
import { readFileSync } from "node:fs";
import { DATA, categoryAffinity, cleanKind, cleanSpec, planPairings, profileFit, type DrinkKind, type DrinkProfile } from "@pairinggo/shared";
import { insertDrinks, nextDrinkNumber, slug, type DrinkInput, type EvidenceInput, type PairingInput } from "./catalog-write";

type Spec = {
  brewery: string;
  buy?: { url: string; store: string };
  offline?: DrinkInput["offline"];
  /** 주종(기본 전통주)·국가 — 파일 전체 기본값, 술마다 덮어쓸 수 있다(0035) */
  kind?: DrinkKind; country?: string;
  drinks: {
    name: string; alias: string | null; category: string; abv: number; region: string; desc: string; flavor: string[]; profile: DrinkProfile; awards?: string[];
    evidence: { food: string; es: number; src: PairingInput["src"]; reason: string; items: EvidenceInput[] }[];
    kind?: DrinkKind; country?: string; attrs?: Record<string, unknown>; nameOrig?: string; aliases?: string[];
    /** 규격·참고가격 — { ml, abv?, vintage?, pack?, bottles?, prices: [{ krw, type, source, url?, checked }] } */
    specs?: unknown[];
  }[];
};

const file = process.argv[2];
if (!file) { console.error("사용: add-drinks <json> [--apply]"); process.exit(2); }
const apply = process.argv.includes("--apply");
const demo = process.argv.includes("--demo");   // 개발 데모(is_demo) — 공개 카탈로그·번들에서 빠지고 SHOW_DEMO=1일 때만 보인다
const spec = JSON.parse(readFileSync(file, "utf8")) as Spec;

const foodByName = new Map(DATA.foods.map((f) => [f.name, f]));
const foods = DATA.foods.map((f) => ({ id: f.id, name: f.name, category: f.category, profile: f.profile, trend: f.trend }));
const existing = new Set(DATA.drinks.map((d) => slug(d.name)));
const TOTAL = 8;

let n = await nextDrinkNumber();
const usage = new Map<string, number>();
const out: DrinkInput[] = [];
for (const d of spec.drinks) {
  if (existing.has(slug(d.name))) throw new Error(`이미 있는 술: ${d.name}`);
  const pairings: PairingInput[] = [];
  for (const e of d.evidence) {
    const f = foodByName.get(e.food);
    if (!f?.profile) throw new Error(`${d.name}: 카탈로그에 없는 음식 '${e.food}'`);
    for (const it of e.items) {
      if (!it.url) throw new Error(`${d.name} × ${e.food}: 근거 URL 없음`);
      if (it.quote && it.quote.length > 120) throw new Error(`${d.name} × ${e.food}: 인용문 120자 초과`);
    }
    pairings.push({ f: f.id, es: e.es, src: e.src, reason: e.reason, pf: profileFit(d.profile, d.abv, f.profile), evidence: e.items });
  }
  const left = TOTAL - pairings.length;
  if (left > 0) {
    const pool = foods.filter((f) => !pairings.some((p) => p.f === f.id));
    const planned = planPairings({ profile: d.profile, abv: d.abv }, pool, [], { total: left, perCategory: 2, maxOfficial: 0 }, usage, categoryAffinity(DATA.pairings, DATA.drinks, d.category));
    for (const p of planned) pairings.push({ ...p, evidence: [] });
  }
  const kind = cleanKind(d.kind ?? spec.kind);
  const specs = (d.specs ?? []).map((x) => cleanSpec(x));
  out.push({
    id: `d${n++}`, name: d.name, alias: d.alias, category: d.category, abv: d.abv, region: d.region, brewery: spec.brewery, desc: d.desc, flavor: d.flavor, profile: d.profile,
    awards: d.awards ?? [], buy: spec.buy ?? null, offline: spec.offline ?? null, pairings,
    kind, country: d.country ?? spec.country, attrs: d.attrs, nameOrig: d.nameOrig ?? null, aliases: d.aliases, specs, demo,
  });
}

const F = new Map(DATA.foods.map((f) => [f.id, f.name]));
for (const d of out) {
  console.log(`${d.id}${d.demo ? " [데모]" : ""} ${d.name} (${d.kind === "trad" ? "" : `${d.kind} · `}${d.category} ${d.abv}%${d.specs?.length ? ` · 규격 ${d.specs.map((s) => `${s.ml ?? "?"}mL${s.prices[0] ? ` ${s.prices[0].krw.toLocaleString()}원` : ""}`).join("/")}` : ""}) — ${d.desc}`);
  console.log(`   ${d.pairings.map((p) => `${p.src === "profile" ? "" : `[${p.src}]`}${F.get(p.f)}`).join(", ")}`);
}
if (apply) await insertDrinks(out, `${spec.brewery} 라인 추가 +${out.length}종${demo ? "(데모)" : ""}`);
else console.log("미리보기입니다. 넣으려면 --apply");
