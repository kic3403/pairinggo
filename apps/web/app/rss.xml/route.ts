/**
 * RSS 피드(2026-09-28) — 오늘의 페어링 최근 14일. 네이버 서치어드바이저에 사이트맵과 함께 제출해 새 글 수집을 돕는다.
 * 항목 링크는 그 술 상세(정식 주소), guid는 날짜(같은 술이 다른 날 다시 나와도 항목은 따로). 규칙은 shared seo/rss.ts·pairing/today.ts.
 */
import { SRC_LABEL, confidenceText, josa, kstParts, recentTodayPicks, rssXml, toSlug, todayPick, type RssItem } from "@pairinggo/shared";
import { getCatalog } from "@/lib/catalog";
import { siteUrl } from "@/lib/site";

export const revalidate = 3600;

export async function GET() {
  const c = await getCatalog();
  const base = siteUrl();
  const D = new Map(c.dataset.drinks.map((d) => [d.id, d])), F = new Map(c.dataset.foods.map((f) => [f.id, f]));
  const today = kstParts(new Date()).date;
  const t = todayPick(c.dataset, today);
  const picks = [...(t ? [{ date: today, main: t.main }] : []), ...recentTodayPicks(c.dataset, today, 13)];
  const items: RssItem[] = picks.flatMap(({ date, main }) => {
    const d = D.get(main.d), f = F.get(main.f);
    if (!d || !f) return [];
    const md = `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`;
    const why = main.ev?.quote ? `“${main.ev.quote}”${main.ev.source ? ` — ${main.ev.source}` : ""}` : main.reason ?? "";
    return [{
      title: `오늘의 페어링 ${md} — ${josa(d.name, "과/와")} ${f.name}`,
      link: `${base}/drinks/${encodeURIComponent(toSlug(d.name))}`,
      guid: `today-${date}`,
      // 한국 시간 그날 0시
      pubDate: new Date(`${date}T00:00:00+09:00`),
      description: [`${d.name}(${[d.category, d.abv != null ? `${d.abv}%` : null, d.brewery].filter(Boolean).join(" · ")})에 어울리는 ${f.name}.`, confidenceText(main), SRC_LABEL[main.src ?? "profile"], why].filter(Boolean).join(" "),
    }];
  });
  const xml = rssXml({ title: "페어링GO — 오늘의 페어링", link: `${base}/today`, description: "근거가 확인된 전통주와 안주 조합을 날마다 하나씩 골라 드립니다.", selfUrl: `${base}/rss.xml` }, items);
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=3600" } });
}
