import { useState } from "react";
import { useSearchParams } from "react-router";
import { TOP_REGIONS, subRegions, RBY, estimateRegion } from "@pairinggo/shared";
import { setGps, setRegion, toast, useRegion } from "@/lib/prefs";
import NearbyLink from "@/components/NearbyLink";
import { BackHeader } from "@/components/Section";

/**
 * 식당 찾기 (Phase 1 축소판) — 관심지역/현재 위치 기준으로 네이버지도 검색 링크 제공.
 * Phase 3에서 카카오 로컬 API + 앱 내 별점순 리스트로 교체 (docs/05 Phase 3).
 */
export default function Restaurants() {
  const [sp] = useSearchParams();
  const food = sp.get("food") || "";
  const { st, cur, near } = useRegion();
  const [busy, setBusy] = useState(false);
  const useGps = () => {
    if (!navigator.geolocation) { toast("이 기기에서는 위치를 사용할 수 없어요"); return; }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setGps(p.coords.latitude, p.coords.longitude); setBusy(false); const est = estimateRegion(p.coords.latitude, p.coords.longitude); toast(est ? `현재 위치 · ${RBY[est].label} 추정` : "현재 위치 기준"); },
      () => { setBusy(false); toast("위치 권한이 없어요. 관심지역을 골라 주세요"); }, { timeout: 8000, maximumAge: 60000 });
  };
  const queries = food ? [`${food} 맛집`, `${food} 전통주`, `${food} 주점`] : ["전통주 주점", "막걸리 맛집", "한식 주점"];

  return (
    <main className="px-4 pt-4">
      <BackHeader title={food ? `${food} 파는 곳` : "내 주변 식당"} sub={`${near} 기준`} />
      <section className="card p-4 mt-3">
        <div className="text-sm font-bold">어디서 찾을까요?</div>
        <div className="flex flex-wrap gap-2 mt-2.5">
          <button onClick={useGps} disabled={busy} className={`chip ${st.gps ? "on" : ""}`}>{busy ? "확인 중…" : "현재 위치"}</button>
          {TOP_REGIONS.filter((r) => r.id !== "all").map((r) => <button key={r.id} onClick={() => setRegion(r.id)} className={`chip ${!st.gps && (st.id === r.id || cur.parent === r.id) ? "on" : ""}`}>{r.label}</button>)}
        </div>
        <div className="text-[11.5px] font-bold text-ink2 mt-3">수도권 세부</div>
        <div className="flex flex-wrap gap-2 mt-1.5">
          {subRegions("cap").map((r) => <button key={r.id} onClick={() => setRegion(r.id)} className={`chip !text-[12.5px] ${!st.gps && st.id === r.id ? "on" : ""}`}>{r.label}</button>)}
        </div>
      </section>

      <div className="flex flex-col gap-2 mt-4">
        {queries.map((q) => <NearbyLink key={q} name={q} className="btn btn-navy">{near} {q} · 네이버지도 →</NearbyLink>)}
      </div>
      <p className="text-[11px] text-muted mt-4 leading-relaxed">
        지금은 네이버지도 검색으로 연결됩니다. 다음 업데이트에서 앱 안에서 별점순(리뷰 수 보정)·거리순 식당 목록과 예약 가능 매장을 보여드릴 예정이에요.
      </p>
    </main>
  );
}
