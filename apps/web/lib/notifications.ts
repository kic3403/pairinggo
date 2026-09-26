/**
 * 알림(docs/25 §6) — 공지(notices 표)와 활동(내 요청·내 추천에 달린 하트·예약·주문의 상태 변화).
 * 활동은 따로 저장하지 않고 있는 표에서 모아 만든다(최근 30일, 30개). 읽은 시각은 users.notif_seen_at.
 */
import { D, F, ORDER_STATUS_LABEL, STATUS_LABEL, activeNotices, noticeProblem, toSlug, type ActivityItem, type NoticeItem, type NoticeRow, type OrderStatus, type ReservationStatus } from "@pairinggo/shared";
import { getCatalog } from "./catalog";
import { db } from "./db";

const need = () => { const sb = db(); if (!sb) throw new Error("Supabase 미설정"); return sb; };
const kstToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const DAYS = 30;

export async function listNotices(): Promise<NoticeItem[]> {
  const sb = db();
  if (!sb) return [];
  const { data } = await sb.from("notices").select("*").eq("active", true).order("created_at", { ascending: false }).limit(60);
  return activeNotices((data ?? []) as NoticeRow[], kstToday());
}

const kstShort = (iso: string) => { const d = new Date(new Date(iso).getTime() + 9 * 3600_000); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`; };

/** 내 활동 — 요청 처리 · 내 추천에 하트 · 예약 상태 · 주문 상태 */
export async function myActivity(uid: string): Promise<ActivityItem[]> {
  const sb = db();
  if (!sb) return [];
  await getCatalog();
  const since = new Date(Date.now() - DAYS * 86400_000).toISOString();
  const [req, likes, resv, orders] = await Promise.all([
    sb.from("drink_requests").select("id,query,status,drink_id,admin_note,updated_at").eq("user_id", uid).neq("status", "open").gte("updated_at", since).order("updated_at", { ascending: false }).limit(20),
    sb.from("member_pick_likes").select("pick_id,created_at,users!member_pick_likes_user_id_fkey(name),member_picks!inner(user_id,drink_id,food_id,drink_raw,food_raw)").eq("member_picks.user_id", uid).neq("user_id", uid).gte("created_at", since).order("created_at", { ascending: false }).limit(30),
    sb.from("reservations").select("id,status,visit_date,visit_time,updated_at,merchants!reservations_merchant_id_fkey(name)").eq("user_id", uid).gte("updated_at", since).order("updated_at", { ascending: false }).limit(20),
    sb.from("orders").select("id,order_no,status,updated_at").eq("user_id", uid).gte("updated_at", since).order("updated_at", { ascending: false }).limit(20),
  ]);
  const out: ActivityItem[] = [];
  for (const r of (req.data ?? []) as { id: number; query: string; status: string; drink_id: string | null; admin_note: string; updated_at: string }[]) {
    const d = r.drink_id ? D[r.drink_id] : null;
    out.push(r.status === "done"
      ? { id: `req${r.id}`, kind: "request", text: `요청하신 ‘${r.query}’${d ? `(${d.name})` : ""}이 등록됐어요`, href: d ? `/drinks/${toSlug(d.name)}` : "/my#requests", at: r.updated_at }
      : { id: `req${r.id}`, kind: "request", text: `요청하신 ‘${r.query}’은 보류됐어요${r.admin_note ? ` · ${r.admin_note}` : ""}`, href: "/my#requests", at: r.updated_at });
  }
  for (const l of (likes.data ?? []) as unknown as { pick_id: number; created_at: string; users: { name: string | null } | null; member_picks: { drink_id: string | null; food_id: string | null; drink_raw: string | null; food_raw: string | null } }[]) {
    const p = l.member_picks;
    const dn = (p.drink_id && D[p.drink_id]?.name) || p.drink_raw || "술", fn = (p.food_id && F[p.food_id]?.name) || p.food_raw || "음식";
    out.push({ id: `like${l.pick_id}-${l.created_at}`, kind: "like", text: `${(l.users?.name || "회원").slice(0, 20)}님이 내 추천 ‘${dn} × ${fn}’에 하트를 눌렀어요`, href: "/my", at: l.created_at });
  }
  for (const r of (resv.data ?? []) as unknown as { id: string; status: ReservationStatus; visit_date: string; visit_time: string; updated_at: string; merchants: { name: string } | null }[]) {
    out.push({ id: `resv${r.id}`, kind: "reservation", text: `${r.merchants?.name ?? "매장"} 예약 — ${STATUS_LABEL[r.status] ?? r.status} · ${kstShort(r.visit_date)} ${r.visit_time}`, href: "/my/reservations", at: r.updated_at });
  }
  for (const o of (orders.data ?? []) as { id: string; order_no: string; status: OrderStatus; updated_at: string }[]) {
    out.push({ id: `order${o.id}`, kind: "order", text: `주문 ${o.order_no} — ${ORDER_STATUS_LABEL[o.status] ?? o.status}`, href: "/orders", at: o.updated_at });
  }
  return out.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 30);
}

export async function notifSeenAt(uid: string): Promise<string | null> {
  const sb = db();
  if (!sb) return null;
  const { data } = await sb.from("users").select("notif_seen_at").eq("id", uid).maybeSingle();
  return (data?.notif_seen_at as string | null) ?? null;
}
export async function markNotifSeen(uid: string): Promise<string> {
  const now = new Date().toISOString();
  const { error } = await need().from("users").update({ notif_seen_at: now }).eq("id", uid);
  if (error) throw new Error(error.message);
  return now;
}

/* ---------- 어드민 ---------- */
export type AdminNotice = { id: number; kind: string; title: string; body: string; href: string; startsOn: string; endsOn: string; active: boolean; at: string };
export async function adminNotices(): Promise<AdminNotice[]> {
  const { data, error } = await need().from("notices").select("*").order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  return ((data ?? []) as NoticeRow[]).map((r) => ({ id: r.id, kind: r.kind, title: r.title, body: r.body, href: r.href, startsOn: r.starts_on ?? "", endsOn: r.ends_on ?? "", active: r.active, at: r.created_at }));
}
export async function saveNotice(input: { id?: unknown; kind?: unknown; title: unknown; body?: unknown; href?: unknown; startsOn?: unknown; endsOn?: unknown; active?: unknown }): Promise<number> {
  const sb = need();
  const problem = noticeProblem(input);
  if (problem) throw new Error(problem);
  const row = {
    kind: ["notice", "event", "update"].includes(String(input.kind)) ? String(input.kind) : "notice",
    title: String(input.title).trim(), body: String(input.body ?? "").trim(), href: String(input.href ?? "").trim(),
    starts_on: String(input.startsOn ?? "") || null, ends_on: String(input.endsOn ?? "") || null,
    active: input.active !== false && input.active !== "false", updated_at: new Date().toISOString(),
  };
  const id = Number(input.id);
  if (Number.isInteger(id) && id > 0) { const { error } = await sb.from("notices").update(row).eq("id", id); if (error) throw new Error(error.message); return id; }
  const { data, error } = await sb.from("notices").insert(row).select("id").single();
  if (error || !data) throw new Error(error?.message ?? "저장 실패");
  return Number(data.id);
}
export async function deleteNotice(id: number): Promise<void> {
  const { error } = await need().from("notices").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
