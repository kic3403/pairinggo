/** 사장님 리뷰 답글(2026-10-01) — POST { id, body } → { ok, reply }. 빈 body면 답글 삭제. 내 매장 리뷰만(server review-replies) */
import { saveOwnerReply } from "@pairinggo/server/review-replies";
import { approvedOrError } from "@/lib/partner";

export async function POST(req: Request) {
  const a = await approvedOrError();
  if (a instanceof Response) return a;
  const b = (await req.json().catch(() => ({}))) as { id?: unknown; body?: unknown };
  const r = await saveOwnerReply(a.merchant, Number(b.id), b.body);
  return r.ok ? Response.json(r) : Response.json({ error: r.error }, { status: 400 });
}
