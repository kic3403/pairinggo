/**
 * GET /api/cron/weather — 아침(07:30 KST 무렵, Vercel 크론은 한 시간 안에서 흔들림) 날씨 소식 푸시(docs/29 §5-2). `?dry=1`이면 보내지 않고 미리보기.
 * 알림을 켜고 날씨 소식을 받는 회원 가운데 사는 시·도의 지금 날씨가 비·눈·5℃ 미만일 때만, 20시간 안에 두 번 보내지 않는다(lib/push-digest weatherRun).
 */
import { weatherRun } from "@/lib/push-digest";
import { error, json, NO_CACHE } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return error(req, 401, "권한 없음");
  const sp = new URL(req.url).searchParams;
  try {
    const r = await weatherRun({ dry: sp.get("dry") === "1", limit: Number(sp.get("limit") || 500) || 500 });
    return json(req, { ok: true, ...r }, { headers: NO_CACHE });
  } catch (e) { return error(req, 500, (e as Error).message); }
}
