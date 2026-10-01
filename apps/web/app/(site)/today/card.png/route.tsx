/** 오늘의 페어링 그림 카드(1080×1350, 인스타 4:5) — /today의 "그림 카드 저장"이 받는다. 화면과 같은 조합(shared todayPick) */
import { clipText, confidenceText, firstSentence, gradeOf, kindOf, kstParts, subtypeLabel, todayPick } from "@pairinggo/shared";
import { getCatalog } from "@/lib/catalog";
import { shareCardImage } from "@/lib/og";
import { siteUrl } from "@/lib/site";

export const revalidate = 600;

export async function GET() {
  const c = await getCatalog();
  const date = kstParts(new Date()).date;
  const t = todayPick(c.dataset, date);
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
    chips: [gradeOf(p).label, confidenceText(p)],
    quote: p.ev?.quote ? clipText(p.ev.quote, 62) : undefined,
    who: p.ev?.quote ? (p.ev.who || p.ev.source || undefined) : undefined,
    note: !p.ev?.quote && p.reason ? firstSentence(p.reason) : undefined,
    footer: `${host}/today`,
  });
}
