/** 휴대폰 문자 인증 — GET 내 상태 · POST {op:"start", phone} 인증번호 보내기 · {op:"confirm", code} 확인 */
import { NextResponse } from "next/server";
import { maskMobile } from "@pairinggo/shared";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/kakao";
import { confirmVerification, phoneState, startVerification } from "@/lib/phone-verify";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  const uid = (await auth())?.user?.id;
  if (!uid) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401, headers: NO_STORE });
  const s = await phoneState(uid);
  return NextResponse.json({ phone: s.phone ? maskMobile(s.phone) : null, verified: s.verified, available: s.available }, { headers: NO_STORE });
}

export async function POST(req: Request) {
  const uid = (await auth())?.user?.id;
  if (!uid) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  if (!rateLimit(req, 10, "phone")) return NextResponse.json({ error: "잠시 뒤 다시 시도해 주세요" }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as { op?: string; phone?: string; code?: string };
  const r = b.op === "confirm" ? await confirmVerification(uid, String(b.code ?? "").trim()) : await startVerification(uid, String(b.phone ?? ""));
  if (!r.ok) return NextResponse.json({ error: r.problem }, { status: 400 });
  return NextResponse.json({ ok: true, phone: maskMobile(r.phone), verified: b.op === "confirm" });
}
