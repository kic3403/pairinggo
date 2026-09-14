/** 술 상세 공유 이미지 — 술 이름 + 어울리는 음식 3개(등급순, 상세 목록과 같은 순서). 없는 술이면 홈 그림 */
import { F, byDrink, findBySlug, scorePairings, toSlug } from "@pairinggo/shared";
import { ogImage, OG_SIZE } from "@/lib/og";
import { getCatalog } from "@/lib/catalog";

export const alt = "전통주에 어울리는 음식 | 페어링GO";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 3600;
/** 페이지의 generateStaticParams만으로는 이미지 라우트가 동적(ƒ)으로 남았다(빌드 실측) — 이미지 파일에도 적어야 빌드 때 미리 만든다 */
export async function generateStaticParams() {
  const c = await getCatalog();
  return c.dataset.drinks.map((x) => ({ slug: toSlug(x.name) }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const c = await getCatalog();
  const drink = findBySlug(c.dataset.drinks, decodeURIComponent((await params).slug), (d) => d.name);
  if (!drink) return ogImage({ kicker: "전통주 × 음식 페어링", title: "페어링GO", chips: [], note: "맛있는 술과 어울리는 맛있는 음식은?" });
  const rows = byDrink[drink.id] || [];
  const top = scorePairings(rows, (p) => F[p.f]?.category || "").slice(0, 3).map((s) => F[s.p.f]?.name).filter((x): x is string => !!x);
  return ogImage({
    kicker: [drink.category, drink.abv != null ? `${drink.abv}%` : null, drink.region].filter(Boolean).join(" · "),
    title: drink.name,
    chips: top,
    note: `${drink.name}에 어울리는 음식 ${rows.length}가지 — 근거와 함께 · 페어링GO`,
    accent: "food",
  });
}
