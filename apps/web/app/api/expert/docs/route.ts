/** 전문가 자격증 더 올리기(2026-09-29) — POST multipart { doc(≤3) } → { ok, count }. 승인·심사 중인 전문가 본인만, 운영자만 보는 비공개 저장소 */
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/kakao";
import { addExpertDocs } from "@/lib/experts";
import { sameOrigin, userIdOf } from "@/lib/session-uid";

export const runtime = "nodejs";
export const maxDuration = 60;
const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "허용되지 않은 요청" }, { status: 403, headers: NO_STORE });
  if (!rateLimit(req, 5, "expert-docs")) return NextResponse.json({ error: "잠시 뒤 다시 시도해 주세요." }, { status: 429, headers: NO_STORE });
  const uid = await userIdOf(req);
  if (!uid) return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401, headers: NO_STORE });
  const fd = await req.formData().catch(() => null);
  if (!fd) return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400, headers: NO_STORE });
  const r = await addExpertDocs(uid, fd.getAll("doc").filter((x): x is File => x instanceof File));
  return r.ok ? NextResponse.json(r, { headers: NO_STORE }) : NextResponse.json({ error: r.error }, { status: 400, headers: NO_STORE });
}
