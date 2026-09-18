/**
 * 예약용 한국 시간(KST, UTC+9, 서머타임 없음) 도구 — 서버(Vercel, UTC)와 브라우저 어느 쪽에서 불러도 같은 답이 나오게
 * 날짜는 "YYYY-MM-DD", 시각은 "HH:MM" 문자열로 다룬다. Date는 "지금"과 "방문 순간"에만 쓴다.
 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

const pad = (n: number) => String(n).padStart(2, "0");

/** 그 순간의 한국 날짜와 자정부터 지난 분 */
export function kstParts(at: Date): { date: string; minutes: number; weekday: number } {
  const k = new Date(at.getTime() + KST_OFFSET_MS);
  return {
    date: `${k.getUTCFullYear()}-${pad(k.getUTCMonth() + 1)}-${pad(k.getUTCDate())}`,
    minutes: k.getUTCHours() * 60 + k.getUTCMinutes(),
    weekday: k.getUTCDay(),
  };
}

/** 한국 날짜 + 시각 → 그 순간(Date) */
export function kstInstant(date: string, time: string): Date {
  return new Date(`${date}T${time}:00+09:00`);
}

/** "HH:MM" → 분. 형식이 틀리면 NaN */
export function toMinutes(time: string): number {
  const m = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m) return NaN;
  const h = Number(m[1]), mi = Number(m[2]);
  return h <= 24 && mi < 60 ? h * 60 + mi : NaN;
}

/** 분 → "HH:MM" (0~1439) */
export const fromMinutes = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

/** 날짜에 n일 더하기 */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** 그 날짜의 요일(0=일요일) */
export const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

export const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime()) && addDays(s, 0) === s;

export const WEEKDAY_LABEL = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** 화면용 "9월 20일 (토) 18:30" */
export function formatVisit(date: string, time: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${m}월 ${d}일 (${WEEKDAY_LABEL[weekdayOf(date)]}) ${time}`;
}
