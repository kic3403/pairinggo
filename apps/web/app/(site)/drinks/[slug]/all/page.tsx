/**
 * 술의 페어링 전부(2026-09-30) — 상세는 앞쪽 40장만 싣고(lib/detail-items.ts) 나머지는 여기서. 검색엔진에는 상세가 대표(noindex + canonical).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { findBySlug, toSlug } from "@pairinggo/shared";
import { getCatalog } from "@/lib/catalog";
import { expertTiersByName } from "@/lib/experts";
import { drinkItems } from "@/lib/detail-items";
import PickTabs from "../../../_components/PickTabs";
import { PairingCards, pickCounts } from "../../../_components/PairingCards";

export const revalidate = 600;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = await getCatalog();
  const drink = findBySlug(c.dataset.drinks, (await params).slug, (d) => d.name);
  if (!drink) return { title: "찾을 수 없는 술 | 페어링GO" };
  return { title: `${drink.name}에 어울리는 안주 전체 | 페어링GO`, robots: { index: false, follow: true }, alternates: { canonical: `/drinks/${toSlug(drink.name)}` } };
}

export default async function DrinkAllPage({ params }: { params: Promise<{ slug: string }> }) {
  const c = await getCatalog();
  const drink = findBySlug(c.dataset.drinks, (await params).slug, (d) => d.name);
  if (!drink) notFound();
  const items = await drinkItems(drink);
  const tiers = await expertTiersByName();
  const back = `/drinks/${toSlug(drink.name)}`;
  return (
    <div className="wrap">
      <p className="crumb"><Link href="/">홈</Link> · <Link href="/drinks">주류</Link> · <Link href={back}>{drink.name}</Link></p>
      <h1>{drink.name}에 어울리는 안주 <span className="muted small">{items.length}개 전부</span></h1>
      <PickTabs counts={pickCounts(items)} loaded={items.length}>
        <PairingCards items={items} tiers={tiers} />
      </PickTabs>
      <p style={{ marginTop: 16 }}><Link className="btn" href={back}>← {drink.name} 화면으로</Link></p>
    </div>
  );
}
