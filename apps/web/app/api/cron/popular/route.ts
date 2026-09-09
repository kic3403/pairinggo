import { db } from "@/lib/db";
import { error, json, NO_CACHE } from "@/lib/http";

export const runtime = "nodejs";

/** GET /api/cron/popular — 인기 검색어·페어링 피드백 집계 (Vercel Cron, Bearer CRON_SECRET) */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return error(req, 401, "권한 없음");
  const sb = db();
  if (!sb) return json(req, { ok: false, reason: "DB 미설정" }, { status: 202, headers: NO_CACHE });
  const [terms, feedback] = await Promise.all([sb.rpc("refresh_popular_terms", { days: 30, top_n: 50 }), sb.rpc("refresh_pairing_feedback", { days: 90 })]);
  if (terms.error) return error(req, 500, terms.error.message);
  return json(req, { ok: true, popularTerms: terms.data, pairingFeedback: feedback.error ? null : feedback.data }, { headers: NO_CACHE });
}
