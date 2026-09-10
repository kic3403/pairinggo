import { NextResponse } from "next/server";
import { guardApi } from "@/lib/admin-auth";
import { promote } from "@/lib/admin-data";
export const runtime = "nodejs";
export async function POST(req: Request) {
  const g = await guardApi(); if (g) return g;
  try {
    const b = await req.json();
    const score = Math.round(Number(b.score));
    if (!Number.isFinite(score) || score < 84 || score > 97) return NextResponse.json({ error: "점수는 84~97" }, { status: 400 });
    if (!b.reason || String(b.reason).trim().length < 4) return NextResponse.json({ error: "추천 이유를 적어 주세요" }, { status: 400 });
    const r = await promote({ candidateId: Number(b.candidateId), score, tier: String(b.tier || "blog"), who: b.who ? String(b.who).slice(0, 60) : null, reason: String(b.reason).slice(0, 300), reviewer: String(b.reviewer || "운영자").slice(0, 40) });
    return NextResponse.json(r);
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}
