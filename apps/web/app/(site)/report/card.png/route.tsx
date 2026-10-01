/** 월간 리포트 그림 카드(1080×1350) — 많이 찾는 전통주 5 · 핫한 페어링 3. /report의 "그림 카드 저장"이 받는다 */
import { getCatalog } from "@/lib/catalog";
import { shareCardImage } from "@/lib/og";
import { buildReport } from "@/lib/report";
import { siteUrl } from "@/lib/site";

export const revalidate = 3600;

export async function GET() {
  const c = await getCatalog();
  const r = await buildReport(c.dataset);
  const host = siteUrl().replace(/^https?:\/\//, "");
  return shareCardImage({
    kicker: `최근 30일 · ${r.from.slice(5).replace("-", "/")}~${r.to.slice(5).replace("-", "/")}`,
    title: `${r.month}월 전통주 트렌드`,
    lists: [
      { title: "요즘 많이 찾는 전통주", rows: r.top.slice(0, 5).map((d) => d.name) },
      { title: "핫한 페어링", rows: r.hot.slice(0, 3).map((h) => `${h.drink} × ${h.food}`) },
    ].filter((l) => l.rows.length > 0),
    footer: `${host}/report`,
  });
}
