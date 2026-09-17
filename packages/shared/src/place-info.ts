/**
 * 운영자가 확인한 식당 정보(2026-09-17) — 주차·콜키지·룸·취급 전통주·대표 메뉴.
 * 콜키지·룸·메뉴는 카카오·구글·네이버 어느 공개 API에도 없고 화면 수집은 약관 위반이라, 운영자가 직접 확인해 어드민(/admin/places)에 적는다.
 * 나중에 제휴 식당이 직접 입력하면 source "partner"로 같은 표에 들어온다. 회원 제보는 별도 표로 붙일 예정(이 값보다 아래 순위).
 * 저장·조회는 apps/web/lib/place-info.ts, 표는 place_info(0021). 여기는 검증·표시 규칙만(순수 함수).
 */
import type { AmenityChip, ParkingKind, PlaceAmenities } from "./place-rating";

export type Tri = "yes" | "no" | null;
export type PlaceInfoSource = "operator" | "partner";
export type PlaceInfo = {
  parking: ParkingKind | null; parkingNote: string;
  corkage: Tri; corkageNote: string;
  room: Tri; roomNote: string;
  /** 취급 전통주 — 카탈로그 술 id */
  drinks: string[];
  /** 대표 메뉴 중 카탈로그에 있는 음식 id */
  foods: string[];
  /** 카탈로그에 없는 대표 메뉴 등 짧은 메모(화면에 그대로 보인다) */
  menuNote: string;
  source: PlaceInfoSource;
  /** 확인한 날 YYYY-MM-DD */
  verifiedAt: string | null;
};

export const PLACE_NOTE_MAX = 40, PLACE_MENU_NOTE_MAX = 120, PLACE_LIST_MAX = 30;
const PARKING: readonly string[] = ["free", "paid", "valet", "street", "none"];
const tri = (v: unknown): Tri => (v === "yes" || v === "no" ? v : null);
const text = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const ids = (v: unknown, known?: Set<string>) => [...new Set((Array.isArray(v) ? v : []).map(String).filter((id) => /^[df]\d+$/.test(id) && (!known || known.has(id))))].slice(0, PLACE_LIST_MAX);

/** 어드민 입력 → 저장할 값. 모르는 값은 버리고 길이를 자른다. known을 주면 카탈로그에 없는 id는 뺀다 */
export function cleanPlaceInfo(raw: Record<string, unknown>, known?: { drinks: Set<string>; foods: Set<string> }): PlaceInfo {
  const date = String(raw.verifiedAt ?? "");
  return {
    parking: PARKING.includes(String(raw.parking)) ? (raw.parking as ParkingKind) : null, parkingNote: text(raw.parkingNote, PLACE_NOTE_MAX),
    corkage: tri(raw.corkage), corkageNote: text(raw.corkageNote, PLACE_NOTE_MAX),
    room: tri(raw.room), roomNote: text(raw.roomNote, PLACE_NOTE_MAX),
    drinks: ids(raw.drinks, known?.drinks).filter((id) => id.startsWith("d")), foods: ids(raw.foods, known?.foods).filter((id) => id.startsWith("f")),
    menuNote: text(raw.menuNote, PLACE_MENU_NOTE_MAX),
    source: raw.source === "partner" ? "partner" : "operator",
    verifiedAt: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
  };
}

/** 아무것도 적지 않은 입력인가 — 빈 값은 저장하지 않는다 */
export function isEmptyPlaceInfo(i: PlaceInfo): boolean {
  return !i.parking && !i.corkage && !i.room && !i.drinks.length && !i.foods.length && !i.menuNote && !i.parkingNote && !i.corkageNote && !i.roomNote;
}

const PARKING_LABEL: Record<ParkingKind, string> = { free: "주차 무료", paid: "주차 유료", valet: "발레파킹", street: "노상 주차", none: "주차 불가" };
export type InfoChip = { key: AmenityChip["key"] | "corkage" | "room"; label: string; tone: "yes" | "no"; verified: boolean };

/**
 * 식당 이름 옆 칩 — 운영자(제휴 식당) 확인 값이 구글 값보다 먼저. 주차는 확인 값이 있으면 구글 주차를 덮는다.
 * 콜키지·룸은 "불가"도 보여 준다(운영자가 확인한 사실이라 빈칸과 구분된다). 구글의 단체·예약은 그대로 뒤에.
 */
export function placeChips(info: PlaceInfo | null | undefined, google: PlaceAmenities | null | undefined): InfoChip[] {
  const out: InfoChip[] = [];
  if (info?.corkage) out.push({ key: "corkage", label: info.corkage === "yes" ? "콜키지 가능" : "콜키지 불가", tone: info.corkage, verified: true });
  if (info?.room) out.push({ key: "room", label: info.room === "yes" ? "룸 있음" : "룸 없음", tone: info.room, verified: true });
  const parking = info?.parking ?? null;
  if (parking) out.push({ key: "parking", label: PARKING_LABEL[parking], tone: parking === "none" ? "no" : "yes", verified: true });
  else if (google?.parking) out.push({ key: "parking", label: PARKING_LABEL[google.parking], tone: google.parking === "none" ? "no" : "yes", verified: false });
  if (google?.groups) out.push({ key: "groups", label: "단체 가능", tone: "yes", verified: false });
  if (google?.reservable) out.push({ key: "reservable", label: "예약 가능", tone: "yes", verified: false });
  return out;
}

/** 칩 아래 한 줄 메모 — "콜키지 병당 1만원 · 룸 6인실 2개 · 주차 건물 지하 2시간" (적은 것만) */
export function placeNoteLine(info: PlaceInfo | null | undefined): string | null {
  if (!info) return null;
  const parts = [info.corkageNote && `콜키지 ${info.corkageNote}`, info.roomNote && `룸 ${info.roomNote}`, info.parkingNote && `주차 ${info.parkingNote}`].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/** "운영자 확인 2026.09" / "매장 제공 2026.09" */
export function verifiedLabel(info: Pick<PlaceInfo, "source" | "verifiedAt">): string {
  const who = info.source === "partner" ? "매장 제공" : "운영자 확인";
  return info.verifiedAt ? `${who} ${info.verifiedAt.slice(0, 4)}.${info.verifiedAt.slice(5, 7)}` : who;
}

/** 확인된 식당을 앞으로 — 그 안과 밖의 순서(관련도·평점순)는 그대로 둔다 */
export function verifiedFirst<T extends { info?: PlaceInfo | null }>(places: T[]): T[] {
  return [...places.filter((p) => p.info), ...places.filter((p) => !p.info)];
}
