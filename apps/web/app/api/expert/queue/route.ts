/** 전문가 검수 대기열(docs/27) — GET ?kind=&offset= → { items, total }. 순서 규칙은 lib/experts.ts expertQueue */
import { NextResponse } from "next/server";
import { DRINK_KINDS } from "@pairinggo/shared";
import { expertQueue, requireExpert } from "@/lib/experts";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(req: Request) {
  const x = await requireExpert(req); if (x instanceof Response) return x;
  const u = new URL(req.url);
  const kind = u.searchParams.get("kind");
  const k = kind && DRINK_KINDS.some((d) => d.id === kind) ? kind : null;
  try { return NextResponse.json(await expertQueue(x.userId, { kind: k, offset: Number(u.searchParams.get("offset")) || 0 }), { headers: NO_STORE }); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400, headers: NO_STORE }); }
}
