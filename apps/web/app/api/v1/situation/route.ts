/**
 * GET /api/v1/situation?sido=서울|서울특별시&region=cap&d=술id&f=음식id&n=3 — 사는 곳 날씨·계절에 맞는 조합(docs/29).
 * 시·도는 ① sido(회원 프로필 시·도, 긴 이름·짧은 이름) ② region(관심 지역 id) ③ 없으면 서울(계절 + 서울 날씨, 화면에 "서울 기준" 표시).
 * 날씨를 못 받으면 계절만으로 판정한다(fromWeather=false). d·f가 있으면 그 술·음식 상세용 칸(없으면 null), 없으면 홈용 조합 n개.
 * 근거 점수·등급은 건드리지 않는다 — 규칙은 shared situation.ts.
 */
import { GRADE_LABEL, KIND_LABEL, gradeOf, kindOf, kstToday, sidoOfRegion, sidoShort, situationForDrink, situationForFood, situationOf, situationPairs, toSlug, type SituationPair } from "@pairinggo/shared";
import { getCatalog } from "@/lib/catalog";
import { json, preflight } from "@/lib/http";
import { weatherFor } from "@/lib/weather";

export const runtime = "nodejs";
const CACHE = { "Cache-Control": "public, max-age=300, s-maxage=600, stale-while-revalidate=1800" };
const CONF_LABEL = { confirmed: "근거 확인", weak: "근거 약함" } as const;

export async function OPTIONS(req: Request) { return preflight(req); }

const pub = (x: SituationPair) => ({
  d: x.drink.id, f: x.food.id, drink: x.drink.name, food: x.food.name, dslug: toSlug(x.drink.name), fslug: toSlug(x.food.name),
  category: kindOf(x.drink) === "trad" ? x.drink.category : KIND_LABEL[kindOf(x.drink)], region: x.drink.region.split(" ")[0] ?? "", conf: CONF_LABEL[x.conf], grade: GRADE_LABEL[gradeOf(x.p).key], fit: x.fit, local: x.local,
});

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const sido = sidoShort(sp.get("sido")) ?? sidoOfRegion(sp.get("region"));
  const where = sido ?? "서울";
  const [c, weather] = await Promise.all([getCatalog(), weatherFor(where).catch(() => null)]);
  const s = situationOf(kstToday(), weather, where);
  const ds = c.dataset;
  const n = Math.min(Math.max(Number(sp.get("n") || 3) || 3, 1), 6);
  const d = sp.get("d"), f = sp.get("f");
  const situation = { key: s.key, season: s.season, headline: s.headline, why: s.why, icon: s.icon, title: s.title, temp: s.temp, precip: s.precip, fromWeather: s.fromWeather, sido: where, assumed: !sido, at: weather?.at ?? null };
  if (d) { const r = situationForDrink(ds, s, d, n); return json(req, { situation, self: r?.self ?? false, items: r ? r.items.map(pub) : [] }, { headers: CACHE }); }
  if (f) { const r = situationForFood(ds, s, f, n, where); return json(req, { situation, self: r?.self ?? false, items: r ? r.items.map(pub) : [] }, { headers: CACHE }); }
  return json(req, { situation, items: situationPairs(ds, s, { sido: where, n }).map(pub) }, { headers: CACHE });
}
