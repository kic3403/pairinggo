/**
 * '먹어봤어요' 평가 API
 *   GET  /api/ratings?drink=d01  또는  ?food=f02  → { counts: {"d01|f02": {good,ok,bad}}, mine: {"d01|f02": "good"} }
 *   POST /api/ratings  { d, f, rating: "good"|"ok"|"bad"|null }  → 로그인한 회원만. null이면 내 평가 삭제
 * 세션은 getToken으로 읽는다 — auth()는 응답에 세션 쿠키를 다시 써서 첫 화면 로그아웃(/api/auth/reset)과 경합한다(docs/13).
 */
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { z } from "zod";
import { D, F } from "@pairinggo/shared";
import { getCatalog } from "@/lib/catalog";
import { ratingsFor, setRating } from "@/lib/ratings";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store" };

async function userIdOf(req: Request): Promise<string | null> {
  try {
    const secure = new URL(req.url).protocol === "https:";
    const t = await getToken({ req, secret: process.env.AUTH_SECRET ?? "", secureCookie: secure, salt: secure ? "__Secure-authjs.session-token" : "authjs.session-token" });
    return typeof t?.uid === "string" ? t.uid : null;
  } catch { return null; }
}

const Id = z.string().regex(/^[a-z]\d{1,4}$/);

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const drink = sp.get("drink"), food = sp.get("food");
  if (!(drink && Id.safeParse(drink).success) && !(food && Id.safeParse(food).success)) return NextResponse.json({ error: "drink 또는 food가 필요합니다" }, { status: 400, headers: NO_STORE });
  const uid = await userIdOf(req);
  try {
    const r = await ratingsFor(drink ? { drink } : { food: food! }, uid);
    return NextResponse.json({ ...r, loggedIn: !!uid }, { headers: NO_STORE });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500, headers: NO_STORE }); }
}

const Body = z.object({ d: Id, f: Id, rating: z.enum(["good", "ok", "bad"]).nullable() });

export async function POST(req: Request) {
  const uid = await userIdOf(req);
  if (!uid) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401, headers: NO_STORE });
  // 같은 사이트에서 온 요청만
  const origin = req.headers.get("origin"), host = req.headers.get("host");
  if (origin && host && !origin.endsWith(`//${host}`)) return NextResponse.json({ error: "허용되지 않은 요청" }, { status: 403, headers: NO_STORE });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400, headers: NO_STORE });
  await getCatalog();
  if (!D[parsed.data.d] || !F[parsed.data.f]) return NextResponse.json({ error: "없는 술 또는 음식입니다" }, { status: 404, headers: NO_STORE });
  try {
    await setRating(uid, parsed.data.d, parsed.data.f, parsed.data.rating);
    const r = await ratingsFor({ drink: parsed.data.d }, uid);
    const k = `${parsed.data.d}|${parsed.data.f}`;
    return NextResponse.json({ ok: true, counts: r.counts[k] ?? { good: 0, ok: 0, bad: 0 }, mine: r.mine[k] ?? null }, { headers: NO_STORE });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500, headers: NO_STORE }); }
}
