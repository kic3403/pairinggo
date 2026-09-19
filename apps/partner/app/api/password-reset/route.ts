import { db } from "@pairinggo/server/db";
import { rateLimit } from "@pairinggo/server/kakao";
import { confirmPasswordReset, startPasswordReset, type ResetAccount } from "@pairinggo/server/password-reset";
import { normalizeMobile } from "@pairinggo/shared";

/**
 * 파트너 비밀번호 재설정 — POST {op:"start", email, phone} · {op:"confirm", email, phone, code, password}.
 * 가입 때 적은 담당자 휴대폰으로 문자 인증. 바꾸면 기존 로그인(서명 쿠키)은 모두 끊긴다(비밀번호 버전이 달라짐).
 */
async function findAccount(emailRaw: string): Promise<ResetAccount> {
  const c = db();
  const email = String(emailRaw ?? "").trim().toLowerCase();
  if (!c || !email) return null;
  const { data } = await c.from("partner_users").select("id, phone").eq("email", email).maybeSingle();
  return data ? { id: String(data.id), phone: normalizeMobile(String(data.phone)) } : null;
}

export async function POST(req: Request) {
  if (!rateLimit(req, 8, "partner-reset")) return Response.json({ error: "잠시 뒤 다시 시도해 주세요" }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as { op?: string; email?: string; phone?: string; code?: string; password?: string };
  if (!normalizeMobile(String(b.phone ?? ""))) return Response.json({ error: "휴대폰 번호를 확인해 주세요(010으로 시작)" }, { status: 400 });
  const account = await findAccount(String(b.email ?? ""));
  const r = b.op === "confirm"
    ? await confirmPasswordReset("partner", account, String(b.code ?? "").trim(), String(b.password ?? ""), async (id, hash) => {
      const { error } = await db()!.from("partner_users").update({ password_hash: hash, failed_logins: 0, locked_until: null }).eq("id", id);
      if (error) throw new Error(error.message);
    })
    : await startPasswordReset("partner", account, String(b.phone ?? ""));
  return r.ok ? Response.json({ ok: true }) : Response.json({ error: r.problem }, { status: 400 });
}
