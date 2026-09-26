/**
 * 없는 술 추가 요청(docs/25 §5) — 저장·내 요청·어드민 처리. 규칙은 shared drink-request.ts.
 * 열린 요청은 '없는 술' 대기열(lib/wanted.ts)에 source 'request'(무게 4)로 들어간다.
 */
import { DRINK_REQUESTS_PER_DAY, cleanDrinkRequest, drinkRequestProblem, type DrinkRequestStatus } from "@pairinggo/shared";
import { db } from "./db";

const need = () => { const sb = db(); if (!sb) throw new Error("Supabase 미설정"); return sb; };
type Row = { id: number; user_id: string | null; query: string; memo: string; source: "search" | "label"; status: DrinkRequestStatus; drink_id: string | null; admin_note: string; created_at: string; updated_at: string; users?: { name: string | null } | null; drinks?: { name: string | null } | null };

export type DrinkRequestItem = { id: number; query: string; memo: string; source: "search" | "label"; status: DrinkRequestStatus; drinkId: string | null; drinkName: string | null; adminNote: string; at: string; updatedAt: string; nick: string | null };
const toItem = (r: Row): DrinkRequestItem => ({ id: r.id, query: r.query, memo: r.memo, source: r.source, status: r.status, drinkId: r.drink_id, drinkName: r.drinks?.name ?? null, adminNote: r.admin_note, at: r.created_at, updatedAt: r.updated_at, nick: r.users?.name ?? null });
const SELECT = "*,users!drink_requests_user_id_fkey(name),drinks!drink_requests_drink_id_fkey(name)";

/** 요청 저장 — 회원은 하루 10건. 같은 회원이 같은 이름을 열어 둔 채 다시 보내면 그 요청을 돌려준다 */
export async function createDrinkRequest(userId: string | null, input: { query: unknown; memo?: unknown; source?: unknown }): Promise<DrinkRequestItem> {
  const sb = need();
  const problem = drinkRequestProblem(input);
  if (problem) throw new Error(problem);
  const { query, memo } = cleanDrinkRequest(input);
  const source = input.source === "label" ? "label" : "search";
  if (userId) {
    const { data: dup } = await sb.from("drink_requests").select(SELECT).eq("user_id", userId).eq("status", "open").ilike("query", query).limit(1).maybeSingle();
    if (dup) return toItem(dup as unknown as Row);
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { count } = await sb.from("drink_requests").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since);
    if ((count ?? 0) >= DRINK_REQUESTS_PER_DAY) throw new Error(`하루에 ${DRINK_REQUESTS_PER_DAY}개까지 요청할 수 있어요.`);
  }
  const { data, error } = await sb.from("drink_requests").insert({ user_id: userId, query, memo, source }).select(SELECT).single();
  if (error || !data) throw new Error(error?.message ?? "저장 실패");
  return toItem(data as unknown as Row);
}

export async function myDrinkRequests(userId: string, limit = 30): Promise<DrinkRequestItem[]> {
  const sb = db();
  if (!sb) return [];
  const { data } = await sb.from("drink_requests").select(SELECT).eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
  return ((data ?? []) as unknown as Row[]).map(toItem);
}

/** 대기열 입력용 — 열린 요청(90일) */
export async function openDrinkRequests(sinceIso: string): Promise<{ query: string; at: string }[]> {
  const sb = db();
  if (!sb) return [];
  const { data } = await sb.from("drink_requests").select("query,created_at").eq("status", "open").gte("created_at", sinceIso).limit(2000);
  return ((data ?? []) as { query: string; created_at: string }[]).map((r) => ({ query: r.query, at: r.created_at }));
}

/* ---------- 어드민 ---------- */
export async function adminDrinkRequests(view: "open" | "all", limit = 200): Promise<DrinkRequestItem[]> {
  const sb = need();
  let q = sb.from("drink_requests").select(SELECT).order("created_at", { ascending: false }).limit(limit);
  if (view === "open") q = q.eq("status", "open");
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Row[]).map(toItem);
}

/** 처리 — done이면 drink_id(카탈로그에 있어야) 필수, rejected는 사유 선택, open으로 되돌리기 가능 */
export async function resolveDrinkRequest(id: number, input: { status: unknown; drinkId?: unknown; note?: unknown }): Promise<void> {
  const sb = need();
  if (!Number.isInteger(id) || id <= 0) throw new Error("잘못된 id");
  const status = String(input.status) as DrinkRequestStatus;
  if (!["open", "done", "rejected"].includes(status)) throw new Error("알 수 없는 상태");
  let drinkId: string | null = null;
  if (status === "done") {
    drinkId = String(input.drinkId ?? "").trim();
    const { data } = await sb.from("drinks").select("id").eq("id", drinkId).maybeSingle();
    if (!data) throw new Error("등록됨으로 표시하려면 카탈로그 술을 골라 주세요");
  }
  const { error } = await sb.from("drink_requests").update({ status, drink_id: drinkId, admin_note: String(input.note ?? "").slice(0, 200), updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}
