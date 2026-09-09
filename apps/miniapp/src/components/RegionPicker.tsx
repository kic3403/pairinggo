import { useState } from "react";
import { RBY, TOP_REGIONS, subRegions, fullLabel, estimateRegion } from "@pairinggo/shared";
import { setGps, setRegion, toast, useRegion } from "@/lib/prefs";

/** 홈 상단: 관심지역 버튼 + '현재 위치' 버튼 + 선택 시트 (Phase 3: navigator.geolocation → 앱인토스 Device.getLocation) */
export default function RegionPicker() {
  const { st, label, cur } = useRegion();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<string | null>(null);
  const activeTab = tab || cur.parent || (subRegions(cur.id).length ? cur.id : null) || "cap";
  const subs = subRegions(activeTab);
  const sel = (id: string) => !st.gps && st.id === id;
  const pick = (id: string) => { setRegion(id); setOpen(false); toast(id === "all" ? "관심지역: 전국" : `관심지역: ${fullLabel(RBY[id])}`); };

  const useGps = () => {
    if (!navigator.geolocation) { toast("이 기기에서는 위치를 사용할 수 없어요"); return; }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setGps(p.coords.latitude, p.coords.longitude); setBusy(false); setOpen(false);
        const est = estimateRegion(p.coords.latitude, p.coords.longitude);
        toast(est ? `현재 위치 기준 · ${RBY[est].label}으로 추정` : "현재 위치 기준으로 검색합니다");
      },
      () => { setBusy(false); toast("위치 권한이 없어요. 관심지역을 직접 골라 주세요"); },
      { timeout: 8000, maximumAge: 600000 },
    );
  };

  return (
    <>
      <div className="flex items-center gap-2 mt-4">
        <button className="region-btn" onClick={() => setOpen(true)} aria-label="관심지역 설정">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z" /><circle cx="12" cy="10" r="2.2" /></svg>
          <span className="truncate">{label}</span><span className="text-[10px] opacity-60">▼</span>
        </button>
        <button className={`gps-btn ${st.gps ? "on" : ""}`} onClick={useGps} disabled={busy}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="8" /></svg>
          {busy ? "위치 확인 중…" : st.gps ? "현재 위치 사용 중" : "현재 위치"}
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="w-full max-w-[430px] bg-surface rounded-t-2xl max-h-[84dvh] overflow-y-auto px-6 pt-4 pb-9" role="dialog" aria-modal="true" aria-label="관심지역 설정">
            <div className="w-9 h-[3px] rounded bg-line mx-auto mb-4" />
            <div className="text-[10.5px] font-bold tracking-widest text-muted">관심지역 설정</div>
            <div className="font-bold text-[22px] mt-1.5 tracking-tight">어느 지역에서 찾을까요?</div>
            <p className="text-[13px] text-ink2 mt-2">식당·판매점 검색과 홈의 지역 술 추천에 적용됩니다.</p>
            <div className={`mt-4 border rounded-xl p-3.5 flex items-center gap-3 ${st.gps ? "border-food" : "border-line"}`}>
              <div className="flex-1 min-w-0">
                <b className="text-[14px]">현재 위치로 검색</b>
                <div className="text-[11.5px] text-muted mt-0.5">{st.gps ? `사용 중${st.est ? ` · ${RBY[st.est].label} 추정` : ""}` : "기기 위치 권한을 허용하면 지금 있는 곳 기준으로 찾아요"}</div>
              </div>
              <button className="btn btn-primary !px-3.5 !py-2.5 !text-[13px]" onClick={useGps} disabled={busy}>{busy ? "확인 중…" : st.gps ? "다시 확인" : "현재 위치"}</button>
            </div>
            <div className="flex mt-4 border-y border-line max-h-[52dvh] min-h-[300px]">
              <div className="flex-none w-[118px] bg-surface2 overflow-y-auto">
                {TOP_REGIONS.map((r) => (
                  <button key={r.id} onClick={() => (r.id === "all" ? pick("all") : setTab(r.id))}
                    className={`flex items-center justify-between w-full text-left px-3 py-3 text-[13.5px] border-l-2 ${activeTab === r.id ? "bg-surface text-ink font-bold border-ink" : "border-transparent"} ${sel(r.id) || (!st.gps && cur.parent === r.id) ? "text-ink font-bold" : "text-ink2"}`}>
                    {r.label}{subRegions(r.id).length ? <span className="text-muted">›</span> : null}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto py-1">
                <button onClick={() => pick(activeTab)} className={`block w-full text-left px-4 py-3 text-[14px] font-bold border-b border-line ${sel(activeTab) ? "text-food-ink" : "text-ink"}`}>{RBY[activeTab].full || `${RBY[activeTab].label} 전체`}{sel(activeTab) && <span className="float-right text-food">✓</span>}</button>
                {subs.map((r) => (
                  <button key={r.id} onClick={() => pick(r.id)} className={`block w-full text-left px-4 py-3 text-[14px] border-b border-line ${["seoul", "gg", "incheon"].includes(r.id) ? "font-bold" : ""} ${sel(r.id) ? "text-food-ink font-bold" : "text-ink"}`}>{r.label}{sel(r.id) && <span className="float-right text-food">✓</span>}</button>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-muted text-center mt-3.5">선택한 지역은 식당·판매점 지도 검색과 홈의 지역 술 추천에 적용됩니다</p>
          </div>
        </div>
      )}
    </>
  );
}
