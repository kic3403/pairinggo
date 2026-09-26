/**
 * 술 평가 API(docs/25 §1)
 *   GET    /api/drink-reviews?d=d01            → { summary: {n, avg, hist}, list: [...최근 20], mine, loggedIn }
 *   POST   /api/drink-reviews { d, stars, body } → 로그인한 회원만. 있으면 수정
 *   DELETE /api/drink-reviews { d }             → 내 평가 삭제
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { D } from "@pairinggo/shared";
import { getCatalog } from "@/lib/catalog";
import { deleteDrinkReview, drinkReviewsFor, setDrinkReview } from "@/lib/drink-reviews";
import { sameOrigin, userIdOf } from "@/lib/session-uid";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store" };
const Id = z.string().regex(/^[a-z]\d{1,4}$/);

export async function GET(req: Request) {
  const d = new URL(req.url).searchParams.get("d") ?? "";
  if (!Id.safeParse(d).success) return NextResponse.json({ error: "d가 필요합니다" }, { status: 400, headers: NO_STORE });
  const uid = await userIdOf(req);
  try { return NextResponse.json({ ...(await drinkReviewsFor(d, uid)), loggedIn: !!uid }, { headers: NO_STORE }); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500, headers: NO_STORE }); }
}

async function guard(req: Request): Promise<{ uid: string } | NextResponse> {
  const uid = await userIdOf(req);
  if (!uid) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401, headers: NO_STORE });
  if (!sameOrigin(req)) return NextResponse.json({ error: "허용되지 않은 요청" }, { status: 403, headers: NO_STORE });
  return { uid };
}

const Body = z.object({ d: Id, stars: z.number().int().min(1).max(5), body: z.string().max(400).optional() });

export async function POST(req: Request) {
  const g = await guard(req); if (g instanceof NextResponse) return g;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "별점은 1~5 사이로 골라 주세요." }, { status: 400, headers: NO_STORE });
  await getCatalog();
  if (!D[parsed.data.d]) return NextResponse.json({ error: "없는 술입니다" }, { status: 404, headers: NO_STORE });
  try {
    await setDrinkReview(g.uid, parsed.data.d, parsed.data.stars, parsed.data.body ?? "");
    return NextResponse.json({ ok: true, ...(await drinkReviewsFor(parsed.data.d, g.uid)), loggedIn: true }, { headers: NO_STORE });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400, headers: NO_STORE }); }
}

export async function DELETE(req: Request) {
  const g = await guard(req); if (g instanceof NextResponse) return g;
  const parsed = z.object({ d: Id }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400, headers: NO_STORE });
  try {
    await deleteDrinkReview(g.uid, parsed.data.d);
    return NextResponse.json({ ok: true, ...(await drinkReviewsFor(parsed.data.d, g.uid)), loggedIn: true }, { headers: NO_STORE });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400, headers: NO_STORE }); }
}
