/**
 * 예약 가능 시간 계산 — 매장 영업시간·휴무·예약 설정 + 이미 잡힌 예약으로 그날의 시간표를 만든다.
 * 즉시 확정이라 정원 판정이 곧 예약 성공 여부다. 이 계산은 화면 표시용이고, 최종 판정은 DB 함수 reserve()가 잠금을 걸고 다시 한다.
 * 규칙
 *  · 첫 슬롯 = 여는 시각, 슬롯 간격마다, 마지막 입장 = 닫는 시각 − 슬롯 간격
 *  · 브레이크 타임에 시작하는 슬롯은 없다
 *  · 자정을 넘겨 영업하는 날(닫는 시각 ≤ 여는 시각)은 그날 23:59까지의 슬롯만 받는다(새벽 입장 예약은 받지 않음)
 *  · 지금부터 leadMinutes 안의 슬롯, 오늘부터 horizonDays를 넘는 날짜, 지난 날짜는 없다
 *  · 남은 자리 = 슬롯당 최대 팀 − 잡힌 팀, 슬롯당 최대 인원 − 잡힌 인원(0이면 인원 제한 없음)
 */
import { addDays, kstInstant, kstParts, toMinutes, fromMinutes, weekdayOf } from "./time";

export type BusinessHours = {
  /** 0=일요일 … 6=토요일 */
  weekday: number;
  closed: boolean;
  open: string; close: string;
  breakStart?: string | null; breakEnd?: string | null;
};

export type ReservationSettings = {
  accepting: boolean;
  slotMinutes: number;
  /** 한 슬롯에 받는 최대 팀 수 */
  capacityParties: number;
  /** 한 슬롯에 받는 최대 인원(0 = 제한 없음) */
  capacityPeople: number;
  minParty: number; maxParty: number;
  /** 지금부터 몇 분 뒤 슬롯부터 받는가(당일 마감) */
  leadMinutes: number;
  /** 오늘부터 며칠 뒤까지 받는가 */
  horizonDays: number;
  roomBookable: boolean;
  notice: string;
  /**
   * 회차제(2026-09-20) — 정해진 시각에만 받는다(예: 양조장 시음 11:00·14:00·16:00).
   * 비어 있으면 지금처럼 영업시간을 slotMinutes로 나눈다. 영업시간 밖·브레이크·휴무일 회차는 빠진다.
   */
  sessionTimes: string[];
  /** 한 회차에 걸리는 시간(분, 0 = 안내 안 함) — 손님 화면에 "약 60분"으로 */
  sessionMinutes: number;
};

export const DEFAULT_SETTINGS: ReservationSettings = {
  accepting: false, slotMinutes: 30, capacityParties: 2, capacityPeople: 0, minParty: 1, maxParty: 8, leadMinutes: 60, horizonDays: 30, roomBookable: false, notice: "",
  sessionTimes: [], sessionMinutes: 0,
};
/** 업종별 최소 인원 바닥값 — 양조장 시음은 혼자 받기 어려워 2명부터(2026-09-20 사용자 결정) */
export const MIN_PARTY_BY_KIND: Record<string, number> = { brewery: 2 };

