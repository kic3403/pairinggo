/** 어드민 — 음식 사진(2026-09-26): 줄마다 주소·출처를 적고 저장. 사용 허락을 받은 사진만(직접 촬영·라이선스 확인분). */
import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { listFoodsAdmin } from "@/lib/admin-foods";
import FoodImageRows from "./FoodImageRows";

export const dynamic = "force-dynamic";
type Q = { q?: string; missing?: string };

export default async function AdminFoods({ searchParams }: { searchParams: Promise<Q> }) {
  await requireAdmin();
  const sp = await searchParams;
  const all = await listFoodsAdmin();
  const q = (sp.q ?? "").trim();
  let rows = all;
  if (sp.missing === "1") rows = rows.filter((r) => !r.imageUrl);
  if (q) rows = rows.filter((r) => r.name.includes(q) || r.category.includes(q) || r.id === q);
  const withImg = all.filter((r) => r.imageUrl).length;
  return (
    <>
      <h2 style={{ margin: "0 0 8px" }}>음식 사진 <span className="muted">{rows.length}종 표시 · 전체 {all.length}종 · 사진 있음 {withImg}</span></h2>
      <p className="muted" style={{ marginBottom: 10 }}>상세 머리 카드 오른쪽 칸과 검색 결과 썸네일에 쓰입니다. 사진이 없으면 분류 색 타일이 대신 보입니다. <b>사용 허락을 받은 사진만</b>(직접 촬영·라이선스 확인분) — 주소는 https://… 또는 /… . 저장하면 바로 발행됩니다.</p>
      <div className="row" style={{ marginBottom: 8 }}>
        <Link className={`btn sm${sp.missing === "1" ? " p" : ""}`} href={sp.missing === "1" ? "/admin/foods" : "/admin/foods?missing=1"}>사진 없음 {all.length - withImg}</Link>
        <form action="/admin/foods" style={{ display: "inline-flex", gap: 6, marginLeft: "auto" }}>
          {sp.missing && <input type="hidden" name="missing" value={sp.missing} />}
          <input name="q" defaultValue={q} placeholder="이름·분류 또는 id" style={{ width: 160 }} /><button className="btn sm" type="submit">찾기</button>
        </form>
      </div>
      <div className="card"><FoodImageRows rows={rows.slice(0, 300)} /></div>
    </>
  );
}
