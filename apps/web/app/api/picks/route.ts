/**
 * 회원 추천 페어링 API
 *   GET  /api/picks?drink=d01 | ?food=f02  → { picks: {"d01|f02": {n, notes[]}}, mine: ["d01|f02"] }  (공개 기준 이상만)
 *   POST /api/picks  multipart: d | drink_raw, f | food_raw, note(≤140), image(1장, ≤3MB)  → 로그인 회원만
 * 세션은 getToken(첫 화면 로그아웃과 경합하는 auth() 회피).
 */
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { validateMemberNote } from "@pairinggo/shared";
import { createPick, picksFor, uploadPickImage } from "@/lib/member-picks";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store" };
const ID = /^[a-z]\d{1,4}$/;

async function userIdOf(req: Request): Promise<string | null> {
  try {
    const secure = new URL(req.url).protocol === "https:";
    const t = await getToken({ req, secret: process.env.AUTH_SECRET ?? "", secureCookie: secure, salt: secure ? "__Secure-authjs.session-token" : "authjs.session-token" });
    return typeof t?.uid === "string" ? t.uid : null;
  } catch { return null; }
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const drink = sp.get("drink"), food = sp.get("food");
  if (!(drink && ID.test(drink)) && !(food && ID.test(food))) return NextResponse.json({ error: "drink 또는 food가 필요합니다" }, { status: 400, headers: NO_STORE });
  const uid = await userIdOf(req);
  try { return NextResponse.json(await picksFor(drink ? { drink } : { food: food! }, uid), { headers: NO_STORE }); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500, headers: NO_STORE }); }
}

export async function POST(req: Request) {
  const uid = await userIdOf(req);
  if (!uid) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401, headers: NO_STORE });
  const origin = req.headers.get("origin"), host = req.headers.get("host");
  if (origin && host && !origin.endsWith(`//${host}`)) return NextResponse.json({ error: "허용되지 않은 요청" }, { status: 403, headers: NO_STORE });
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400, headers: NO_STORE });
  const str = (k: string) => { const v = form.get(k); return typeof v === "string" ? v.trim() : ""; };
  const note = str("note");
  const bad = validateMemberNote(note);
  if (bad) return NextResponse.json({ error: bad }, { status: 400, headers: NO_STORE });
  const d = str("d"), f = str("f");
  let imageUrl: string | null = null;
  const image = form.get("image");
  if (image instanceof File && image.size > 0) {
    const up = await uploadPickImage(uid, image);
    if (!up.ok) return NextResponse.json({ error: up.error }, { status: 400, headers: NO_STORE });
    imageUrl = up.url;
  }
  try {
    const r = await createPick(uid, { drinkId: ID.test(d) ? d : null, foodId: ID.test(f) ? f : null, drinkRaw: str("drink_raw"), foodRaw: str("food_raw"), note, imageUrl });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.code ?? 400, headers: NO_STORE });
    return NextResponse.json(r, { headers: NO_STORE });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500, headers: NO_STORE }); }
}
