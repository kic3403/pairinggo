/**
 * 재방문 알림(2026-09-26, docs/25 §7 — 분석 5번). 캐치테이블의 예약·리뷰 알림, 데일리샷의 알림톡처럼 "다시 올 이유"를 기기로 보낸다.
 *  · 주간 소식(월요일 아침 1회, 내용이 있을 때만): 저장한 술의 새 페어링·구매 상품 → 급상승 술 → 새로 들어온 술 → 먹어봤나요?
 *  · 활동 소식(즉시): 요청한 술 등록·보류, 내 추천에 하트 (예약·주문은 notify·notify-order가 이미 보낸다)
 * 문구 규칙만 — 누구에게 보낼지·보냈는지 기록은 web lib/push-digest.ts.
 */
export type PushMessage = { title: string; body: string; url: string; tag?: string };
export type PushPref = { weekly: boolean; activity: boolean };
export const DEFAULT_PUSH_PREF: PushPref = { weekly: true, activity: true };
/** 주간 소식은 6일 안에 두 번 보내지 않는다(Vercel 크론이 흔들려도 한 주에 한 번) */
export const WEEKLY_MIN_GAP_DAYS = 6;
export const WEEKLY_LOOKBACK_DAYS = 7;

export function cleanPushPref(raw: unknown): PushPref {
  const r = (raw ?? {}) as Partial<Record<keyof PushPref, unknown>>;
  return { weekly: r.weekly !== false, activity: r.activity !== false };
}

export type DigestInput = {
  /** 저장한 술 중 이번 주 소식이 있는 것(카탈로그 순) */
  savedNews: { name: string; slug: string; pairings: number; products: number }[];
  /** 급상승(▲3 이상 또는 NEW) 상위 */
  trendUp: { name: string; slug: string; delta: number | null }[];
  /** 저장한 술·음식으로 아직 평가하지 않은 조합 수 */
  unrated: number;
  /** 이번 주 새로 들어온 술 수 */
  newDrinks: number;
};

/** 주간 소식 한 줄 — 내용이 하나도 없으면 null(보내지 않는다). 최대 3토막, 첫 토막이 눌렀을 때 갈 곳을 정한다 */
export function weeklyDigest(i: DigestInput): PushMessage | null {
  const parts: { text: string; url: string }[] = [];
  const s = i.savedNews.filter((x) => x.pairings > 0 || x.products > 0);
  if (s.length) {
    const x = s[0];
    const what = [x.pairings ? `새 페어링 ${x.pairings}개` : "", x.products ? `구매 상품 ${x.products}개` : ""].filter(Boolean).join("·");
    parts.push({ text: `저장한 ${x.name}에 ${what}${s.length > 1 ? ` 외 ${s.length - 1}종` : ""}`, url: `/drinks/${x.slug}` });
  }
  if (i.trendUp.length) {
    const t = i.trendUp[0];
    parts.push({ text: `급상승 ${t.name}${t.delta == null ? " NEW" : ` ▲${t.delta}`}${i.trendUp.length > 1 ? ` 외 ${i.trendUp.length - 1}` : ""}`, url: "/report" });
  }
  if (i.newDrinks > 0) parts.push({ text: `새로 들어온 술 ${i.newDrinks}종`, url: "/drinks?sort=new" });
  if (i.unrated > 0) parts.push({ text: `먹어봤나요? ${i.unrated}개가 기다려요`, url: "/my" });
  if (!parts.length) return null;
  const top = parts.slice(0, 3);
  return { title: "이번 주 페어링GO 소식", body: top.map((p) => p.text).join(" · ").slice(0, 140), url: top[0].url, tag: "weekly" };
}

/* ---------- 활동 소식 ---------- */
export function requestPush(query: string, status: "done" | "rejected", drinkName?: string | null, drinkSlug?: string | null, note?: string | null): PushMessage {
  if (status === "done") return { title: "요청하신 술이 등록됐어요", body: `‘${query}’${drinkName && drinkName !== query ? ` → ${drinkName}` : ""} — 어울리는 음식을 확인해 보세요`, url: drinkSlug ? `/drinks/${drinkSlug}` : "/my#requests", tag: "request" };
  return { title: "요청하신 술은 보류됐어요", body: `‘${query}’${note ? ` · ${note}` : ""}`, url: "/my#requests", tag: "request" };
}
export function likePush(nick: string, drinkName: string, foodName: string): PushMessage {
  return { title: "내 추천에 하트가 달렸어요", body: `${nick.slice(0, 20)}님이 ‘${drinkName} × ${foodName}’ 추천을 좋아해요`, url: "/my", tag: "like" };
}
