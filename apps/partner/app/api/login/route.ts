import { cookies } from "next/headers";
import { rateLimit } from "@pairinggo/server/kakao";
import { checkLogin } from "@/lib/partner";
import { authConfigured, COOKIE, cookieOptions, issueToken } from "@/lib/session";

export async function POST(req: Request) {
  if (!authConfigured()) return Response.json({ error: "로그인 설정이 아직 없어요(PARTNER_AUTH_SECRET)" }, { status: 503 });
  if (!rateLimit(req, 10)) return Response.json({ error: "잠시 뒤 다시 시도해 주세요" }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const r = await checkLogin(String(b.email ?? ""), String(b.password ?? ""));
  if (!r.ok) return Response.json({ error: r.problem }, { status: 400 });
  (await cookies()).set(COOKIE, issueToken(r.id, r.passwordHash), cookieOptions);
  return Response.json({ ok: true });
}
