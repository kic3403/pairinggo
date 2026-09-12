import { EventBatchSchema, normalize } from "@pairinggo/shared";
import { getToken } from "next-auth/jwt";
import { db } from "@/lib/db";
import { error, json, preflight, NO_CACHE } from "@/lib/http";

export const runtime = "nodejs";
const MAX_BYTES = 32 * 1024;
const SEARCH_KINDS = new Set(["search", "search_intent", "search_empty"]);

/** POST /api/v1/events — 미니앱 퍼널 이벤트 배치(≤100). DB 미설정이면 202로 받고 버린다 */
export async function POST(req: Request) {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > MAX_BYTES) return error(req, 413, "본문이 너무 큽니다");
  let body: unknown;
  try { body = await req.json(); } catch { return error(req, 400, "JSON 본문이 필요합니다"); }
  const parsed = EventBatchSchema.safeParse(body);
  if (!parsed.success) return error(req, 400, "이벤트 형식 오류", { issues: parsed.error.issues.slice(0, 5).map((i) => i.message) });

  const sb = db();
  if (!sb) return json(req, { accepted: parsed.data.events.length, stored: false }, { status: 202, headers: NO_CACHE });

  // 로그인한 회원이면 회원 id를 함께 남긴다(성별·연령대·지역별 집계용). 세션이 없으면 null.
  // auth() 대신 getToken(): auth()는 응답에 세션 쿠키를 다시 써서(갱신) 첫 화면 로그아웃(/api/auth/reset)과 경합해 쿠키를 되살렸다(실측).
  let userId: string | null = null;
  try {
    const secure = new URL(req.url).protocol === "https:";
    const t = await getToken({ req, secret: process.env.AUTH_SECRET ?? "", secureCookie: secure, salt: secure ? "__Secure-authjs.session-token" : "authjs.session-token" });
    userId = typeof t?.uid === "string" ? t.uid : null;
  } catch { userId = null; }
  const now = Date.now();
  const rows = parsed.data.events.map((e) => {
    const { sid, ...props } = e.p as Record<string, unknown>;
    return { name: e.n, props, session_id: typeof sid === "string" ? sid.slice(0, 40) : null, user_id: userId, client_ts: new Date(Math.min(e.t, now + 60_000)).toISOString() };
  });
  const { error: e1 } = await sb.from("events").insert(rows);
  if (e1) return error(req, 500, "저장 실패");

  const logs = rows.filter((r) => SEARCH_KINDS.has(r.name) && typeof r.props.q === "string" && (r.props.q as string).trim()).map((r) => {
    const q = (r.props.q as string).trim().slice(0, 80);
    const pick = typeof r.props.pick === "string" ? (r.props.pick as string) : null;
    const [mt, mid] = pick ? pick.split(":") : [null, null];
    return { query_text: q, query_norm: normalize(q), kind: r.name, matched_type: r.name === "search_intent" ? "intent" : mt, matched_id: mid, session_id: r.session_id, user_id: userId };
  });
  if (logs.length) { const { error: e2 } = await sb.from("search_logs").insert(logs); if (e2) console.error("[search_logs]", e2.message); }
  return json(req, { accepted: rows.length, stored: true, searchLogs: logs.length }, { headers: NO_CACHE });
}
export function OPTIONS(req: Request) { return preflight(req); }
