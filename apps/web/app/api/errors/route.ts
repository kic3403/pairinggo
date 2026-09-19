/** 화면(브라우저) 오류 받기 — (site)/error.tsx가 보낸다. { message, digest, path } · 분당 10건 */
import { NextResponse } from "next/server";
import { reportError } from "@pairinggo/server/errors";
import { rateLimit } from "@/lib/kakao";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!rateLimit(req, 10, "client-error")) return NextResponse.json({ ok: false }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as { message?: string; digest?: string; path?: string };
  await reportError("web-client", String(b.path ?? "").split("?")[0].slice(0, 120) || "(알 수 없음)", { message: String(b.message ?? "").slice(0, 300), digest: b.digest }, { ua: (req.headers.get("user-agent") ?? "").slice(0, 120) });
  return NextResponse.json({ ok: true });
}
