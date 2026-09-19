/** 리뷰 신고 — POST { reason }. 한 회원이 한 번, 3건이면 자동 숨김(운영자 검토) */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/kakao";
import { reportReview } from "@/lib/reviews";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const uid = (await auth())?.user?.id;
  if (!uid) return NextResponse.json({ error: "로그인하면 신고할 수 있어요" }, { status: 401 });
  if (!rateLimit(req, 10, "review-report")) return NextResponse.json({ error: "잠시 뒤 다시 시도해 주세요" }, { status: 429 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "리뷰를 찾지 못했어요" }, { status: 400 });
  const b = (await req.json().catch(() => ({}))) as { reason?: string };
  const r = await reportReview(uid, id, String(b.reason ?? ""));
  return r.ok ? NextResponse.json(r) : NextResponse.json({ error: r.problem }, { status: 400 });
}
