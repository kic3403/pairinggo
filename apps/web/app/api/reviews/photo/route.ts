/** 리뷰 사진 한 장 올리기 — POST { data: base64 JPEG } → { url }. 리뷰를 저장해야 공개되고, 붙지 않은 사진은 하루 뒤 크론이 지운다 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/kakao";
import { reportError } from "@pairinggo/server/errors";
import { uploadReviewPhoto } from "@/lib/reviews";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const uid = (await auth())?.user?.id;
  if (!uid) return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });
  if (!rateLimit(req, 20, "review-photo")) return NextResponse.json({ error: "잠시 뒤 다시 시도해 주세요" }, { status: 429 });
  const b = (await req.json().catch(() => null)) as { data?: unknown } | null;
  try { return NextResponse.json({ url: await uploadReviewPhoto(uid, String(b?.data ?? "")) }); }
  catch (e) {
    const msg = (e as Error).message;
    if (/올리지 못했어요/.test(msg)) void reportError("web", "reviews/photo", e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
