/**
 * 홈 "종류별 BEST 페어링"(2026-10-03 UI 리뉴얼, 캐치테이블 "가격대별 BEST" 탭+줄 형식) — 술 종류 탭(막걸리·약주·전통 소주·과실주)마다
 * 근거 조합이 많은 술 3개와 그 술의 대표 음식 한 가지(shared seo/guides.ts guideContent — 근거 확인·약함만, 추정 제외).
 * 탭 전환은 BestTabs(브라우저)에서, 내용은 서버가 모두 그려 둔다(검색봇도 본다).
 */
import Link from "next/link";
import { firstSentence, gradeOf, guideContent, guideList, toSlug, type Dataset } from "@pairinggo/shared";
import BestTabs from "./BestTabs";

const CATS: { category: string; label: string }[] = [{ category: "탁주", label: "막걸리" }, { category: "약주", label: "약주" }, { category: "증류주", label: "전통 소주" }, { category: "과실주", label: "과실주" }];
const TONE: Record<string, string> = { 탁주: "linear-gradient(160deg, #F6D3A8, #B8742E)", 약주: "linear-gradient(160deg, #F8F1DD, #8A6D1F)", 증류주: "linear-gradient(160deg, #D8ECF5, #2F5C7A)", 과실주: "linear-gradient(160deg, #F2A9A0, #8E2A32)" };

export default function BestPairings({ ds }: { ds: Dataset }) {
  const guides = guideList(ds);
  const byD = new Map(ds.pairings.map((p) => [`${p.d}|${p.f}`, p]));
  const panels = CATS.map((c) => {
    const def = guides.find((g) => g.side === "drink" && g.by === "category" && g.category === c.category);
    if (!def) return null;
    const rows = guideContent(ds, def, 3, 1).drinks.filter((r) => r.with.length).map((r) => {
      const w = r.with[0];
      const p = byD.get(`${r.item.id}|${w.item.id}`);
      return { drink: r.item, food: w.item, conf: w.conf, reason: firstSentence(w.reason || "", 48), grade: p ? gradeOf(p).label : null, img: r.item.image?.url ?? w.item.image?.url ?? null };
    });
    return rows.length ? { ...c, slug: def.slug, rows } : null;
  }).filter((x): x is NonNullable<typeof x> => !!x);
  if (!panels.length) return null;
  return (
    <section className="best">
      <h2>종류별 BEST 페어링</h2>
      <BestTabs tabs={panels.map((p) => ({ key: p.category, label: p.label }))}>
        {panels.map((p) => (
          <div key={p.category} className="best-panel" data-key={p.category}>
            <ul className="best-list">
              {p.rows.map((r) => (
                <li key={`${r.drink.id}|${r.food.id}`}>
                  <Link href={`/foods/${toSlug(r.food.name)}?d=${r.drink.id}`} className="best-row">
                    <span className="br-img" style={r.img ? undefined : { background: TONE[p.category] }}>{r.img && <img src={r.img} alt="" loading="lazy" decoding="async" />}</span>
                    <span className="br-body">
                      <b><span className="d">{r.drink.name}</span> <span className="x">×</span> <span className="f">{r.food.name}</span></b>
                      {r.reason && <span className="br-reason">{r.reason}</span>}
                      <span className="br-meta">{r.grade && <span className={`bdg ${r.grade === "찰떡" ? "best" : ""}`}>{r.grade}</span>}<span className={`conf ${r.conf}`}>{r.conf === "confirmed" ? "근거 확인" : "근거 약함"}</span></span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link href={`/guide/${p.slug}`} className="best-more">{p.label} 안주 모음 전체 ›</Link>
          </div>
        ))}
      </BestTabs>
    </section>
  );
}
