/**
 * 술 목록 카드(2026-09-24, 요구사항 §13) — 사진(없으면 종류 색 타일) · 이름 · 주종·세부 종류·생산지 · 조건을 충족한 용량과 참고가격 · 어울리는 음식 2 · 맛 태그 2 · 저장.
 * 여러 규격이 맞으면 최저 참고가격 규격을 보여 주고 '다른 용량 있음'을 붙인다. 가격·용량이 없으면 '정보 없음'으로 같은 자리에.
 * 상세 링크는 그 규격(?spec=)을 들고 가서 상세가 같은 규격으로 열린다.
 */
import Link from "next/link";
import { KIND_LABEL, bottleSpecs, countryLabel, kindOf, specLine, subtypeLabel, toSlug, type FilterItem } from "@pairinggo/shared";
import Heart from "../../_components/Heart";

const TILE: Record<string, string> = { trad: "#22406B", whisky: "#8A5A00", sake: "#3D6E9B", wine: "#7B2D4B" };

export default function DrinkCard({ item, foods, showKind }: { item: FilterItem; foods: string[]; showKind: boolean }) {
  const d = item.drink;
  const kind = kindOf(d);
  const where = kind === "trad" ? d.region?.split(" ")[0] : countryLabel(kind, d.country);
  const meta = [showKind ? KIND_LABEL[kind] : null, subtypeLabel(d), where, d.abv != null ? `${d.abv}%` : null].filter(Boolean).join(" · ");
  const others = bottleSpecs(d.specs).length > 1;
  const href = `/drinks/${toSlug(d.name)}${item.spec ? `?spec=${item.spec.id}` : ""}`;
  return (
    <li className="dcard">
      <Link href={href} className="dcard-link">
        {d.image?.url
          ? <img className="dcard-img" src={d.image.url} alt="" loading="lazy" />
          : <span className="dcard-tile" style={{ ["--tone" as string]: TILE[kind] }} aria-hidden>{subtypeLabel(d).slice(0, 2)}</span>}
        <span className="dcard-body">
          <span className="dcard-name">{d.name}{d.demo && <span className="badge n" style={{ marginLeft: 6 }}>데모</span>}</span>
          <span className="dcard-meta">{meta}</span>
          <span className={`dcard-spec${item.price == null ? " none" : ""}`}>{specLine(item.spec, item.price)}{others && <span className="dcard-more"> · 다른 용량 있음</span>}</span>
          {foods.length > 0 && <span className="dcard-foods">어울리는 음식 · {foods.join(", ")}</span>}
          {!!d.flavor?.length && <span className="dcard-tags">{d.flavor.slice(0, 2).map((t) => <span key={t} className="tag">{t}</span>)}</span>}
        </span>
      </Link>
      <Heart kind="drink" id={d.id} name={d.name} />
    </li>
  );
}
