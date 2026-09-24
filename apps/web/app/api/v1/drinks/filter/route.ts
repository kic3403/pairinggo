/**
 * GET /api/v1/drinks/filter?kind=&cat=&pmin=&pmax=&vmin=&vmax=&food=&…  — 술 목록 필터(2026-09-24).
 * 목록 화면과 같은 규칙(shared filterDrinks)을 전체 데이터에 적용한다. `count=1`이면 결과 수만(필터 패널의 "N개 결과 보기"), 아니면 카드 60개씩(`page=`).
 */
import { F, drinkInRegion, filterDrinks, parseFilter, regionById, specLine, subtypeLabel, kindOf, toSlug } from "@pairinggo/shared";
import { getCatalog } from "@/lib/catalog";
import { json, preflight } from "@/lib/http";
import { rateLimit } from "@/lib/kakao";

export const runtime = "nodejs";
const PER = 60;

export async function OPTIONS(req: Request) { return preflight(req); }

export async function GET(req: Request) {
  if (!rateLimit(req, 240, "drinks_filter")) return json(req, { error: "too_many" }, { status: 429 });
  const url = new URL(req.url);
  const c = await getCatalog();
  const f = parseFilter(url.searchParams);
  const region = regionById(f.region);
  const res = filterDrinks(c.dataset.drinks, f, F, { regionTest: (d) => drinkInRegion(d, region) });
  if (url.searchParams.get("count") === "1") return json(req, { total: res.total, kindCounts: res.kindCounts, all: res.all });
  const page = Math.max(1, Math.floor(Number(url.searchParams.get("page") || 1)) || 1);
  const items = res.items.slice((page - 1) * PER, page * PER).map((it) => ({
    id: it.drink.id, name: it.drink.name, href: `/drinks/${toSlug(it.drink.name)}${it.spec ? `?spec=${it.spec.id}` : ""}`,
    kind: kindOf(it.drink), subtype: subtypeLabel(it.drink), abv: it.drink.abv,
    specId: it.spec?.id ?? null, ml: it.spec?.ml ?? null, price: it.price, line: specLine(it.spec, it.price),
  }));
  return json(req, { total: res.total, page, per: PER, items });
}
