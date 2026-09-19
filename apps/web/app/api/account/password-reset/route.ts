/**
 * 비밀번호 재설정(이메일 회원) — POST {op:"start", email, phone} 인증번호 문자 · {op:"confirm", email, phone, code, password} 새 비밀번호.
 * 휴대폰을 인증한(식당 예약 때) 이메일 회원만. 계정이 있는지는 드러내지 않는다(start는 번호가 맞든 아니든 같은 안내).
 */
import { NextResponse } from "next/server";
import { normalizeMobile } from "@pairinggo/shared";
import { confirmPasswordReset, startPasswordReset, type ResetAccount } from "@pairinggo/server/password-reset";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/kakao";
import { emailLooksValid, normalizeEmail } from "@/lib/password";

export const runtime = "nodejs";

async function findAccount(emailRaw: string): Promise<ResetAccount> {
  const email = normalizeEmail(emailRaw);
  const c = db();
  if (!c || !emailLooksValid(email)) return null;
  const { data } = await c.from("users").select("id, phone, phone_verified_at").eq("provider", "email").ilike("email", email).maybeSingle();
  return data && data.phone_verified_at && data.phone ? { id: String(data.id), phone: String(data.phone) } : null;
}

export async function POST(req: Request) {
  if (!rateLimit(req, 8, "password-reset")) return NextResponse.json({ error: "잠시 뒤 다시 시도해 주세요" }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as { op?: string; email?: string; phone?: string; code?: string; password?: string };
  if (!normalizeMobile(String(b.phone ?? ""))) return NextResponse.json({ error: "휴대폰 번호를 확인해 주세요(010으로 시작)" }, { status: 400 });
  const account = await findAccount(String(b.email ?? ""));
  if (b.op === "confirm") {
    const r = await confirmPasswordReset("user", account, String(b.code ?? "").trim(), String(b.password ?? ""), async (id, hash) => {
      const { error } = await db()!.from("users").update({ password_hash: hash, failed_attempts: 0, locked_until: null }).eq("id", id);
      if (error) throw new Error(error.message);
    });
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.problem }, { status: 400 });
  }
  const r = await startPasswordReset("user", account, String(b.phone ?? ""));
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.problem }, { status: 400 });
}
