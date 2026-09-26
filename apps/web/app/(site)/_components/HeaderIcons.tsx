"use client";
/**
 * 헤더 오른쪽 두 버튼(2026-09-26 사용자 요청, 캐치테이블 참고 — docs/25 §6)
 *  ① 최근 본 — 매장·술·음식 탭(기기 localStorage, RecentTrack이 채움)
 *  ② 알림 — 공지·활동 탭. 읽지 않은 수를 버튼 위 빨간 배지로. 공지의 읽음은 기기에(localStorage), 활동의 읽음은 서버(users.notif_seen_at)에.
 * 패널은 버튼 아래 떠 있고, 바깥을 누르거나 Esc로 닫는다. 세션 확인(SavedProvider ready) 뒤에만 알림을 부른다 — 첫 화면 로그아웃 판정과 경합하지 않게.
 */
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { NOTICE_KIND_LABEL, RECENT_KINDS, RECENT_KIND_LABEL, badgeText, cleanRecent, timeAgo, unreadCount, type ActivityItem, type NoticeItem, type RecentItem, type RecentKind } from "@pairinggo/shared/notifications";
import { RECENT_KEY } from "./RecentTrack";
import { useSaved } from "./SavedProvider";
import { track } from "@/lib/track";

const NOTICE_SEEN_KEY = "pg_notice_seen";
type Panel = "recent" | "notif" | null;
type Notif = { notices: NoticeItem[]; activity: ActivityItem[]; seenAt: string | null; loggedIn: boolean };

const readRecent = (): RecentItem[] => { try { return cleanRecent(JSON.parse(window.localStorage.getItem(RECENT_KEY) || "[]")); } catch { return []; } };
const readNoticeSeen = (): string | null => { try { return window.localStorage.getItem(NOTICE_SEEN_KEY); } catch { return null; } };

