import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { listCandidates } from "@/lib/admin-data";
import { getCatalog } from "@/lib/catalog";
import ReviewList, { type Card } from "./ReviewList";

export const dynamic = "force-dynamic";
const TIERS = ["official", "sommelier", "media", "blog", "user"];

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ status?: string; tier?: string; drink?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const status = sp.status || "draft";
  const rows = await listCandidates({ status, tier: sp.tier, drink: sp.drink, limit: 80 });
  const c = await getCatalog();
  const D = new Map(c.dataset.drinks.map((d) => [d.id, d])), F = new Map(c.dataset.foods.map((f) => [f.id, f]));
  const evCount = new Map<string, number>();
  for (const p of c.dataset.pairings) evCount.set(p.d + "|" + p.f, 1);
  const cards: Card[] = rows.map((r) => ({
    ...r,
    drinkName: r.drink_id ? D.get(r.drink_id)?.name ?? r.drink_raw ?? "?" : r.drink_raw ?? "?",
    foodName: r.food_id ? F.get(r.food_id)?.name ?? r.food_raw ?? "?" : r.food_raw ?? "?",
    existing: r.drink_id && r.food_id ? c.dataset.pairings.find((p) => p.d === r.drink_id && p.f === r.food_id) ?? null : null,
    sameUrl: !!(r.url && r.drink_id && r.food_id && c.dataset.pairings.find((p) => p.d === r.drink_id && p.f === r.food_id)?.ev?.url === r.url),
    siblings: rows.filter((x) => x.id !== r.id && x.drink_id && x.drink_id === r.drink_id && x.food_id === r.food_id).length,
  }));
  const link = (k: string, v: string | undefined) => { const q = new URLSearchParams({ status, ...(sp.tier ? { tier: sp.tier } : {}), ...(sp.drink ? { drink: sp.drink } : {}) }); if (v) q.set(k, v); else q.delete(k); return `/admin/review?${q}`; };
  return (
    <>
      <h2 style={{ margin: "0 0 8px" }}>검수 <span className="muted">{rows.length}건 · 언급 많은 순</span></h2>
      <div className="filters">
        {[["draft", "대기"], ["needs_entity", "지정 필요"], ["promoted", "승격됨"], ["rejected", "거절"]].map(([s, l]) => <Link key={s} href={link("status", s)} className={status === s ? "on" : ""}>{l}</Link>)}
        <span className="chip">|</span>
        {TIERS.map((t) => <Link key={t} href={link("tier", sp.tier === t ? undefined : t)} className={sp.tier === t ? "on" : ""}>{t}</Link>)}
        {sp.drink && <Link href={link("drink", undefined)} className="on">{D.get(sp.drink)?.name} ×</Link>}
      </div>
      <p className="muted" style={{ marginBottom: 10 }}>단축키 <span className="kbd">A</span> 승인 · <span className="kbd">R</span> 거절 · <span className="kbd">S</span> 건너뛰기 · <span className="kbd">↑↓</span> 이동. 승인 규칙: official/sommelier 1개 또는 근거 2개 이상이면 바로 게시(curated), 아니면 pending.</p>
      <ReviewList cards={cards} />
    </>
  );
}
