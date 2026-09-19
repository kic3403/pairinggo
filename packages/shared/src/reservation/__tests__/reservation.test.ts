import { describe, expect, it } from "vitest";
import {
  addDays, availableSlots, canTransition, cleanHours, cleanSettings, DEFAULT_SETTINGS, formatMobile, formatVisit, isDate, kstInstant, kstParts,
  maskMobile, normalizeMobile, otpLooksValid, pairingNoteDraft, slotTimes, storeActions, toMinutes, validateReservationRequest,
  cleanBizNo, formatBizNo, validatePartnerSignup, reserveErrorMessage, noShowBlock, noShowMessage,
  type BusinessHours, type ReservationSettings,
} from "..";

/* 2026-09-18(금) 15:00 KST = 06:00 UTC */
const NOW = new Date("2026-09-18T06:00:00Z");
const S: ReservationSettings = { ...DEFAULT_SETTINGS, accepting: true, slotMinutes: 30, capacityParties: 2, capacityPeople: 10, minParty: 1, maxParty: 6, leadMinutes: 60, horizonDays: 14 };
const H = (weekday: number, open = "17:00", close = "22:00", extra: Partial<BusinessHours> = {}): BusinessHours => ({ weekday, closed: false, open, close, ...extra });
const WEEK: BusinessHours[] = [0, 1, 2, 3, 4, 5, 6].map((d) => (d === 1 ? { ...H(1), closed: true } : H(d)));

describe("한국 시간", () => {
  it("UTC 서버에서도 한국 날짜·분·요일", () => {
    expect(kstParts(NOW)).toEqual({ date: "2026-09-18", minutes: 15 * 60, weekday: 5 });
    expect(kstParts(new Date("2026-09-18T16:30:00Z")).date).toBe("2026-09-19"); // 한국 새벽 1:30은 다음 날
    expect(kstInstant("2026-09-18", "18:30").toISOString()).toBe("2026-09-18T09:30:00.000Z");
  });
  it("날짜 더하기·형식·화면 표시", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(isDate("2026-02-30")).toBe(false);
    expect(isDate("2026-09-18")).toBe(true);
    expect(toMinutes("18:30")).toBe(1110);
    expect(Number.isNaN(toMinutes("7:5"))).toBe(true);
    expect(formatVisit("2026-09-19", "18:30")).toBe("9월 19일 (토) 18:30");
  });
});

describe("휴대폰 번호", () => {
  it("여러 모양을 숫자만으로, 휴대폰이 아니면 null", () => {
    expect(normalizeMobile("010-1234-5678")).toBe("01012345678");
    expect(normalizeMobile("+82 10 1234 5678")).toBe("01012345678");
    expect(normalizeMobile("011-123-4567")).toBe("0111234567");
    expect(normalizeMobile("02-123-4567")).toBeNull();
    expect(normalizeMobile("010-1234")).toBeNull();
  });
  it("화면 표시·가리기·인증번호 형식", () => {
    expect(formatMobile("01012345678")).toBe("010-1234-5678");
    expect(maskMobile("01012345678")).toBe("010-****-5678");
    expect(otpLooksValid("123456")).toBe(true);
    expect(otpLooksValid("12345a")).toBe(false);
  });
});

describe("예약 상태 전이 (즉시 확정)", () => {
  const visit = kstInstant("2026-09-18", "19:00");
  const at = (hhmm: string) => kstInstant("2026-09-18", hhmm);
  it("손님은 방문 60분 전까지만 취소", () => {
    expect(canTransition("confirmed", "cancelled_by_user", "user", at("17:59"), visit).ok).toBe(true);
    const late = canTransition("confirmed", "cancelled_by_user", "user", at("18:30"), visit);
    expect(late.ok).toBe(false);
    expect(canTransition("confirmed", "cancelled_by_user", "admin", at("18:30"), visit).ok).toBe(true);
  });
  it("매장 취소는 사유가 있어야 하고, 손님은 매장 버튼을 못 누른다", () => {
    expect(canTransition("confirmed", "cancelled_by_store", "store", at("15:00"), visit, "").ok).toBe(false);
    expect(canTransition("confirmed", "cancelled_by_store", "store", at("15:00"), visit, "재료 소진").ok).toBe(true);
    expect(canTransition("confirmed", "seated", "user", at("19:00"), visit).ok).toBe(false);
  });
  it("착석은 방문 2시간 전부터, 노쇼는 방문 15분 뒤부터, 착석 뒤엔 노쇼·취소 불가", () => {
    expect(canTransition("confirmed", "seated", "store", at("16:30"), visit).ok).toBe(false);
    expect(canTransition("confirmed", "seated", "store", at("18:50"), visit).ok).toBe(true);
    expect(canTransition("confirmed", "no_show", "store", at("19:10"), visit).ok).toBe(false);
    expect(canTransition("confirmed", "no_show", "store", at("19:15"), visit).ok).toBe(true);
    expect(canTransition("seated", "no_show", "store", at("20:00"), visit).ok).toBe(false);
    expect(canTransition("seated", "cancelled_by_store", "store", at("20:00"), visit, "x").ok).toBe(false);
    expect(canTransition("seated", "completed", "store", at("21:00"), visit).ok).toBe(true);
  });
  it("끝난 예약은 더 바꿀 수 없다", () => {
    for (const s of ["completed", "no_show", "cancelled_by_user", "cancelled_by_store"] as const) expect(canTransition(s, "seated", "admin", at("19:00"), visit).ok).toBe(false);
  });
  it("매장 화면 버튼 — 시각에 따라", () => {
    expect(storeActions("confirmed", at("15:00"), visit)).toEqual(["cancelled_by_store"]);
    expect(storeActions("confirmed", at("19:20"), visit)).toEqual(["seated", "completed", "no_show", "cancelled_by_store"]);
    expect(storeActions("seated", at("20:00"), visit)).toEqual(["completed"]);
  });
});

