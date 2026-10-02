/**
 * 운영 지표 규칙(2026-10-01) — 어드민 대시보드 "최근 7일" 칸과 월요일 운영 리포트 이메일이 같이 쓴다.
 * 숫자 세기는 웹 lib/ops-metrics.ts(DB), 여기는 나이대·시도 줄임·증감 표시 같은 순수 규칙.
 */

import { stepRate, type OpsFunnel } from "./ops-funnel";

export type WeeklyCounts = {
  visits: number;        // 화면 조회(events screen)
  visitors: number;      // 방문 세션 수(session_id 고유)
  searches: number;      // 검색(search + search_intent)
  emptySearches: number; // 결과 없음
  saves: number;         // 저장(찜)
  newUsers: number;
  picks: number;         // 회원 추천 글
  reviews: number;       // 식당 리뷰 + 술 평가
  expertReviews: number; // 전문가 판정
  reservations: number;
  orders: number;
};
export type WeeklyMetrics = { cur: WeeklyCounts; prev: WeeklyCounts; since: string; until: string };
export type Demographics = { total: number; gender: Record<"m" | "f" | "?", number>; age: Record<string, number>; sido: { name: string; n: number }[] };

export const METRIC_LABEL: Record<keyof WeeklyCounts, string> = {
  visits: "화면 조회", visitors: "방문(세션)", searches: "검색", emptySearches: "검색 결과 없음", saves: "저장", newUsers: "새 회원",
  picks: "회원 추천", reviews: "리뷰·술 평가", expertReviews: "전문가 판정", reservations: "예약", orders: "주문",
};
export const METRIC_ORDER: (keyof WeeklyCounts)[] = ["visitors", "visits", "searches", "emptySearches", "saves", "newUsers", "picks", "reviews", "expertReviews", "reservations", "orders"];

/** 전주 대비 — "+25%" · "−10%" · "새로" (전주 0) · "—" (둘 다 0) */
export function deltaText(cur: number, prev: number): string {
  if (!cur && !prev) return "—";
  if (!prev) return "새로";
  const p = Math.round(((cur - prev) / prev) * 100);
  return p === 0 ? "같음" : p > 0 ? `+${p}%` : `−${Math.abs(p)}%`;
}

export const AGE_BANDS = ["20대 이하", "30대", "40대", "50대", "60대 이상"] as const;
/** 생년월일 → 나이대(만 나이). 없거나 이상하면 null */
export function ageBandOf(birth: string | null | undefined, today = new Date()): (typeof AGE_BANDS)[number] | null {
  if (!birth) return null;
  const b = new Date(birth);
  if (Number.isNaN(b.getTime())) return null;
  let age = today.getUTCFullYear() - b.getUTCFullYear();
  const m = today.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && today.getUTCDate() < b.getUTCDate())) age--;
  if (age < 0 || age > 120) return null;
  if (age < 30) return "20대 이하";
  if (age < 40) return "30대";
  if (age < 50) return "40대";
  if (age < 60) return "50대";
  return "60대 이상";
}

/** 시·도 이름 줄임 — "서울특별시" → "서울", "전남광주통합특별시" → "전남·광주" */
export function shortSido(s: string | null | undefined): string {
  const v = String(s ?? "").trim();
  if (!v) return "미입력";
  if (v.startsWith("전남광주")) return "전남·광주";
  if (v.startsWith("세종")) return "세종";
  if (v.startsWith("제주")) return "제주";
  if (v.startsWith("강원")) return "강원";
  if (v.startsWith("전북")) return "전북";
  const two: Record<string, string> = { "충청남도": "충남", "충청북도": "충북", "경상남도": "경남", "경상북도": "경북", "전라남도": "전남", "전라북도": "전북" };
  if (two[v]) return two[v];
  return v.replace(/(특별자치도|특별자치시|특별시|광역시|도)$/, "");
}

