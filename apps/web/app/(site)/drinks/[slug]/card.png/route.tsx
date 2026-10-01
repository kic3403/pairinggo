/** 술 상세 그림 카드(1080×1350) — "이 술엔 이 음식" 3가지. 상세 화면의 'SNS에 올리기'가 받는다(lib/detail-share.ts). 없는 술은 404 */
import { findBySlug } from "@pairinggo/shared";
import { getCatalog } from "@/lib/catalog";
import { drinkShare } from "@/lib/detail-share";
import { shareCardImage } from "@/lib/og";
import { siteUrl } from "@/lib/site";

export const revalidate = 3600;

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const c = await getCatalog();
  const drink = findBySlug(c.dataset.drinks, decodeURIComponent((await params).slug), (d) => d.name);
  if (!drink) return new Response("없는 카드입니다", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const s = drinkShare(drink);
  const host = siteUrl().replace(/^https?:\/\//, "");
  return shareCardImage({
    kicker: s.meta,
    headline: "이 술엔 이 음식",
    title: s.name, titleTone: "drink",
    lists: s.items.length ? [{ title: `어울리는 음식 ${s.total}가지 가운데`, rows: s.items.map((x) => x.name), tags: s.items.map((x) => x.grade), sub: s.items.map((x) => x.conf) }] : [],
    footer: `${host}${s.path}`.length <= 34 ? `${host}${s.path}` : host,
  });
}
