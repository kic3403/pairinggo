/** 홈 공유 미리보기 이미지 — 카톡·문자로 pairinggo.vercel.app 링크를 보낼 때 뜬다. 글자·칩은 lib/og.tsx */
import { ogImage, OG_SIZE } from "@/lib/og";
import { getCatalog } from "@/lib/catalog";

export const alt = "페어링GO — 맛있는 술과 어울리는 맛있는 음식은?";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 3600;

export default async function Image() {
  const c = await getCatalog();
  return ogImage({
    kicker: "전통주 × 음식 페어링",
    title: "맛있는 술과 어울리는\n맛있는 음식은?",
    chips: [`전통주 ${c.counts.drinks}`, `음식 ${c.counts.foods}`, `페어링 ${c.counts.pairings.toLocaleString("ko-KR")}`],
    note: "양조장 · 소믈리에 · 전문 매체 · 대중의 추천 근거와 함께",
  });
}
