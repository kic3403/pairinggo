/**
 * GET /api/cron/weekly — 월요일 아침(09:00 KST 무렵) 주간 소식 푸시(docs/25 §7). `?dry=1`이면 보내지 않고 미리보기.
 * 알림을 켠 기기가 있는 회원에게만, 내용이 있을 때만, 6일 안에 두 번 보내지 않는다(lib/push-digest weeklyRun).
 */
import { weeklyRun } from "@/lib/push-digest";
import { error, json, NO_CACHE } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return error(req, 401, "권한 없음");
  const sp = new URL(req.url).searchParams;
  try {
    const r = await weeklyRun({ dry: sp.get("dry") === "1", limit: Number(sp.get("limit") || 500) || 500 });
    return json(req, { ok: true, ...r }, { headers: NO_CACHE });
  } catch (e) { return error(req, 500, (e as Error).message); }
}
