"use client";
/**
 * 지역 칩 — 최대 3단. 1단 상위(전국·수도권·부산…), 수도권이면 2단 서울·인천·경기도, 서울/경기도면 3단 세부(강남·서초·… / 경기북부·수원·…).
 * 검색 페이지와 전통주 목록이 같이 쓴다. 칩을 누르면 관심지역도 그걸로 바뀐다(헤더와 같은 상태).
 * URL에 지역이 없는데 관심지역이 있으면 그 지역으로 다시 연다 — 헤더에서 고른 지역이 목록에도 그대로 적용되도록.
 */
import { childrenOf, level2Of, RBY, REGION_TREE, regionById, regionLabel, TOP_REGIONS, topOf } from "@pairinggo/shared/regions";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useRegion } from "./RegionProvider";

type Props = {
  current?: string | null;
  /** 칩이 가리키는 화면 */
  base: "/search" | "/drinks";
  /** 지역 말고 유지할 쿼리(검색어·종류) — 서버 컴포넌트에서 함수는 넘길 수 없어 값으로 받는다 */
  keep?: Record<string, string>;
  /** 결과가 있는 화면에서는 칩 세 줄이 결과를 아래로 민다 — 한 줄로 접고 [바꾸기]로 편다(2026-09-23) */
  collapsible?: boolean;
};

export default function RegionTabs({ current, base, keep = {}, collapsible = false }: Props) {
  const rg = useRegion();
  const [open, setOpen] = useState(false);
  const href = (id: string) => { const qs = new URLSearchParams({ ...keep, ...(id !== "all" ? { region: id } : {}) }).toString(); return `${base}${qs ? `?${qs}` : ""}`; };
  const router = useRouter();
  const cur = regionById(current);
  const top = topOf(cur);
  const l2 = level2Of(cur);
  const kids = childrenOf(l2);

  // URL ↔ 관심지역 맞추기: URL에 지역이 있으면 그게 기준(공유 링크), 없으면 저장된 관심지역으로 연다
  useEffect(() => {
    if (!rg.ready) return;
    if (cur) { if (cur.id !== rg.id) rg.setRegion(cur.id); return; }
    if (rg.id !== "all") router.replace(href(rg.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rg.ready, cur?.id]);

  const Chip = ({ id, label, on }: { id: string; label: string; on: boolean }) => (
    <li><Link href={href(id)} className={on ? "on" : undefined} onClick={() => rg.setRegion(id)}>{label}</Link></li>
  );

  if (collapsible && !open) {
    return (
      <nav aria-label="지역" className="region-nav">
        <p className="region-now">
          지역 <b>{cur ? regionLabel(cur) : "전국"}</b>
          <button type="button" className="linklike" onClick={() => setOpen(true)}>바꾸기</button>
        </p>
      </nav>
    );
  }

  return (
    <nav aria-label="지역" className="region-nav">
      <ul className="tabs region-tabs">
        {TOP_REGIONS.map((r) => <Chip key={r.id} id={r.id} label={r.label} on={r.id === top} />)}
      </ul>
      {top === "cap" && (
        <ul className="tabs region-tabs sub" aria-label="수도권 세부">
          <Chip id="cap" label="전체" on={cur?.id === "cap"} />
          {REGION_TREE.cap.map((s) => <Chip key={s.id} id={s.id} label={s.label} on={l2?.id === s.id} />)}
        </ul>
      )}
      {l2 && kids.length > 0 && (
        <ul className="tabs region-tabs sub sub2" aria-label={`${regionLabel(l2)} 세부`}>
          <Chip id={l2.id} label={`${regionLabel(l2)} 전체`} on={cur?.id === l2.id} />
          {kids.map((k) => <Chip key={k.id} id={k.id} label={k.label} on={cur?.id === k.id} />)}
        </ul>
      )}
      {cur && cur.parent === "cap" && !kids.length && l2 && l2.id !== cur.id && (
        /* 있을 수 없는 조합이지만 안전망: 세부 지역인데 형제 목록이 없으면 이름만 */
        <p className="small muted">{RBY[cur.id].label}</p>
      )}
    </nav>
  );
}
