/**
 * 운영 지표 규칙(2026-10-01) — 어드민 대시보드 "최근 7일" 칸과 월요일 운영 리포트 이메일이 같이 쓴다.
 * 숫자 세기는 웹 lib/ops-metrics.ts(DB), 여기는 나이대·시도 줄임·증감 표시 같은 순수 규칙.
 */

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

/** 리포트 글(이메일 본문·복사용) — 한국어 줄글 */
export function reportText(m: WeeklyMetrics, d: Demographics): string {
  const lines = [`페어링GO 주간 운영 리포트 (${m.since.slice(0, 10)} ~ ${m.until.slice(0, 10)})`, ""];
  for (const k of METRIC_ORDER) lines.push(`· ${METRIC_LABEL[k]} ${m.cur[k].toLocaleString("ko-KR")} (전주 ${m.prev[k].toLocaleString("ko-KR")}, ${deltaText(m.cur[k], m.prev[k])})`);
  lines.push("", `회원 ${d.total}명 — 남 ${d.gender.m} · 여 ${d.gender.f} · 미입력 ${d.gender["?"]}`);
  lines.push(`나이대 — ${AGE_BANDS.map((b) => `${b} ${d.age[b] ?? 0}`).join(" · ")}`);
  lines.push(`사는 곳 — ${d.sido.slice(0, 6).map((s) => `${s.name} ${s.n}`).join(" · ")}${d.sido.length > 6 ? " 외" : ""}`);
  return lines.join("\n");
}
