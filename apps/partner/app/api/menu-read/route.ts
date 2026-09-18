import { db } from "@pairinggo/server/db";
import { rateLimit } from "@pairinggo/server/kakao";
import { catalogNames } from "@pairinggo/server/merchant-store";
import { checkMenuImages, menuReadConfigured, menuReadError, readMenuImages } from "@pairinggo/server/menu-read";
import { approvedOrError } from "@/lib/partner";

export const runtime = "nodejs";
export const maxDuration = 60;

/** 매장당 하루 사진 읽기 횟수(AI 호출 비용 관리) — 한 번에 사진 4장까지 */
const READS_PER_DAY = 20;

/**
 * 메뉴판 사진 읽기: POST { images: [{ type, data(base64) }] } → { items, note, left }.
 * 사진은 저장하지 않는다. 읽은 결과는 화면의 표에 더해질 뿐이고, 사장님이 [저장]을 눌러야 반영된다.
 */
export async function POST(req: Request) {
  const a = await approvedOrError(); if (a instanceof Response) return a;
  if (!menuReadConfigured()) return Response.json({ error: "메뉴판 자동 읽기를 준비하고 있어요 — 표에 직접 적어 주세요" }, { status: 503 });
  if (!rateLimit(req, 5, "menu-read")) return Response.json({ error: "잠시 뒤 다시 시도해 주세요" }, { status: 429 });
  const c = db()!;
  const since = new Date(Date.now() - 86400_000).toISOString();
  const { count } = await c.from("menu_reads").select("id", { count: "exact", head: true }).eq("merchant_id", a.merchant.id).gte("created_at", since);
  if ((count ?? 0) >= READS_PER_DAY) return Response.json({ error: `사진 읽기는 하루 ${READS_PER_DAY}번까지예요 — 내일 다시 시도하거나 표에 직접 적어 주세요` }, { status: 429 });

  const chk = checkMenuImages(await req.json().catch(() => null));
  if (!chk.ok) return Response.json({ error: chk.error }, { status: chk.status });
  const log = (ok: boolean, items: number, error = "") =>
    c.from("menu_reads").insert({ merchant_id: a.merchant.id, partner_user_id: a.user.id, images: chk.images.length, items, ok, error: error.slice(0, 300) });
  try {
    const cat = await catalogNames();
    const r = await readMenuImages(chk.images, { drinks: cat.drinks.map((d) => d.name), foods: cat.foods.map((f) => f.name) });
    await log(true, r.items.length);
    return Response.json({ items: r.items, note: r.note, left: READS_PER_DAY - (count ?? 0) - 1 });
  } catch (e) {
    const m = menuReadError(e);
    await log(false, 0, m.error);
    return Response.json({ error: m.error }, { status: m.status });
  }
}
