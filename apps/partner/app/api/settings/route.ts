import { saveSettings } from "@pairinggo/server/merchant-store";
import { approvedOrError } from "@/lib/partner";

export async function POST(req: Request) {
  const a = await approvedOrError(); if (a instanceof Response) return a;
  try { return Response.json({ ok: true, settings: await saveSettings(a.merchant, a.user.id, await req.json()) }); }
  catch (e) { return Response.json({ error: (e as Error).message }, { status: 400 }); }
}
