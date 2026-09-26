import { isPlaceId } from "@pairinggo/shared";
/**
 * 식당 리뷰 — GET ?kakao= 내가 쓸 수 있는지(휴대폰 인증·사장님 여부·방문 완료 예약·내 리뷰 id)
 *           POST { kakaoId, placeName, rating, body, photos, reservationId? | receiptTicket? } 쓰기(방문 인증 필수)
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/kakao";
import { createReview, reviewGate, type ReviewInput } from "@/lib/reviews";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(req: Request) {
  const uid = (await auth())?.user?.id;
  if (!uid) return NextResponse.json({ loggedIn: false }, { headers: NO_STORE });
  const kakao = new URL(req.url).searchParams.get("kakao") ?? "";
  if (!isPlaceId(kakao)) return NextResponse.json({ error: "식당을 찾지 못했어요" }, { status: 400, headers: NO_STORE });
  return NextResponse.json({ loggedIn: true, ...(await reviewGate(uid, kakao)) }, { headers: NO_STORE });
}

export async function POST(req: Request) {
  const uid = (await auth())?.user?.id;
  if (!uid) return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });
  if (!rateLimit(req, 10, "review-create")) return NextResponse.json({ error: "잠시 뒤 다시 시도해 주세요" }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as ReviewInput;
  const r = await createReview(uid, b);
  if (!r.ok) return NextResponse.json({ error: r.problem }, { status: r.status });
  try { const { revalidatePath } = await import("next/cache"); revalidatePath(`/places/${b.kakaoId}`); } catch { /* 상세는 동적 렌더 — 실패해도 무방 */ }
  return NextResponse.json({ ok: true, id: r.id });
}
