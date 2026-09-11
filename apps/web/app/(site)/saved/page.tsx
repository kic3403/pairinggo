/** 저장 목록 — 로그인한 본인 것만. */
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { D, F, byDrink, byFood, toSlug } from "@pairinggo/shared";
import { auth } from "@/auth";
import { getCatalog } from "@/lib/catalog";
import { listSaved } from "@/lib/saved";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "저장 목록 | 페어링GO", robots: { index: false } };

export default async function SavedPage() {
  const session = await auth();
  const uid = session?.user?.id;
  if (!uid) redirect("/login?next=%2Fsaved");

  await getCatalog();
  const rows = await listSaved(uid);
  const drinks = rows.filter((r) => r.kind === "drink").map((r) => D[r.item_id]).filter(Boolean);
  const foods = rows.filter((r) => r.kind === "food").map((r) => F[r.item_id]).filter(Boolean);

  return (
    <div className="wrap">
      <h1>저장 목록</h1>
      <p className="lead">{rows.length ? `전통주 ${drinks.length}종 · 음식 ${foods.length}종` : "아직 저장한 것이 없습니다."}</p>

      {!rows.length && (
        <div className="btns">
          <Link className="btn p" href="/drinks">전통주 둘러보기</Link>
          <Link className="btn f" href="/foods">음식으로 찾기</Link>
        </div>
      )}

      {!!drinks.length && (
        <section>
          <h2>전통주 {drinks.length}종</h2>
          <ul className="grid">
            {drinks.map((d) => (
              <li key={d.id}>
                <Link href={`/drinks/${toSlug(d.name)}`}>
                  <span className="n">{d.name}</span>
                  <span className="s">{[d.category, d.region, `어울리는 음식 ${(byDrink[d.id] || []).length}`].filter(Boolean).join(" · ")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!!foods.length && (
        <section>
          <h2>음식 {foods.length}종</h2>
          <ul className="grid">
            {foods.map((f) => (
              <li key={f.id}>
                <Link href={`/foods/${toSlug(f.name)}`}>
                  <span className="n">{f.name}</span>
                  <span className="s">{[f.category, `어울리는 술 ${(byFood[f.id] || []).length}`].filter(Boolean).join(" · ")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
