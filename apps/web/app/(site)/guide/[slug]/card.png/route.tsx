/**
 * 모음 화면 그림 카드(1080×1350) — "막걸리 안주 추천 TOP 5"처럼 그 모음의 앞 다섯 가지와 짝 이름(2026-10-02).
 * 어드민 '글 초안'(/admin/posts)의 글과 한 벌로 쓴다 — 글도 같은 순서의 다섯 가지다(shared seo/blog-draft.ts). 없는 모음은 404.
 */
import { BLOG_DRAFT_TOP, clipText, findGuide, guideContent } from "@pairinggo/shared";
import { getCatalog } from "@/lib/catalog";
import { shareCardImage } from "@/lib/og";
import { siteUrl } from "@/lib/site";

export const revalidate = 3600;

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const c = await getCatalog();
  const def = findGuide(c.dataset, decodeURIComponent((await params).slug));
  if (!def) return new Response("없는 카드입니다", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const g = guideContent(c.dataset, def, BLOG_DRAFT_TOP, 3);
  const isDrink = def.side === "drink";
  const rows = isDrink ? g.foods : g.drinks;
  const host = siteUrl().replace(/^https?:\/\//, "");
  const url = `${host}/guide/${def.slug}`;
  return shareCardImage({
    kicker: `근거가 확인된 조합 ${def.n}개에서`,
    title: isDrink ? `${def.word} 안주 TOP ${rows.length}` : `${def.word}에 어울리는 술 TOP ${rows.length}`,
    titleTone: isDrink ? "drink" : "food",
    lists: [{
      title: isDrink ? "많이 짝지어진 음식 순서" : "많이 짝지어진 술 순서",
      rows: rows.map((r) => r.item.name),
      sub: rows.map((r) => clipText(r.with.map((w) => w.item.name).join(" · "), 30)),   // 한 줄에 들어가게
    }],
    footer: url.length <= 34 ? url : `${host}/guide`,
  });
}
