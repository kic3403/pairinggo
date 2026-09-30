/**
 * 음식의 페어링 전부(2026-09-30) — 상세는 앞쪽 40장만 싣고(lib/detail-items.ts) 나머지는 여기서. 검색엔진에는 상세가 대표(noindex + canonical).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { findBySlug, toSlug } from "@pairinggo/shared";
import { getCatalog } from "@/lib/catalog";
import { expertTiersByName } from "@/lib/experts";
import { foodItems } from "@/lib/detail-items";
import PickTabs from "../../../_components/PickTabs";
import { PairingCards, pickCounts } from "../../../_components/PairingCards";

export const revalidate = 600;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = await getCatalog();
  const food = findBySlug(c.dataset.foods, (await params).slug, (f) => f.name);
  if (!food) return { title: "찾을 수 없는 음식 | 페어링GO" };
  return { title: `${food.name}에 어울리는 술 전체 | 페어링GO`, robots: { index: false, follow: true }, alternates: { canonical: `/foods/${toSlug(food.name)}` } };
}

export default async function FoodAllPage({ params }: { params: Promise<{ slug: string }> }) {
  const c = await getCatalog();
  const food = findBySlug(c.dataset.foods, (await params).slug, (f) => f.name);
  if (!food) notFound();
  const items = await foodItems(food);
  const tiers = await expertTiersByName();
  const back = `/foods/${toSlug(food.name)}`;
  return (
    <div className="wrap">
      <p className="crumb"><Link href="/">홈</Link> · <Link href="/foods">음식·안주</Link> · <Link href={back}>{food.name}</Link></p>
      <h1>{food.name}에 어울리는 술 <span className="muted small">{items.length}개 전부</span></h1>
      <PickTabs counts={pickCounts(items)} loaded={items.length}>
        <PairingCards items={items} tiers={tiers} />
      </PickTabs>
      <p style={{ marginTop: 16 }}><Link className="btn" href={back}>← {food.name} 화면으로</Link></p>
    </div>
  );
}
