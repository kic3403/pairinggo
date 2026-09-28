import { removePartnerPairing, savePartnerPairing } from "@pairinggo/server/partner-pairings";
import { approvedOrError } from "@/lib/partner";

/** 파트너 페어링 — 추가(POST 양조장 {drinkId, foodText, note} · 식당 {drinkText, foodText, note}) · 삭제(DELETE {id}). 양조장·식당 파트너만(서버가 다시 확인) */
export async function POST(req: Request) {
  const a = await approvedOrError(); if (a instanceof Response) return a;
  try {
    const b = (await req.json()) as { drinkId?: string; drinkText?: string; foodText?: string; note?: string };
    return Response.json({ ok: true, row: await savePartnerPairing(a.merchant, b) });
  } catch (e) { return Response.json({ error: (e as Error).message }, { status: 400 }); }
}

export async function DELETE(req: Request) {
  const a = await approvedOrError(); if (a instanceof Response) return a;
  try {
    const b = (await req.json()) as { id?: number };
    await removePartnerPairing(a.merchant, Number(b.id));
    return Response.json({ ok: true });
  } catch (e) { return Response.json({ error: (e as Error).message }, { status: 400 }); }
}
