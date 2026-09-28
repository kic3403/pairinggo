/**
 * 양조장·식당 추천 페어링 목록(2026-09-29) — 검색 결과·술·음식·매장 화면. 한 줄 = 술 × 음식 · 추천한 곳 · 한 줄 이유 · "비슷한 음식" 칩.
 * 카탈로그에 있는 술·음식은 그 화면으로, 추천한 곳은 매장 화면으로 잇는다. 고르기 규칙은 lib/partner-recs.ts.
 */
import Link from "next/link";
import { FOOD_MATCH_LABEL } from "@pairinggo/shared";
import type { PartnerRec } from "@/lib/partner-recs";

export default function PartnerRecs({ recs, title, hideDrink, hidePlace, note }: { recs: PartnerRec[]; title: string; hideDrink?: boolean; hidePlace?: boolean; note?: string }) {
  if (!recs.length) return null;
  return (
    <section className="partner-recs">
      <h2>{title} <span className="muted small">{recs.length}</span></h2>
      {note && <p className="small muted" style={{ margin: "-4px 0 8px" }}>{note}</p>}
      <ul className="rows">
        {recs.map((r) => (
          <li key={r.id} className="row">
            <span className={`seal${r.kind === "brewery" ? " food" : ""}`} title={r.kind === "brewery" ? "양조장이 직접 추천" : "식당이 직접 추천"}>{r.kind === "brewery" ? "양조장" : "식당"}</span>
            <span className="grow">
              <b>
                {!hideDrink && <>{r.drinkHref ? <Link href={r.drinkHref}>{r.drinkName ?? r.drinkText}</Link> : r.drinkText} <span className="muted">×</span> </>}
                {r.foodHref ? <Link href={r.foodHref}>{r.foodText}</Link> : r.foodText}
              </b>
              <span className="small muted">
                {hidePlace ? null : <><Link href={r.placeHref}>{r.merchantName}</Link> {r.kind === "brewery" ? "제공" : "추천"}</>}
                {r.note ? `${hidePlace ? "" : " — "}${r.note}` : ""}
              </span>
            </span>
            {r.match && FOOD_MATCH_LABEL[r.match] && <span className="small muted" style={{ whiteSpace: "nowrap" }}>{FOOD_MATCH_LABEL[r.match]}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
