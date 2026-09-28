/**
 * 전문가 신청(docs/27) — POST multipart { realName, affiliation, title, intro, publicConsent="on", doc(≤3) } → { ok }.
 * 로그인 회원만. 증빙 사진은 비공개 버킷에 두고 어드민만 본다.
 */
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/kakao";
import { applyExpert } from "@/lib/experts";
import { sameOrigin, userIdOf } from "@/lib/session-uid";

export const runtime = "nodejs";
export const maxDuration = 60;
const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "허용되지 않은 요청" }, { status: 403, headers: NO_STORE });
  if (!rateLimit(req, 5, "expert-apply")) return NextResponse.json({ error: "잠시 뒤 다시 시도해 주세요." }, { status: 429, headers: NO_STORE });
  const uid = await userIdOf(req);
  if (!uid) return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401, headers: NO_STORE });
  const fd = await req.formData().catch(() => null);
  if (!fd) return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400, headers: NO_STORE });
  const raw = { realName: fd.get("realName"), affiliation: fd.get("affiliation"), title: fd.get("title"), intro: fd.get("intro") };
  const docs = fd.getAll("doc").filter((x): x is File => x instanceof File && x.size > 0);
  const r = await applyExpert(uid, raw, docs, fd.get("publicConsent") === "on");
  return r.ok ? NextResponse.json({ ok: true }, { headers: NO_STORE }) : NextResponse.json({ error: r.error }, { status: 400, headers: NO_STORE });
}
