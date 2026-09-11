/** 저장 토글·조회 — 로그인한 본인 것만. 세션의 user.id로 범위가 정해지므로 다른 사용자 데이터에 닿을 수 없다. */
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { listSaved, toggleSaved, type SavedKind } from "@/lib/saved";

const Meta = z.object({
  name: z.string().max(120).optional(),
  address: z.string().max(200).optional(),
  phone: z.string().max(40).optional(),
  url: z.string().max(300).optional(),
  category: z.string().max(80).optional(),
  food: z.string().max(60).optional(),
}).strict().optional();

const Body = z.object({ kind: z.enum(["drink", "food", "place"]), id: z.string().min(1).max(80), meta: Meta });

export async function GET() {
  const uid = (await auth())?.user?.id;
  if (!uid) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  try { return NextResponse.json({ items: await listSaved(uid) }); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }
}

export async function POST(req: Request) {
  const uid = (await auth())?.user?.id;
  if (!uid) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
  try {
    const saved = await toggleSaved(uid, parsed.data.kind as SavedKind, parsed.data.id, parsed.data.meta ?? null);
    return NextResponse.json({ saved });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }
}
