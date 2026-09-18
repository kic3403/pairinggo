import { kakaoConfigured, rateLimit, searchPlaces } from "@pairinggo/server/kakao";

/** 가입할 때 "내 매장 찾기" — 카카오 로컬(서버 경유, 키 보호) */
export async function GET(req: Request) {
  if (!kakaoConfigured()) return Response.json({ error: "매장 검색이 아직 꺼져 있어요(KAKAO_REST_KEY)", places: [] }, { status: 503 });
  if (!rateLimit(req, 20, "partner-place")) return Response.json({ error: "잠시 뒤 다시 시도해 주세요", places: [] }, { status: 429 });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 40);
  if (q.length < 2) return Response.json({ places: [] });
  const r = await searchPlaces({ query: q, pages: 1 }).catch(() => null);
  if (!r) return Response.json({ error: "검색하지 못했어요 — 잠시 뒤 다시 시도해 주세요", places: [] }, { status: 502 });
  return Response.json({ places: r.places.map((p) => ({ id: p.id, name: p.name, category: p.category, address: p.roadAddress || p.address, phone: p.phone })) });
}
