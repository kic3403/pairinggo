import { guideList, slugKey } from "@pairinggo/shared";
import { getCatalog } from "@/lib/catalog";
import { json, preflight } from "@/lib/http";

export const runtime = "nodejs";
// 프록시(proxy.ts)가 5분마다 받아 간다 — CDN에서도 5분. 새 술을 발행한 직후 최대 몇 분은 목록에 없을 수 있다(그때도 화면은 그대로 보인다)
const CACHE = { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=3600" };

export async function OPTIONS(req: Request) { return preflight(req); }

/**
 * GET /api/v1/slugs — 있는 상세 주소의 비교용 키 목록(2026-10-02).
 * 없는 술·음식·모음 주소가 "정상(200)"으로 답하던 것을 고치려고 프록시가 쓴다: 화면 사이 뼈대(loading.tsx) 때문에 Next.js는
 * 본문을 흘려 보내기 시작한 뒤에야 notFound()를 만나 상태 코드를 못 바꾼다(noindex 메타만 붙는다). 그래서 화면을 그리기 전에 프록시가 판정한다.
 * 키는 shared slugKey(하이픈·기호·대소문자 무시) — 상세 화면의 findBySlug와 같은 기준.
 */
export async function GET(req: Request) {
  const c = await getCatalog();
  return json(req, {
    v: c.version,
    drinks: c.dataset.drinks.map((d) => slugKey(d.name)),
    foods: c.dataset.foods.map((f) => slugKey(f.name)),
    guide: guideList(c.dataset).map((g) => slugKey(g.slug)),
  }, { headers: CACHE });
}
