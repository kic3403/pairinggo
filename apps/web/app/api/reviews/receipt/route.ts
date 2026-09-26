import { isPlaceId } from "@pairinggo/shared";
/** 영수증 사진으로 방문 인증 — POST { kakaoId, placeName, image(base64 JPEG) } → { ticket, storeName, visitDate }. 사진은 저장하지 않는다 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/kakao";
import { verifyReceipt } from "@/lib/reviews";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const uid = (await auth())?.user?.id;
  if (!uid) return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });
  if (!rateLimit(req, 5, "review-receipt")) return NextResponse.json({ error: "잠시 뒤 다시 시도해 주세요" }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as { kakaoId?: string; placeName?: string; image?: string };
  const kakao = String(b.kakaoId ?? "");
  if (!isPlaceId(kakao)) return NextResponse.json({ error: "식당을 찾지 못했어요" }, { status: 400 });
  const r = await verifyReceipt(uid, kakao, String(b.placeName ?? ""), String(b.image ?? ""));
  if (!r.ok) return NextResponse.json({ error: r.problem }, { status: r.status });
  return NextResponse.json({ ok: true, ticket: r.ticket, storeName: r.storeName, visitDate: r.visitDate });
}