describe("예약 가능 시간", () => {
  it("슬롯: 여는 시각부터 간격마다, 마지막 입장 = 닫는 시각 − 간격, 브레이크 제외", () => {
    expect(slotTimes(H(5, "17:00", "19:00"), 30)).toEqual(["17:00", "17:30", "18:00", "18:30"]);
    expect(slotTimes(H(5, "11:00", "15:00", { breakStart: "12:00", breakEnd: "13:00" }), 60)).toEqual(["11:00", "13:00", "14:00"]);
    expect(slotTimes({ ...H(5), closed: true }, 30)).toEqual([]);
  });
  it("자정 넘김 영업은 그날 23:59까지만", () => {
    const t = slotTimes(H(5, "18:00", "02:00"), 60);
    expect(t[0]).toBe("18:00");
    expect(t.at(-1)).toBe("23:00");
  });
  it("당일은 지금+60분 이후 슬롯만, 잡힌 예약만큼 남은 자리를 뺀다", () => {
    const d = availableSlots({ hours: WEEK, closures: [], settings: S, date: "2026-09-18", now: new Date("2026-09-18T08:10:00Z") /* 17:10 */, booked: [{ time: "18:30", parties: 2, people: 5 }, { time: "19:00", parties: 1, people: 8 }], partySize: 3 });
    expect(d.reason).toBe("ok");
    expect(d.slots[0].time).toBe("18:30"); // 17:10 + 60분 = 18:10 → 18:30부터
    expect(d.slots.find((s) => s.time === "18:30")).toMatchObject({ remainingParties: 0, available: false });
    expect(d.slots.find((s) => s.time === "19:00")).toMatchObject({ remainingParties: 1, remainingPeople: 2, available: false }); // 3명은 인원 초과
    expect(d.slots.find((s) => s.time === "19:30")).toMatchObject({ remainingParties: 2, remainingPeople: 10, available: true });
  });
  it("휴무 요일·임시 휴무·지난 날·기간 밖·받기 꺼짐", () => {
    const base = { hours: WEEK, closures: ["2026-09-20"], settings: S, now: NOW, booked: [] };
    expect(availableSlots({ ...base, date: "2026-09-21" }).reason).toBe("closed"); // 월요일 휴무
    expect(availableSlots({ ...base, date: "2026-09-20" }).reason).toBe("closed"); // 임시 휴무
    expect(availableSlots({ ...base, date: "2026-09-17" }).reason).toBe("past");
    expect(availableSlots({ ...base, date: "2026-10-03" }).reason).toBe("beyond_horizon");
    expect(availableSlots({ ...base, date: "2026-09-19", settings: { ...S, accepting: false } }).reason).toBe("not_accepting");
  });
  it("인원 제한 0 = 팀 수만 본다", () => {
    const d = availableSlots({ hours: WEEK, closures: [], settings: { ...S, capacityPeople: 0 }, date: "2026-09-19", now: NOW, booked: [{ time: "17:00", parties: 1, people: 30 }], partySize: 6 });
    expect(d.slots[0]).toMatchObject({ remainingParties: 1, remainingPeople: null, available: true });
  });
  it("설정·영업시간 입력 정리", () => {
    const s = cleanSettings({ accepting: "on", slotMinutes: 45, capacityParties: 999, minParty: 4, maxParty: 2, horizonDays: 0, notice: "  단체는   전화 주세요 " });
    expect(s).toMatchObject({ accepting: true, slotMinutes: 30, capacityParties: 50, minParty: 4, maxParty: 4, horizonDays: 1, notice: "단체는 전화 주세요" });
    const h = cleanHours([{ weekday: 1, closed: true }, { weekday: 2, open: "17:00", close: "23:00", breakStart: "20:00", breakEnd: "19:00" }, { weekday: 3, open: "bad", close: "22:00" }]);
    expect(h).toHaveLength(7);
    expect(h[1].closed).toBe(true);
    expect(h[2]).toMatchObject({ closed: false, open: "17:00", close: "23:00", breakStart: null });
    expect(h[3].closed).toBe(true);
  });
});