/** 회원 목록 → 성별·나이대·시도 구성 */
export function demographics(users: { gender?: string | null; birth_date?: string | null; sido?: string | null }[], today = new Date()): Demographics {
  const gender: Demographics["gender"] = { m: 0, f: 0, "?": 0 };
  const age: Record<string, number> = Object.fromEntries(AGE_BANDS.map((b) => [b, 0]));
  const sidoMap = new Map<string, number>();
  for (const u of users) {
    gender[u.gender === "m" ? "m" : u.gender === "f" ? "f" : "?"]++;
    const band = ageBandOf(u.birth_date, today);
    if (band) age[band]++;
    const s = shortSido(u.sido);
    sidoMap.set(s, (sidoMap.get(s) ?? 0) + 1);
  }
  const sido = [...sidoMap.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, "ko"));
  return { total: users.length, gender, age, sido };
}

export const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

/** 방문 흐름 줄글 — 이메일·복사용. 대시보드 '방문 흐름' 칸과 같은 숫자 */
export function funnelLines(f: OpsFunnel): string[] {
  const out = [
    "방문 흐름 (세션 기준)",
    `· 방문 ${f.sessions.toLocaleString("ko-KR")} → 술·음식 상세를 봄 ${f.detailSessions.toLocaleString("ko-KR")} (방문의 ${stepRate(f.detailSessions, f.sessions)})`,
    `· 저장·구매·식당·공유 중 하나라도 ${f.actionSessions.toLocaleString("ko-KR")} (상세 본 세션의 ${stepRate(f.actionSessions, f.detailSessions)})`,
    `· 저장 ${f.saves}(비로그인 ${f.guestSaves}) · 구매 링크 ${f.buyClicks} · 식당 링크 ${f.restaurantClicks} · 공유 ${f.shares}(그림 카드 ${f.cardSaves})`,
    `· 모음 화면 조회 ${f.guideViews} · 오늘의 페어링 조회 ${f.todayViews}`,
  ];
  if (f.weatherPush || f.situationClicks || f.pushSessions) out.push(`· 날씨 소식 — 보낸 날 ${f.weatherPush?.days ?? 0} · 보낸 회원 ${f.weatherPush?.sent ?? 0} · 푸시로 들어온 세션 ${f.pushSessions} · "오늘 같은 날엔" 클릭 ${f.situationClicks}`);
  if (f.sources.length) out.push(`· 유입 경로 — ${f.sources.slice(0, 6).map((s) => `${s.label} ${s.n}`).join(" · ")}${f.sources.length > 6 ? " 외" : ""}`);
  if (f.topDetails.length) out.push(`· 많이 본 상세 — ${f.topDetails.map((t) => `${t.path.replace(/^\/(drinks|foods)\//, "").replace(/-/g, " ")} ${t.n}`).join(" · ")}`);
  return out;
}

/** 리포트 글(이메일 본문·복사용) — 한국어 줄글. funnel을 주면 회원 구성 앞에 방문 흐름을 넣는다(2026-10-02) */
export function reportText(m: WeeklyMetrics, d: Demographics, funnel?: OpsFunnel): string {
  const lines = [`페어링GO 주간 운영 리포트 (${m.since.slice(0, 10)} ~ ${m.until.slice(0, 10)})`, ""];
  for (const k of METRIC_ORDER) lines.push(`· ${METRIC_LABEL[k]} ${m.cur[k].toLocaleString("ko-KR")} (전주 ${m.prev[k].toLocaleString("ko-KR")}, ${deltaText(m.cur[k], m.prev[k])})`);
  if (funnel) lines.push("", ...funnelLines(funnel));
  lines.push("", `회원 ${d.total}명 — 남 ${d.gender.m} · 여 ${d.gender.f} · 미입력 ${d.gender["?"]}`);
  lines.push(`나이대 — ${AGE_BANDS.map((b) => `${b} ${d.age[b] ?? 0}`).join(" · ")}`);
  lines.push(`사는 곳 — ${d.sido.slice(0, 6).map((s) => `${s.name} ${s.n}`).join(" · ")}${d.sido.length > 6 ? " 외" : ""}`);
  return lines.join("\n");
}

/* ---------- 기간 고르기(2026-10-01 사용자 요청 — 1일·7일·30일 탭 + 직접 선택) ---------- */
/** 2026-10-01 사용자 요청으로 오늘·어제·7일·30일 + 날짜 범위. prevName = 비교 대상 이름 */
export type OpsPeriod = { key: "today" | "yesterday" | "7" | "30" | "custom"; since: string; until: string; label: string; days: number; prevName: string; from?: string; to?: string };
export const OPS_PRESETS = [{ key: "today", label: "오늘" }, { key: "yesterday", label: "어제" }, { key: "7", label: "7일" }, { key: "30", label: "30일" }] as const;
export const OPS_MAX_DAYS = 366;
const DAY_MS = 86400_000;
const isYmd = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
/** 한국 날짜 YYYY-MM-DD의 00:00(KST)을 UTC ISO로 */
const kstStart = (ymd: string) => new Date(Date.parse(`${ymd}T00:00:00Z`) - 9 * 3600_000).toISOString();
/** 지금의 한국 날짜 */
export const kstToday = (now = new Date()) => new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);

/**
 * 주소 값 → 기간. ?from=&to=(한국 날짜, 둘 다 포함)가 맞으면 직접 선택, 아니면 ?p=1|7|30(지금부터 거꾸로 24시간 단위), 기본 7일.
 * 직접 선택은 앞뒤를 바로잡고(from > to면 바꿈) 미래는 오늘까지, 길이는 366일까지.
 */
export function opsPeriod(sp: { p?: unknown; from?: unknown; to?: unknown }, now = new Date()): OpsPeriod {
  const today = kstToday(now);
  if (isYmd(sp.from) && isYmd(sp.to)) {
    let [a, b] = [sp.from, sp.to].sort();
    if (b > today) b = today;
    if (a > b) a = b;
    let days = Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS) + 1;
    if (days > OPS_MAX_DAYS) { a = new Date(Date.parse(`${b}T00:00:00Z`) - (OPS_MAX_DAYS - 1) * DAY_MS).toISOString().slice(0, 10); days = OPS_MAX_DAYS; }
    const until = b === today ? now.toISOString() : kstStart(new Date(Date.parse(`${b}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10));
    return { key: "custom", since: kstStart(a), until, label: `${a.slice(5).replace("-", ".")} ~ ${b.slice(5).replace("-", ".")}`, days, prevName: `앞 ${days}일`, from: a, to: b };
  }
  // 오늘 = 한국 00시부터 지금까지(어제 같은 시간대와 비교) · 어제 = 어제 하루(그저께와 비교) · 7·30일 = 지금부터 거꾸로(옛 ?p=1은 오늘로)
  if (sp.p === "today" || sp.p === "1") return { key: "today", since: kstStart(today), until: now.toISOString(), label: "오늘", days: 1, prevName: "어제 같은 시간" };
  if (sp.p === "yesterday") return { key: "yesterday", since: kstStart(new Date(Date.parse(`${today}T00:00:00Z`) - DAY_MS).toISOString().slice(0, 10)), until: kstStart(today), label: "어제", days: 1, prevName: "그저께" };
  const key = sp.p === "30" ? "30" : "7";
  const days = Number(key);
  return { key, since: new Date(now.getTime() - days * DAY_MS).toISOString(), until: now.toISOString(), label: `최근 ${days}일`, days, prevName: key === "7" ? "전주" : "전달" };
}
/** 비교할 앞 기간(같은 길이, 바로 앞) */
export const prevPeriod = (p: Pick<OpsPeriod, "since" | "until"> & { days?: number }) => {
  // 기간 날수만큼 앞으로 민다 — 오늘(00시~지금)은 어제 같은 시간대, 나머지는 바로 앞 같은 길이
  const len = p.days ? p.days * DAY_MS : Date.parse(p.until) - Date.parse(p.since);
  if (p.days) return { since: new Date(Date.parse(p.since) - len).toISOString(), until: new Date(Date.parse(p.until) - len).toISOString() };
  return { since: new Date(Date.parse(p.since) - len).toISOString(), until: p.since };
};
