/**
 * GET /api/cron/ops-report — 월요일 09:30 KST 운영 리포트 이메일(lib/ops-report). `?dry=1`이면 보내지 않고 본문만 돌려준다.
 */
import { weeklyOpsReport } from "@/lib/ops-report";
import { error, json, NO_CACHE } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return error(req, 401, "권한 없음");
  const sp = new URL(req.url).searchParams;
  try {
    const r = await weeklyOpsReport({ dry: sp.get("dry") === "1" });
    return json(req, { ok: true, ...r }, { headers: NO_CACHE });
  } catch (e) { return error(req, 500, (e as Error).message); }
}