describe("예약 요청 검증", () => {
  const day = availableSlots({ hours: WEEK, closures: [], settings: S, date: "2026-09-19", now: NOW, booked: [{ time: "18:00", parties: 2, people: 4 }] });
  const ok = { date: "2026-09-19", time: "19:00", partySize: 2, guestName: " 김 동민 ", note: "창가  자리 부탁드려요", shareConsent: true, drinkId: "d11", foodId: "f08", roomRequested: true };
  it("정상 요청은 정리해서 돌려준다 (룸 예약 안 받는 매장이면 룸 희망은 끈다)", () => {
    const r = validateReservationRequest(ok, S, day);
    expect(r.ok && r.value).toMatchObject({ guestName: "김 동민", note: "창가 자리 부탁드려요", drinkId: "d11", foodId: "f08", roomRequested: false });
  });
  it("자리 없음·인원 범위·동의·링크·이름", () => {
    const bad = (p: object) => { const r = validateReservationRequest({ ...ok, ...p }, S, day); return r.ok ? "" : r.problem; };
    expect(bad({ time: "18:00" })).toContain("자리가 없어요");
    expect(bad({ time: "18:10" })).toContain("예약할 수 없는 시간");
    expect(bad({ partySize: 7 })).toContain("1~6명");
    expect(bad({ shareConsent: false })).toContain("동의");
    expect(bad({ note: "https://spam.example" })).toContain("링크");
    expect(bad({ guestName: "" })).toContain("이름");
  });
  it("페어링 요청사항 초안", () => {
    expect(pairingNoteDraft("해물파전", "한산소곡주", true)).toBe("해물파전 × 한산소곡주 페어링으로 방문해요. 한산소곡주은(는) 가져갈게요(콜키지)");
    expect(pairingNoteDraft(null, null)).toBe("");
  });
});

describe("파트너 가입", () => {
  it("사업자등록번호 검증번호", () => {
    expect(cleanBizNo("220-81-62517")).toBe("2208162517"); // 공개된 대기업 번호(검증번호 맞음)
    expect(cleanBizNo("220-81-62518")).toBeNull();
    expect(cleanBizNo("123")).toBeNull();
    expect(formatBizNo("2208162517")).toBe("220-81-62517");
  });
  it("신청 입력 정리·문제 안내", () => {
    const base = { email: " Owner@Shop.KR ", password: "x", name: "김 사장", phone: "010-1234-5678", kakaoPlaceId: "12345", ownerName: "김사장", bizNo: "220-81-62517", agree: true };
    const r = validatePartnerSignup(base);
    expect(r.ok && r.value).toMatchObject({ email: "owner@shop.kr", phone: "01012345678", bizNo: "2208162517" });
    const bad = (p: object) => { const x = validatePartnerSignup({ ...base, ...p }); return x.ok ? "" : x.problem; };
    expect(bad({ kakaoPlaceId: "" })).toContain("매장");
    expect(bad({ bizNo: "1234567890" })).toContain("사업자");
    expect(bad({ agree: false })).toContain("동의");
    expect(bad({ phone: "02-123-4567" })).toContain("휴대폰");
  });
  it("DB 오류 코드 안내", () => {
    expect(reserveErrorMessage("full")).toContain("마감");
    expect(reserveErrorMessage("??")).toContain("다시 시도");
  });
});

describe("노쇼 제한", () => {
  const now = new Date("2026-09-19T03:00:00Z");
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86400_000);
  it("90일 안 1번은 괜찮고, 2번이면 마지막 노쇼로부터 30일", () => {
    expect(noShowBlock([daysAgo(10)], now).blocked).toBe(false);
    const b = noShowBlock([daysAgo(50), daysAgo(10)], now);
    expect(b).toMatchObject({ blocked: true, recent: 2 });
    expect(b.until?.toISOString()).toBe(new Date(daysAgo(10).getTime() + 30 * 86400_000).toISOString());
    expect(noShowMessage(b)).toContain("10월 9일까지");
  });
  it("30일이 지나면 풀리고, 90일 밖 노쇼는 세지 않는다", () => {
    expect(noShowBlock([daysAgo(60), daysAgo(40)], now).blocked).toBe(false);
    expect(noShowBlock([daysAgo(120), daysAgo(5)], now).blocked).toBe(false);
    expect(noShowMessage(noShowBlock([], now))).toBeNull();
  });
});
