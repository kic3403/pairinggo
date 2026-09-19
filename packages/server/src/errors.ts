/**
 * 운영 오류 기록(2026-09-19) — 서버에서 처리 못 한 오류와 주요 실패(예약 저장·알림·크론·메뉴판 읽기)를 server_errors(0026)에 모은다.
 * 같은 오류는 한 줄로 묶어 횟수만 센다(숫자·id를 뺀 메시지로 지문). 어드민 /admin/errors에서 보고 "해결" 표시.
 * 기록이 실패해도 요청을 막지 않는다(절대 throw하지 않음). 메시지·경로만 — 개인정보(번호·이메일)는 넣지 않는다.
 */
import { createHash } from "node:crypto";
import { db } from "./db";

export type ErrorApp = "web" | "partner" | "web-client" | "partner-client";

const clean = (s: string) => s
  .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<id>")
  .replace(/\b01[016789]-?\d{3,4}-?\d{4}\b/g, "<phone>")
  .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "<email>")
  .replace(/\d+/g, "#")
  .slice(0, 300);

export async function reportError(app: ErrorApp, place: string, err: unknown, extra: Record<string, unknown> = {}): Promise<void> {
  try {
    const e = err as { message?: string; stack?: string; digest?: string };
    const raw = typeof err === "string" ? err : e?.message ?? String(err);
    console.error(`[${app}:${place}]`, raw);
    // 로컬 개발 서버도 운영과 같은 DB를 쓴다 — 개발 중 오류가 운영 어드민에 섞이지 않게(시험할 때만 ERROR_LOG_DEV=1)
    if (process.env.NODE_ENV !== "production" && !process.env.ERROR_LOG_DEV) return;
    const c = db();
    if (!c) return;
    const message = clean(raw) || "(메시지 없음)";
    const fingerprint = createHash("sha1").update(`${app}|${place}|${message}`).digest("hex");
    const now = new Date().toISOString();
    const sample = { ...extra, digest: e?.digest ?? null, stack: e?.stack ? clean(e.stack.split("\n").slice(0, 6).join("\n")).slice(0, 1200) : null };
    const { data: cur } = await c.from("server_errors").select("id, count").eq("fingerprint", fingerprint).maybeSingle();
    if (cur) await c.from("server_errors").update({ count: Number(cur.count) + 1, last_at: now, sample, resolved_at: null }).eq("id", cur.id);
    else await c.from("server_errors").insert({ app, place: place.slice(0, 120), message, fingerprint, sample });
  } catch { /* 기록 실패는 무시 */ }
}

export type ServerError = { id: number; app: string; place: string; message: string; count: number; firstAt: string; lastAt: string; sample: Record<string, unknown>; resolvedAt: string | null };

export async function recentErrors(limit = 100): Promise<ServerError[]> {
  const c = db();
  if (!c) return [];
  const { data } = await c.from("server_errors").select("*").order("resolved_at", { ascending: true, nullsFirst: true }).order("last_at", { ascending: false }).limit(limit);
  return (data ?? []).map((r) => ({ id: Number(r.id), app: String(r.app), place: String(r.place), message: String(r.message), count: Number(r.count), firstAt: String(r.first_at), lastAt: String(r.last_at), sample: (r.sample ?? {}) as Record<string, unknown>, resolvedAt: (r.resolved_at as string) ?? null }));
}

/** 어드민 첫 화면 알림 — 최근 24시간에 다시 난 미해결 오류 줄 수 */
export async function openErrorCount(): Promise<number> {
  const c = db();
  if (!c) return 0;
  const { count } = await c.from("server_errors").select("id", { count: "exact", head: true }).is("resolved_at", null).gte("last_at", new Date(Date.now() - 86400_000).toISOString());
  return count ?? 0;
}

export async function resolveError(id: number): Promise<void> {
  await db()?.from("server_errors").update({ resolved_at: new Date().toISOString() }).eq("id", id);
}

/** 공용 서버 코드(packages/server)가 어느 앱에서 돌고 있나 — 파트너 앱에는 Auth.js 비밀(AUTH_SECRET)이 없다 */
export const currentApp = (): ErrorApp => (process.env.PARTNER_AUTH_SECRET && !process.env.AUTH_SECRET ? "partner" : "web");
