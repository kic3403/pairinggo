/** 어드민 — 회원 추천 검수: 카탈로그에 없는 술/음식을 적은 추천(review)에 술·음식을 지정해 게시하거나 숨긴다. */
import { requireAdmin } from "@/lib/admin-auth";
import { getCatalog } from "@/lib/catalog";
import { listReviewPicks } from "@/lib/member-picks";
import AdminPicks from "./AdminPicks";

export const dynamic = "force-dynamic";

export default async function AdminPicksPage() {
  await requireAdmin();
  const [c, rows] = await Promise.all([getCatalog(), listReviewPicks()]);
  const D = new Map(c.dataset.drinks.map((d) => [d.id, d.name])), F = new Map(c.dataset.foods.map((f) => [f.id, f.name]));
  const items = rows.map((r) => ({
    id: r.id, status: r.status, note: r.note, image: r.image_url, nick: r.users?.name || "회원", at: r.created_at.slice(0, 16).replace("T", " "), reviewNote: r.review_note,
    drinkId: r.drink_id, foodId: r.food_id, drinkText: r.drink_id ? D.get(r.drink_id) ?? r.drink_id : r.drink_raw ?? "", foodText: r.food_id ? F.get(r.food_id) ?? r.food_id : r.food_raw ?? "",
  }));
  return (
    <>
      <h2 style={{ margin: "0 0 8px" }}>회원 추천 검수 <span className="muted">{items.filter((x) => x.status === "review").length}건 대기 · 숨김 {items.filter((x) => x.status === "hidden").length}</span></h2>
      <p className="muted" style={{ marginBottom: 10 }}>회원이 직접 적은 이름을 카탈로그의 술·음식에 맞춰 <b>게시</b>하면 정상 추천으로 집계됩니다(같은 조합이 기준 인원을 넘기면 회원픽 카드가 생깁니다). 카탈로그에 없는 음식이면 먼저 음식을 만든 뒤 지정하세요. 광고·욕설은 <b>숨김</b>.</p>
      <AdminPicks items={items} drinks={c.dataset.drinks.map((d) => ({ id: d.id, name: d.name }))} foods={c.dataset.foods.map((f) => ({ id: f.id, name: f.name }))} />
    </>
  );
}
