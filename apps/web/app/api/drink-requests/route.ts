/**
 * 없는 술 추가 요청 API(docs/25 §5) — POST { query, memo?, source? } → { ok, request }. 로그인은 선택(회원이면 마이페이지에서 결과를 본다).
 * 비회원은 IP당 분당 5번(rateLimit), 회원은 하루 10건(lib).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/kakao";
import { createDrinkRequest } from "@/lib/drink-requests";
import { sameOrigin, userIdOf } from "@/lib/session-uid";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store" };
const Body = z.object({ query: z.string().max(200), memo: z.string().max(400).optional(), source: z.enum(["search", "label"]).optional() });

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "허용되지 않은 요청" }, { status: 403, headers: NO_STORE });
  if (!rateLimit(req, 5, "drink-request")) return NextResponse.json({ error: "잠시 뒤 다시 시도해 주세요." }, { status: 429, headers: NO_STORE });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400, headers: NO_STORE });
  const uid = await userIdOf(req);
  try {
    const request = await createDrinkRequest(uid, parsed.data);
    return NextResponse.json({ ok: true, request, loggedIn: !!uid }, { headers: NO_STORE });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400, headers: NO_STORE }); }
}