/** 회차 시각 정리 — "HH:MM"만, 중복·잘못된 값은 버리고 시간순 (최대 12개) */
export function cleanSessionTimes(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : String(raw ?? "").split(/[,\n]/);
  const out = new Set<string>();
  for (const v of list) {
    const m = String(v ?? "").trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) continue;
    const hh = Number(m[1]), mm = Number(m[2]);
    if (hh > 23 || mm > 59) continue;
    out.add(`${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
  }
  return [...out].sort().slice(0, 12);
}
export const SLOT_MINUTE_OPTIONS = [15, 30, 60] as const;

/** 한 슬롯에 이미 잡힌 예약(확정·착석만 센다) */
export type BookedSlot = { time: string; parties: number; people: number };

export type Slot = { time: string; remainingParties: number; remainingPeople: number | null; available: boolean };
export type DayAvailability = { date: string; reason: "ok" | "past" | "beyond_horizon" | "closed" | "not_accepting"; slots: Slot[] };

/** 그 요일의 영업시간(없으면 휴무로 본다) */
const hoursFor = (hours: BusinessHours[], date: string) => hours.find((h) => h.weekday === weekdayOf(date));

/** 그날 슬롯 시각 목록(정원·지금 시각 고려 전) */
export function slotTimes(h: BusinessHours | undefined, slotMinutes: number, sessionTimes: string[] = []): string[] {
  if (!h || h.closed) return [];
  // 회차제 — 정해진 시각만 받는다. 영업시간 밖이거나 브레이크에 걸린 회차는 뺀다
  if (sessionTimes.length) {
    const o = toMinutes(h.open), c0 = toMinutes(h.close);
    if (!Number.isFinite(o) || !Number.isFinite(c0)) return [];
    const c = c0 <= o ? c0 + 1440 : c0;
    const bs = h.breakStart ? toMinutes(h.breakStart) : NaN, be = h.breakEnd ? toMinutes(h.breakEnd) : NaN;
    return cleanSessionTimes(sessionTimes).filter((t) => {
      const m = toMinutes(t);
      if (!Number.isFinite(m) || m < o || m > Math.min(c, 1439)) return false;
      return !(Number.isFinite(bs) && Number.isFinite(be) && m >= bs && m < be);
    });
  }
  const open = toMinutes(h.open), close0 = toMinutes(h.close);
  if (!Number.isFinite(open) || !Number.isFinite(close0) || slotMinutes <= 0) return [];
  const close = close0 <= open ? close0 + 1440 : close0;
  const lastStart = Math.min(close - slotMinutes, 1439);
  const bs = h.breakStart ? toMinutes(h.breakStart) : NaN, be = h.breakEnd ? toMinutes(h.breakEnd) : NaN;
  const out: string[] = [];
  for (let m = open; m <= lastStart; m += slotMinutes) {
    if (Number.isFinite(bs) && Number.isFinite(be) && m >= bs && m < be) continue;
    out.push(fromMinutes(m));
  }
  return out;
}

export function availableSlots(input: {
  hours: BusinessHours[]; closures: string[]; settings: ReservationSettings; date: string; now: Date; booked: BookedSlot[]; partySize?: number;
}): DayAvailability {
  const { hours, closures, settings: s, date, now, booked } = input;
  const today = kstParts(now).date;
  if (date < today) return { date, reason: "past", slots: [] };
  if (date > addDays(today, s.horizonDays)) return { date, reason: "beyond_horizon", slots: [] };
  if (!s.accepting) return { date, reason: "not_accepting", slots: [] };
  const h = hoursFor(hours, date);
  if (closures.includes(date) || !h || h.closed) return { date, reason: "closed", slots: [] };
  const earliest = now.getTime() + s.leadMinutes * 60_000;
  const byTime = new Map(booked.map((b) => [b.time, b]));
  const party = input.partySize ?? s.minParty;
  const slots = slotTimes(h, s.slotMinutes, s.sessionTimes ?? [])
    .filter((t) => kstInstant(date, t).getTime() >= earliest)
    .map((time) => {
      const b = byTime.get(time);
      const remainingParties = Math.max(0, s.capacityParties - (b?.parties ?? 0));
      const remainingPeople = s.capacityPeople > 0 ? Math.max(0, s.capacityPeople - (b?.people ?? 0)) : null;
      return { time, remainingParties, remainingPeople, available: remainingParties > 0 && (remainingPeople === null || remainingPeople >= party) };
    });
  return { date, reason: "ok", slots };
}

/** 예약 설정 입력 정리 — 범위를 벗어나면 가장 가까운 허용값 */
export function cleanSettings(raw: Partial<Record<keyof ReservationSettings, unknown>>, kind?: string): ReservationSettings {
  const int = (v: unknown, lo: number, hi: number, dflt: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt; };
  const slotMinutes = (SLOT_MINUTE_OPTIONS as readonly number[]).includes(Number(raw.slotMinutes)) ? Number(raw.slotMinutes) : DEFAULT_SETTINGS.slotMinutes;
  const floor = MIN_PARTY_BY_KIND[String(kind ?? "")] ?? 1;                    // 양조장 시음은 2명부터
  const minParty = Math.max(floor, int(raw.minParty, 1, 20, DEFAULT_SETTINGS.minParty));
  return {
    accepting: raw.accepting === true || raw.accepting === "true" || raw.accepting === "on",
    slotMinutes,
    capacityParties: int(raw.capacityParties, 1, 50, DEFAULT_SETTINGS.capacityParties),
    capacityPeople: int(raw.capacityPeople, 0, 300, DEFAULT_SETTINGS.capacityPeople),
    minParty,
    maxParty: Math.max(minParty, int(raw.maxParty, 1, 50, DEFAULT_SETTINGS.maxParty)),
    leadMinutes: int(raw.leadMinutes, 0, 24 * 60, DEFAULT_SETTINGS.leadMinutes),
    horizonDays: int(raw.horizonDays, 1, 90, DEFAULT_SETTINGS.horizonDays),
    roomBookable: raw.roomBookable === true || raw.roomBookable === "true" || raw.roomBookable === "on",
    notice: String(raw.notice ?? "").replace(/\s+/g, " ").trim().slice(0, 200),
    sessionTimes: cleanSessionTimes(raw.sessionTimes),
    sessionMinutes: int(raw.sessionMinutes, 0, 480, DEFAULT_SETTINGS.sessionMinutes),
  };
}

/** 영업시간 입력 정리 — 요일 0~6 각 한 줄, 시각 형식이 틀리면 그 요일은 휴무 */
export function cleanHours(raw: unknown[]): BusinessHours[] {
  const out: BusinessHours[] = [];
  for (let wd = 0; wd < 7; wd++) {
    const r = (raw.find((x) => Number((x as { weekday?: unknown })?.weekday) === wd) ?? {}) as Record<string, unknown>;
    const open = String(r.open ?? ""), close = String(r.close ?? "");
    const ok = Number.isFinite(toMinutes(open)) && Number.isFinite(toMinutes(close)) && open !== close;
    const bs = String(r.breakStart ?? ""), be = String(r.breakEnd ?? "");
    const brk = Number.isFinite(toMinutes(bs)) && Number.isFinite(toMinutes(be)) && toMinutes(bs) < toMinutes(be);
    out.push({ weekday: wd, closed: r.closed === true || r.closed === "on" || !ok, open: ok ? open : "11:00", close: ok ? close : "22:00", breakStart: brk ? bs : null, breakEnd: brk ? be : null });
  }
  return out;
}
