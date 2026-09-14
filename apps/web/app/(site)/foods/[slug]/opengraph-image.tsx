/** 음식 상세 공유 이미지 — 음식 이름 + 어울리는 전통주 3개(등급순). 없는 음식이면 홈 그림 */
import { D, byFood, findBySlug, scorePairings } from "@pairinggo/shared";
import { ogImage, OG_SIZE } from "@/lib/og";
import { getCatalog } from "@/lib/catalog";

export const alt = "음식에 어울리는 전통주 | 페어링GO";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 3600;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const c = await getCatalog();
  const food = findBySlug(c.dataset.foods, decodeURIComponent((await params).slug), (f) => f.name);
  if (!food) return ogImage({ kicker: "전통주 × 음식 페어링", title: "페어링GO", chips: [], note: "맛있는 술과 어울리는 맛있는 음식은?" });
  const rows = byFood[food.id] || [];
  const top = scorePairings(rows, (p) => D[p.d]?.category || "").slice(0, 3).map((s) => D[s.p.d]?.name).filter((x): x is string => !!x);
  return ogImage({
    kicker: [food.category, ...(food.tags ?? []).slice(0, 2)].join(" · "),
    title: food.name,
    chips: top,
    note: `${food.name}에 어울리는 전통주 ${rows.length}가지 — 근거와 함께 · 페어링GO`,
    accent: "drink",
  });
}
