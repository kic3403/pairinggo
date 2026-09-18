import { saveHours } from "@pairinggo/server/merchant-store";
import { approvedOrError } from "@/lib/partner";

export async function POST(req: Request) {
  const a = await approvedOrError(); if (a instanceof Response) return a;
  try {
    const b = (await req.json()) as { hours?: unknown[] };
    return Response.json({ ok: true, hours: await saveHours(a.merchant, a.user.id, b.hours ?? []) });
  } catch (e) { return Response.json({ error: (e as Error).message }, { status: 400 }); }
}
