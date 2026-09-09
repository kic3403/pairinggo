import { Link } from "react-router";
import { DATA } from "@pairinggo/shared";
import { recentStore, savedStore, useRegion, regionStore, toast } from "@/lib/prefs";
import { drainEvents } from "@/lib/analytics";
import { clearCatalogCache, useCatalog } from "@/lib/catalog";
import { apiEnabled } from "@/lib/api";

/** 마이 (Phase 1) — 관심지역·저장 요약·데이터 초기화·안내. Phase 3에서 토스 로그인·성인인증 상태·주문/예약 내역이 붙는다 */
export default function My() {
  const { label } = useRegion();
  const saved = savedStore.use();
  const recent = recentStore.use();
  const catalog = useCatalog();
  const reset = () => {
    if (!confirm("이 기기에 저장된 관심지역·저장·최근 검색을 모두 지울까요?")) return;
    regionStore.write({ id: "all", gps: false, lat: null, lng: null, est: null });
    savedStore.write([]); recentStore.write([]); drainEvents(); clearCatalogCache();
    toast("초기화했어요");
  };
  const catalogLabel = catalog.source === "server" ? `서버 · ${catalog.version.slice(0, 10)}` : "앱 내장";
  const catalogState = !apiEnabled() ? "" : catalog.status === "checking" ? " · 확인 중" : catalog.status === "updated" ? " · 방금 갱신" : catalog.status === "offline" ? " · 서버 연결 안 됨" : "";
  return (
    <main className="px-5 pt-7">
      <h1 className="font-bold text-[24px] tracking-tight">마이</h1>
      <p className="text-[12.5px] text-muted mt-1">로그인 없이 쓸 수 있어요. 저장·최근 검색은 이 기기에만 보관됩니다.</p>

      <div className="card mt-5 divide-y divide-line">
        <Row label="관심지역" value={label} to="/" />
        <Row label="저장" value={`${saved.length}개`} to="/saved" />
        <Row label="최근 검색" value={`${recent.length}건`} to="/related" />
      </div>

      <div className="card mt-4 p-4">
        <div className="text-[11.5px] font-bold tracking-widest text-muted">다음 업데이트</div>
        <ul className="text-[13px] text-ink2 mt-2 leading-relaxed list-disc pl-4">
          <li>토스 로그인으로 저장 목록을 기기 간 동기화</li>
          <li>앱 안에서 전통주 구매 (양조장 직배송, 성인인증)</li>
          <li>내 주변 식당 별점순 목록과 예약</li>
        </ul>
      </div>

      <div className="card mt-4 divide-y divide-line">
        <Row label="데이터" value={`전통주 ${DATA.drinks.length} · 음식 ${DATA.foods.length} · 페어링 ${DATA.pairings.length}`} />
        <Row label="카탈로그" value={catalogLabel + catalogState} />
        <Row label="추천 근거" value="양조장 공식 · 소믈리에·명인 · 전문 매체 · 맛 프로필" />
        <Row label="대중 언급량" value={DATA.trend_meta?.period || "네이버 블로그 실측"} />
      </div>

      <button onClick={reset} className="btn btn-ghost w-full mt-4">이 기기의 데이터 초기화</button>
      <p className="text-[11px] text-muted mt-3 leading-relaxed">페어링GO v0.9 · 문의는 앱인토스 콘솔에 등록된 고객센터 채널로 받습니다.</p>
    </main>
  );
}

function Row({ label, value, to }: { label: string; value: string; to?: string }) {
  const body = <><span className="text-[13px] text-ink2 shrink-0">{label}</span><span className="flex-1 text-right text-[13px] font-semibold truncate">{value}</span>{to && <span className="text-muted">›</span>}</>;
  return to ? <Link to={to} className="flex items-center gap-3 px-4 py-3.5">{body}</Link> : <div className="flex items-center gap-3 px-4 py-3.5">{body}</div>;
}
