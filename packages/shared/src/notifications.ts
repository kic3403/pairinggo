/**
 * 헤더의 두 버튼(2026-09-26 사용자 요청, 캐치테이블 참고 — docs/25 §6)
 *  ① 최근 본 — 매장·술·음식 세 탭. 기기별 localStorage(서버 저장 없음), 30개, 같은 것은 앞으로 당긴다.
 *  ② 알림 — 공지(운영자 글, notices 표)·활동(내 요청·하트·예약·주문의 상태 변화). 읽지 않은 수를 버튼 위 배지에.
 * 순수 규칙만 — 저장·조회는 web lib/notifications.ts.
 */
export type RecentKind = "place" | "drink" | "food";
export const RECENT_KINDS: RecentKind[] = ["place", "drink", "food"];
export const RECENT_KIND_LABEL: Record<RecentKind, string> = { place: "매장", drink: "술", food: "음식" };
export const RECENT_MAX = 30;
export type RecentItem = { kind: RecentKind; id: string; name: string; meta?: string; href: string; at: number };

/** 목록 맨 앞에 넣는다 — 같은 것(kind+id)은 하나만, 30개까지 */
export function pushRecent(list: RecentItem[], item: Omit<RecentItem, "at">, now = Date.now()): RecentItem[] {
  const rest = list.filter((x) => !(x.kind === item.kind && x.id === item.id));
  return [{ ...item, at: now }, ...rest].slice(0, RECENT_MAX);
}
/** localStorage에서 읽은 값 정리 — 모양이 어긋난 항목은 버린다 */
export function cleanRecent(raw: unknown): RecentItem[] {
  if (!Array.isArray(raw)) return [];
  const out: RecentItem[] = [];
  for (const x of raw as Partial<RecentItem>[]) {
    if (!x || !RECENT_KINDS.includes(x.kind as RecentKind) || typeof x.id !== "string" || typeof x.name !== "string" || typeof x.href !== "string" || !x.href.startsWith("/")) continue;
    out.push({ kind: x.kind as RecentKind, id: x.id, name: x.name.slice(0, 60), meta: typeof x.meta === "string" ? x.meta.slice(0, 80) : undefined, href: x.href.slice(0, 300), at: typeof x.at === "number" ? x.at : 0 });
    if (out.length >= RECENT_MAX) break;
  }
  return out;
}

/* ---------- 공지 ---------- */
export type NoticeKind = "notice" | "event" | "update";
export const NOTICE_KIND_LABEL: Record<NoticeKind, string> = { notice: "공지", event: "이벤트", update: "업데이트" };
export const NOTICE_TITLE_MAX = 60, NOTICE_BODY_MAX = 300;
export type NoticeItem = { id: number; kind: NoticeKind; title: string; body: string; href: string; at: string };
export type NoticeRow = { id: number; kind: string; title: string; body: string; href: string; starts_on: string | null; ends_on: string | null; active: boolean; created_at: string };

const hrefOk = (h: string) => h === "" || (h.startsWith("/") && !h.startsWith("//")) || /^https:\/\/[^\s"'<>]+$/.test(h);
export function noticeProblem(input: { title: unknown; body?: unknown; href?: unknown; kind?: unknown; startsOn?: unknown; endsOn?: unknown }): string | null {
  const title = String(input.title ?? "").trim();
  if (title.length < 2) return "제목을 두 글자 이상 적어 주세요.";
  if (title.length > NOTICE_TITLE_MAX) return `제목은 ${NOTICE_TITLE_MAX}자까지예요.`;
  if (String(input.body ?? "").trim().length > NOTICE_BODY_MAX) return `본문은 ${NOTICE_BODY_MAX}자까지예요.`;
  if (!hrefOk(String(input.href ?? "").trim())) return "링크는 사이트 안 주소(/…)나 https://… 만 됩니다.";
  if (input.kind != null && input.kind !== "" && !(input.kind as string in NOTICE_KIND_LABEL)) return "종류가 올바르지 않아요.";
  const s = String(input.startsOn ?? ""), e = String(input.endsOn ?? "");
  if (s && e && s > e) return "시작일이 종료일보다 늦어요.";
  return null;
}
/** 오늘(KST, YYYY-MM-DD) 기준으로 보이는 공지 — 켜져 있고 기간 안. 최신순 */
export function activeNotices(rows: NoticeRow[], today: string, limit = 20): NoticeItem[] {
  return rows
    .filter((r) => r.active && (!r.starts_on || r.starts_on <= today) && (!r.ends_on || r.ends_on >= today))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, limit)
    .map((r) => ({ id: r.id, kind: (r.kind in NOTICE_KIND_LABEL ? r.kind : "notice") as NoticeKind, title: r.title, body: r.body, href: r.href, at: r.created_at }));
}

/* ---------- 활동 ---------- */
export type ActivityKind = "request" | "like" | "reservation" | "order";
export type ActivityItem = { id: string; kind: ActivityKind; text: string; href: string; at: string };

/** 읽지 않은 수 — seenAt(ISO) 뒤에 생긴 것. seenAt이 없으면 전부 */
export function unreadCount(items: { at: string }[], seenAt: string | null | undefined): number {
  if (!seenAt) return items.length;
  return items.filter((x) => x.at > seenAt).length;
}
/** 배지 글자 — 99 넘으면 "99+" */
export const badgeText = (n: number) => (n > 99 ? "99+" : String(n));

/** "방금 · 3분 전 · 2시간 전 · 어제 · 9.20" */
export function timeAgo(iso: string | number, now = Date.now()): string {
  const t = typeof iso === "number" ? iso : new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, Math.floor((now - t) / 1000));
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  if (s < 172800) return "어제";
  const d = new Date(t + 9 * 3600_000);
  return `${d.getUTCMonth() + 1}.${d.getUTCDate()}`;
}
