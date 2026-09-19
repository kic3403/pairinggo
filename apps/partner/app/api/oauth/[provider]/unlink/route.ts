import { isProvider } from "@/lib/oauth";
import { unlinkIdentity } from "@/lib/partner";
import { partnerOr401 } from "@/lib/session";

/** 간편로그인 연결 끊기 — 비밀번호 없는 계정의 마지막 방법은 끊지 않는다 */
export async function POST(_req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const u = await partnerOr401(); if (u instanceof Response) return u;
  const { provider } = await params;
  if (!isProvider(provider)) return Response.json({ error: "잘못된 요청이에요" }, { status: 400 });
  const r = await unlinkIdentity(u.id, provider);
  return r.ok ? Response.json({ ok: true }) : Response.json({ error: r.problem }, { status: 400 });
}
