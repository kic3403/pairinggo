/** 어드민 — 술 한 종 편집(주종·속성·규격·참고가격). 본체는 DrinkEditor(클라이언트), 저장은 /admin/api/drinks */
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { getDrinkAdmin } from "@/lib/admin-drinks";
import DrinkEditor from "./DrinkEditor";

export const dynamic = "force-dynamic";

export default async function AdminDrinkEdit({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const d = await getDrinkAdmin(id);
  if (!d) notFound();
  return (
    <>
      <p className="muted"><Link href="/admin/drinks">← 술 정보 목록</Link></p>
      <h2 style={{ margin: "0 0 4px" }}>{d.name} <code className="muted">{d.id}</code>{d.demo && <span className="tag w" style={{ marginLeft: 8 }}>데모</span>}</h2>
      <p className="muted" style={{ marginBottom: 10 }}>{d.brewery}{d.abv != null ? ` · ${d.abv}%` : ""} · 이름·양조장·설명·맛 프로필은 데이터 도구(add-drinks·export)로 고칩니다. 여기서는 주종 분류와 규격·가격만.</p>
      <DrinkEditor drink={d} />
    </>
  );
}