export default function HeaderIcons() {
  const { ready, loggedIn } = useSaved();
  const [open, setOpen] = useState<Panel>(null);
  const [rtab, setRtab] = useState<RecentKind>("drink");
  const [ntab, setNtab] = useState<"notice" | "activity">("notice");
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [notif, setNotif] = useState<Notif | null>(null);
  const [noticeSeen, setNoticeSeen] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  // 최근 본 — 저장소가 바뀌면(상세 화면 방문·다른 탭) 다시 읽는다
  useEffect(() => {
    const load = () => setRecent(readRecent());
    load(); setNoticeSeen(readNoticeSeen());
    window.addEventListener("pg-recent", load); window.addEventListener("storage", load);
    return () => { window.removeEventListener("pg-recent", load); window.removeEventListener("storage", load); };
  }, []);
  // 알림 수 — 세션 확인 뒤 한 번(배지용). 패널을 열면 다시 받는다
  const fetchNotif = useCallback(async () => {
    try { const r = await fetch("/api/notifications", { cache: "no-store" }); if (r.ok) setNotif((await r.json()) as Notif); } catch { /* 배지만 못 그린다 */ }
  }, []);
  useEffect(() => { if (ready) void fetchNotif(); }, [ready, loggedIn, fetchNotif]);
  // 바깥 클릭·Esc로 닫기
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    document.addEventListener("mousedown", onDown); document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const unreadNotice = notif ? unreadCount(notif.notices, noticeSeen) : 0;
  const unreadAct = notif ? unreadCount(notif.activity, notif.seenAt) : 0;
  const unread = unreadNotice + unreadAct;

  const toggle = (p: Exclude<Panel, null>) => {
    if (open === p) { setOpen(null); return; }
    setOpen(p);
    if (p === "recent") { setRecent(readRecent()); track("recent_open", { n: recent.length }); }
    else {
      track("notif_open", { unread });
      void fetchNotif();
      // 읽음 처리 — 공지는 기기에, 활동은 서버에(회원만). 배지는 바로 0
      const now = new Date().toISOString();
      try { window.localStorage.setItem(NOTICE_SEEN_KEY, now); } catch { /* 무시 */ }
      setNoticeSeen(now);
      if (loggedIn) void fetch("/api/notifications", { method: "POST" }).then(() => setNotif((n) => (n ? { ...n, seenAt: now } : n))).catch(() => {});
      if (!loggedIn && ntab === "activity") setNtab("notice");
    }
  };
  const clearRecent = () => { try { window.localStorage.removeItem(RECENT_KEY); } catch { /* 무시 */ } setRecent([]); };
  const recentList = recent.filter((x) => x.kind === rtab);

  return (
    <div className="hicons" ref={box}>
      <button type="button" className={`hicon${open === "recent" ? " on" : ""}`} aria-label="최근 본" aria-expanded={open === "recent"} aria-controls="hpanel-recent" onClick={() => toggle("recent")}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /><path d="M12 8v4l3 2" /></svg>
      </button>
      <button type="button" className={`hicon${open === "notif" ? " on" : ""}`} aria-label={`알림${unread ? ` ${unread}개 읽지 않음` : ""}`} aria-expanded={open === "notif"} aria-controls="hpanel-notif" onClick={() => toggle("notif")}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>
        {unread > 0 && <span className="hbadge" aria-hidden>{badgeText(unread)}</span>}
      </button>

      {open === "recent" && (
        <div className="hpanel" id="hpanel-recent" role="dialog" aria-label="최근 본">
          <div className="hp-head"><b>최근 본</b>{recent.length > 0 && <button type="button" className="linklike" onClick={clearRecent}>모두 지우기</button>}</div>
          <div className="hp-tabs" role="tablist">
            {RECENT_KINDS.map((k) => <button key={k} type="button" role="tab" aria-selected={rtab === k} className={rtab === k ? "on" : undefined} onClick={() => setRtab(k)}>{RECENT_KIND_LABEL[k]}<span className="cnt">{recent.filter((x) => x.kind === k).length}</span></button>)}
          </div>
          {recentList.length === 0 ? <p className="hp-empty">아직 본 {RECENT_KIND_LABEL[rtab]}이 없어요. 이 기기에서 본 것만 남아요.</p> : (
            <ul className="hp-list">
              {recentList.map((x) => (
                <li key={x.kind + x.id}><Link href={x.href} onClick={() => setOpen(null)}><b>{x.name}</b>{x.meta && <span className="small muted">{x.meta}</span>}<span className="hp-time">{timeAgo(x.at)}</span></Link></li>
              ))}
            </ul>
          )}
        </div>
      )}

      {open === "notif" && (
        <div className="hpanel" id="hpanel-notif" role="dialog" aria-label="알림">
          <div className="hp-head"><b>알림</b></div>
          <div className="hp-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={ntab === "notice"} className={ntab === "notice" ? "on" : undefined} onClick={() => setNtab("notice")}>공지<span className="cnt">{notif?.notices.length ?? 0}</span></button>
            <button type="button" role="tab" aria-selected={ntab === "activity"} className={ntab === "activity" ? "on" : undefined} onClick={() => setNtab("activity")}>활동<span className="cnt">{notif?.activity.length ?? 0}</span></button>
          </div>
          {!notif ? <p className="hp-empty">불러오는 중…</p> : ntab === "notice" ? (
            notif.notices.length === 0 ? <p className="hp-empty">새 공지가 없어요.</p> : (
              <ul className="hp-list">
                {notif.notices.map((n) => {
                  const inner = <><span className={`badge n hp-kind ${n.kind}`}>{NOTICE_KIND_LABEL[n.kind]}</span><b>{n.title}</b>{n.body && <span className="small muted">{n.body}</span>}<span className="hp-time">{timeAgo(n.at)}</span></>;
                  return <li key={n.id}>{n.href ? (n.href.startsWith("/") ? <Link href={n.href} onClick={() => setOpen(null)}>{inner}</Link> : <a href={n.href} target="_blank" rel="noopener noreferrer">{inner}</a>) : <div className="hp-static">{inner}</div>}</li>;
                })}
              </ul>
            )
          ) : !loggedIn ? (
            <p className="hp-empty"><Link href="/login" onClick={() => setOpen(null)}>로그인</Link>하면 요청한 술·내 추천에 달린 하트·예약·주문 소식이 여기에 와요.</p>
          ) : notif.activity.length === 0 ? <p className="hp-empty">최근 30일 활동 소식이 없어요.</p> : (
            <ul className="hp-list">
              {notif.activity.map((a) => <li key={a.id}><Link href={a.href} onClick={() => setOpen(null)}><b>{a.text}</b><span className="hp-time">{timeAgo(a.at)}</span></Link></li>)}
            </ul>
          )}
          {loggedIn && <p className="hp-foot"><Link href="/my#push" onClick={() => setOpen(null)}>🔔 기기로 알림 받기 · 주간 소식 설정</Link></p>}
        </div>
      )}
    </div>
  );
}
