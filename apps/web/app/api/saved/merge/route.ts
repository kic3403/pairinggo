/** 비로그인 때 기기에 담은 저장을 로그인 뒤 계정으로 옮긴다(2026-10-01) — 더하기만, 이미 있는 것은 그대로. 규칙은 shared guest-saved.ts */
import { NextResponse } from "next/server";
import { z } from "zod";
import { GUEST_SAVED_MAX } from "@pairinggo/shared";
import { auth } from "@/auth";
import { mergeSaved, type SavedKind } from "@/lib/saved";

const Meta = z.object({
  name: z.string().max(120).optional(),
  address: z.string().max(200).optional(),
  phone: z.string().max(40).optional(),
  url: z.string().max(300).optional(),
  category: z.string().max(80).optional(),
  food: z.string().max(60).optional(),
}).strict().optional();
const Body = z.object({ items: z.array(z.object({ kind: z.enum(["drink", "food", "place"]), id: z.string().min(1).max(80), meta: Meta })).max(GUEST_SAVED_MAX) });

export async function POST(req: Request) {
  const uid = (await auth())?.user?.id;
  if (!uid) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
  try {
    const added = await mergeSaved(uid, parsed.data.items.map((x) => ({ kind: x.kind as SavedKind, id: x.id, meta: x.meta ?? null })));
    return NextResponse.json({ added });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }
}
