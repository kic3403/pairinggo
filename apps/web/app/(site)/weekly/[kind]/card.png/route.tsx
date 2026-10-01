/**
 * 주간 "많이 찾는 술" 그림 카드(1080×1350) — 술 종류별로 한 장(/weekly/trad/card.png · whisky · sake · wine).
 * 순위가 3개 이상 매겨진 종류만 카드가 있다(shared seo/weekly.ts) — 없는 종류·모르는 종류는 404.
 */
import { kstToday, weekLabel, weeklyTopByKind } from "@pairinggo/shared";
import { getCatalog } from "@/lib/catalog";
import { shareCardImage } from "@/lib/og";
import { siteUrl } from "@/lib/site";

export const revalidate = 3600;

/** 순위 변동 배지(▲3·▼2·NEW)를 글자로 — 번들 글꼴에 ▲▼ 기호가 없어 그림에서는 숫자만 남는다 */
const badgeWords = (b: string | null) => (!b ? null : b.startsWith("▲") ? `${b.slice(1)}계단 상승` : b.startsWith("▼") ? `${b.slice(1)}계단 하락` : "새로 진입");

export async function GET(_req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const c = await getCatalog();
  const top = weeklyTopByKind(c.dataset.drinks, !!c.dataset.trend_meta?.compared_to).find((t) => t.kind === kind);
  if (!top) return new Response("없는 카드입니다", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const host = siteUrl().replace(/^https?:\/\//, "");
  return shareCardImage({
    kicker: `${weekLabel(kstToday())} · 최근 30일 언급량 순위`,
    title: `많이 찾는 ${top.label} TOP ${top.rows.length}`,
    lists: [{ title: "인스타·유튜브·블로그에서 많이 이야기된 순서", rows: top.rows.map((r) => r.drink.name), tags: top.rows.map((r) => badgeWords(r.badge)), sub: top.rows.map((r) => [r.drink.category, r.drink.brewery].filter(Boolean).join(" · ")) }],
    footer: `${host}/weekly`,
  });
}
