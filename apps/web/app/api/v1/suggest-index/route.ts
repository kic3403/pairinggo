import { DOCS } from "@pairinggo/shared";
import { getCatalog } from "@/lib/catalog";
import { json, preflight } from "@/lib/http";

export const runtime = "nodejs";
// 카탈로그는 15초마다 버전을 확인하니 10분 캐시면 충분 — 그 사이 새 술은 자동완성에만 늦게 뜬다(검색 결과 화면은 서버가 그린다)
const CACHE = { "Cache-Control": "public, max-age=600, s-maxage=600, stale-while-revalidate=86400" };

export async function OPTIONS(req: Request) { return preflight(req); }

/**
 * GET /api/v1/suggest-index — 검색창 자동완성용 문서 목록(2026-09-30 속도 개선).
 * 브라우저가 한 번 받아 두고(약 700건) shared search-core `suggestItems`로 서버 왕복 없이 후보를 낸다 —
 * 전에는 글자마다 /api/v1/suggest를 불러 첫 호출이 4초(콜드 스타트)였다. 카탈로그 데이터는 싣지 않고 검색 문서만.
 */
export async function GET(req: Request) {
  const c = await getCatalog();
  // 가볍게: 주종 속성(da)은 빼고 트렌드는 소수 둘째 자리까지 — 1,200건 약 330KB(압축 70KB), 탭당 한 번
  const docs = DOCS.map(({ da: _da, trend, ...d }) => ({ ...d, trend: Math.round(trend * 100) / 100 }));
  return json(req, { v: c.version, docs }, { headers: CACHE });
}
