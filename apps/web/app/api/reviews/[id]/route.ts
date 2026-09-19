/** 내 리뷰 지우기 — DELETE (사진도 함께 지운다) */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteMyReview } from "@/lib/reviews";

export const runtime = "nodejs";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const uid = (await auth())?.user?.id;
  if (!uid) return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "리뷰를 찾지 못했어요" }, { status: 400 });
  return (await deleteMyReview(uid, id)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "내 리뷰만 지울 수 있어요" }, { status: 404 });
}
