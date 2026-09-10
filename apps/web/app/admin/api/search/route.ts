import { NextResponse } from "next/server";
import { search } from "@pairinggo/shared";
import { guardApi } from "@/lib/admin-auth";
import { getCatalog } from "@/lib/catalog";
export const runtime = "nodejs";
/** 엔티티 지정용 검색: ?q=&type=drink|food → 상위 6 */
export async function GET(req: Request) {
  const g = await guardApi(); if (g) return g;
  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") || "").trim(); const type = sp.get("type") === "food" ? "food" : "drink";
  if (!q) return NextResponse.json({ items: [] });
  await getCatalog();
  const r = search(q, { types: [type], limit: 6 });
  return NextResponse.json({ items: r.hits.map((h) => ({ id: h.doc.id, name: h.doc.name, kind: h.kind })) });
}
