/**
 * 주간 "많이 찾는 술" — 술 종류별 TOP 5(2026-10-02 사용자 요청: 전통주·위스키·사케·와인을 따로).
 * `/weekly` 화면과 그림 카드(`/weekly/[kind]/card.png`, 1080×1350)가 쓴다. 순위는 언급량 순위(drinks.trend.rank — 매일 크론이 매김)를
 * 종류 안에서 다시 줄 세운 것. **순위가 매겨진 술이 WEEKLY_MIN개 이상인 종류만** 나온다 — 지금은 전통주뿐이고,
 * 다른 종류는 카탈로그에 들어와 순위가 매겨지면 저절로 나타난다(코드 수정 없음).
 */
import type { Drink, DrinkKind } from "../types";
import { KIND_LABEL, kindOf } from "../catalog/kinds";
import { deltaBadge } from "../trend";
import { hashtags } from "./share-card";

export const WEEKLY_TOP = 5;
/** 이만큼은 있어야 '순위'라고 부를 수 있다 */
export const WEEKLY_MIN = 3;
/** 보여 주는 차례 */
export const WEEKLY_KIND_ORDER: DrinkKind[] = ["trad", "whisky", "sake", "wine"];

export type WeeklyRow = { drink: Drink; rank: number; badge: string | null };
export type WeeklyTop = { kind: DrinkKind; label: string; rows: WeeklyRow[] };

/** compared = 지난주 순위와 비교할 수 있는지(크론이 7일 전 순위를 함께 계산했을 때만 ▲▼·NEW) */
export function weeklyTopByKind(drinks: readonly Drink[], compared: boolean, n = WEEKLY_TOP): WeeklyTop[] {
  const out: WeeklyTop[] = [];
  for (const kind of WEEKLY_KIND_ORDER) {
    const ranked = drinks.filter((d) => kindOf(d) === kind && d.trend?.rank).sort((a, b) => a.trend!.rank! - b.trend!.rank! || a.name.localeCompare(b.name, "ko"));
    if (ranked.length < WEEKLY_MIN) continue;
    out.push({
      kind, label: KIND_LABEL[kind],
      rows: ranked.slice(0, n).map((drink, i) => { const b = deltaBadge(drink.trend, compared); return { drink, rank: i + 1, badge: b && b.kind !== "same" ? b.label : null }; }),
    });
  }
  return out;
}

/** 한국 날짜("YYYY-MM-DD") → "10월 1주" — 그 달의 며칠째 주인지(1~7일 = 1주) */
export function weekLabel(date: string): string {
  const m = Number(date.slice(5, 7)), d = Number(date.slice(8, 10));
  return `${m}월 ${Math.min(5, Math.max(1, Math.ceil(d / 7)))}주`;
}

/** SNS에 올릴 글 — 순위와 주소, 해시태그 */
export function weeklyCaption(top: WeeklyTop, date: string, base: string): string {
  return [
    `${weekLabel(date)} 많이 찾는 ${top.label} TOP ${top.rows.length}`,
    "",
    ...top.rows.map((r) => `${r.rank}. ${r.drink.name}${r.drink.brewery ? ` (${r.drink.brewery})` : ""}${r.badge ? ` ${r.badge}` : ""}`),
    "",
    "인스타·유튜브·블로그 최근 30일 언급량 순위예요.",
    `어울리는 음식까지 보기 → ${base}/weekly?utm_source=sns`,
    "",
    hashtags(["페어링GO", `${top.label}추천`, `${top.label}순위`, ...top.rows.map((r) => r.drink.name), "술추천"]),
    "주류는 만 19세 이상만. 지나친 음주는 건강에 해롭습니다.",
  ].join("\n");
}
