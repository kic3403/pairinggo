/**
 * 오늘의 페어링 그림 카드(1080×1350, 인스타 4:5) — /today의 "그림 카드 저장"이 받는다. 화면과 같은 조합(shared todayPick).
 * 칩에 서울 날씨 한 줄(2026-10-02, docs/29 §5-3 — 날마다 글이 달라지게). 카드는 누구에게나 같아서 서울 기준, 못 받으면 칩 없음
 */
import { clipText, confidenceText, firstSentence, gradeOf, kindOf, kstParts, situationOf, subtypeLabel, todayPick } from "@pairinggo/shared";
import { weatherFor } from "@/lib/weather";
import { getCatalog } from "@/lib/catalog";
import { shareCardImage } from "@/lib/og";
import { siteUrl } from "@/lib/site";

export const revalidate = 600;

export async function GET() {
  const c = await getCatalog();
  const date = kstParts(new Date()).date;
  const t = todayPick(c.dataset, date);
  const w = await weatherFor("서울").catch(() => null);
  const s = situationOf(date, w, "서울");
  const weatherChip = s.fromWeather ? `${s.icon} 서울 ${s.temp === null ? "" : `${Math.round(s.temp)}℃ `}${s.key === "rain" ? "비" : s.key === "snow" ? "눈" : s.key === "cold" ? "추운 날" : s.key === "hot" ? "더운 날" : s.key === "cool" ? "선선한 날" : "봄·가을 날씨"}`.replace(/\s+/g, " ") : null;
  const host = siteUrl().replace(/^https?:\/\//, "");
  const dateLabel = `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`;
  const d = t && c.dataset.drinks.find((x) => x.id === t.main.d), f = t && c.dataset.foods.find((x) => x.id === t.main.f);
  if (!t || !d || !f) return shareCardImage({ kicker: `오늘의 페어링 · ${dateLabel}`, title: "맛있는 술엔 맛있는 음식", footer: host });
  const p = t.main;
  return shareCardImage({
    kicker: `오늘의 페어링 · ${dateLabel} (${t.weekday})`,
    headline: t.headline,
    pair: {
      drink: d.name, drinkMeta: [kindOf(d) === "trad" ? d.category : subtypeLabel(d), d.abv != null ? `${d.abv}%` : null, d.brewery].filter(Boolean).join(" · "),
      food: f.name, foodMeta: [f.category, ...(f.tags ?? []).slice(0, 2)].join(" · "),
    },
    chips: [gradeOf(p).label, confidenceText(p), ...(weatherChip ? [weatherChip] : [])],
    quote: p.ev?.quote ? clipText(p.ev.quote, 62) : undefined,
    who: p.ev?.quote ? (p.ev.who || p.ev.source || undefined) : undefined,
    note: !p.ev?.quote && p.reason ? firstSentence(p.reason) : undefined,
    footer: `${host}/today`,
  });
}
