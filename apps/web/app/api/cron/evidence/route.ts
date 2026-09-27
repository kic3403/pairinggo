/**
 * GET /api/cron/evidence — 매일 02:00 KST 무렵 근거 링크·인용문 검증 48개(가장 오래 안 본 것부터, 약 2주에 한 바퀴). docs/26 §3-3
 * 판정은 shared pairing/evidence-check.ts, 가져오기·저장은 packages/server/evidence-check.ts. 무게가 바뀌면 카탈로그 version을 올린다.
 */
import { checkEvidenceBatch } from "@pairinggo/server/evidence-check";
import { reportError } from "@pairinggo/server/errors";
import { error, json, NO_CACHE } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return error(req, 401, "권한 없음");
  const limit = Number(new URL(req.url).searchParams.get("limit") || 48) || 48;
  try { return json(req, { ok: true, ...(await checkEvidenceBatch({ limit, conc: 8 })) }, { headers: NO_CACHE }); }
  catch (e) { await reportError("web", "cron/evidence", e).catch(() => {}); return error(req, 500, (e as Error).message); }
}
