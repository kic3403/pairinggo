/** 파트너 앱 화면 오류 받기 — app/error.tsx가 보낸다. 페어링GO 어드민 /admin/errors에 모인다 */
import { reportError } from "@pairinggo/server/errors";
import { rateLimit } from "@pairinggo/server/kakao";

export async function POST(req: Request) {
  if (!rateLimit(req, 10, "client-error")) return Response.json({ ok: false }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as { message?: string; digest?: string; path?: string };
  await reportError("partner-client", String(b.path ?? "").split("?")[0].slice(0, 120) || "(알 수 없음)", { message: String(b.message ?? "").slice(0, 300), digest: b.digest }, { ua: (req.headers.get("user-agent") ?? "").slice(0, 120) });
  return Response.json({ ok: true });
}
