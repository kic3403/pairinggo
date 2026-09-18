import { changeClosure, getClosures } from "@pairinggo/server/merchant-store";
import { approvedOrError } from "@/lib/partner";

/** 임시 휴무 { op: add|remove, day, note } */
export async function POST(req: Request) {
  const a = await approvedOrError(); if (a instanceof Response) return a;
  try {
    const b = (await req.json()) as { op?: "add" | "remove"; day?: string; note?: string };
    const r = await changeClosure(a.merchant, a.user.id, b.op === "remove" ? "remove" : "add", String(b.day ?? ""), String(b.note ?? ""));
    return Response.json({ ok: true, ...r, closures: await getClosures(a.merchant.id) });
  } catch (e) { return Response.json({ error: (e as Error).message }, { status: 400 }); }
}
