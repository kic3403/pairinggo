import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { gapQueue, listCandidates } from "@/lib/admin-data";
import { getCatalog } from "@/lib/catalog";
import ReviewList, { type Card } from "./ReviewList";

export const dynamic = "force-dynamic";
const TIERS = ["official", "sommelier", "media", "blog", "user"];

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ status?: string; tier?: string; drink?: string; view?: string; page?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const status = sp.status || "draft";
  // 기본 화면 = 근거 빈칸 대기열(docs/20 P2-1). 등급·술 필터나 다른 상태를 고르면 기존 '언급 많은 순' 목록
  const gapView = status === "draft" && !sp.tier && !sp.drink && sp.view !== "all";
  const page = Math.max(0, Number(sp.page) || 0);
  const queue = gapView ? await gapQueue(page) : null;
  const rows = queue ? queue.items.map((q) => q.item) : await listCandidates({ status, tier: sp.tier, drink: sp.drink, limit: 80 });
  const meta = new Map(queue?.items.map((q) => [q.item.id, q]) ?? []);
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
    siblings: meta.get(r.id)?.others ?? rows.filter((x) => x.id !== r.id && x.drink_id && x.drink_id === r.drink_id && x.food_id === r.food_id).length,
    gap: meta.get(r.id)?.gap ?? null,
  }));
  const link = (k: string, v: string | undefined) => { const q = new URLSearchParams({ status, ...(sp.tier ? { tier: sp.tier } : {}), ...(sp.drink ? { drink: sp.drink } : {}), ...(sp.view ? { view: sp.view } : {}) }); if (v) q.set(k, v); else q.delete(k); if (k !== "page") q.delete("page"); return `/admin/review?${q}`; };
  const pages = queue ? Math.ceil(queue.totalPairs / 50) : 0;
  return (
    <>
      <h2 style={{ margin: "0 0 8px" }}>검수 {queue ? <span className="muted">근거 빈칸 우선 · {page + 1}/{Math.max(pages, 1)}쪽 · {rows.length}장</span> : <span className="muted">{rows.length}건 · 언급 많은 순</span>}</h2>
      {status === "draft" && !sp.tier && !sp.drink && (
        <div className="filters">
          <Link href="/admin/review" className={gapView ? "on" : ""}>근거 빈칸 우선</Link>
          <Link href="/admin/review?view=all" className={!gapView ? "on" : ""}>전체 (언급 많은 순)</Link>
        </div>
      )}
      {queue && (
        <p className="muted" style={{ marginBottom: 8 }}>
          근거가 하나도 없는 술 {queue.gapDrinks}종·음식 {queue.gapFoods}종에 걸린 후보 {queue.totalCandidates.toLocaleString()}건을 조합 {queue.totalPairs.toLocaleString()}개로 묶었어요.
          술·음식이 모두 빈칸인 조합 → 한쪽만 빈칸, 같은 술·음식이 몰리지 않게 섞었습니다. 같은 조합 후보는 대표 1장(등급·언급 높은 것) — 승인하면 나머지는 다음에 두 번째 근거로 올라와요.
        </p>
      )}
      <div className="filters">
        {[["draft", "대기"], ["needs_entity", "지정 필요"], ["promoted", "승격됨"], ["rejected", "거절"]].map(([s, l]) => <Link key={s} href={link("status", s)} className={status === s ? "on" : ""}>{l}</Link>)}
        <span className="chip">|</span>
        {TIERS.map((t) => <Link key={t} href={link("tier", sp.tier === t ? undefined : t)} className={sp.tier === t ? "on" : ""}>{t}</Link>)}
        {sp.drink && <Link href={link("drink", undefined)} className="on">{D.get(sp.drink)?.name} ×</Link>}
      </div>
      <p className="muted" style={{ marginBottom: 10 }}>단축키 <span className="kbd">A</span> 승인 · <span className="kbd">R</span> 거절 · <span className="kbd">S</span> 건너뛰기 · <span className="kbd">↑↓</span> 이동. 승인 규칙: official/sommelier 1개 또는 근거 2개 이상이면 바로 게시(curated), 아니면 pending.</p>
      <ReviewList cards={cards} />
      {queue && pages > 1 && (
        <div className="row" style={{ marginTop: 12, justifyContent: "center" }}>
          {page > 0 && <Link className="btn" href={link("page", String(page - 1))}>← 이전 50장</Link>}
          <Link className="btn" href={link("page", String(page))}>새로고침 (처리한 카드 빼고 다시)</Link>
          {page + 1 < pages && <Link className="btn" href={link("page", String(page + 1))}>다음 50장 →</Link>}
        </div>
      )}
    </>
  );
}
