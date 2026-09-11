"use client";
/**
 * 관심지역 설정 화면 — 캐치테이블식. 현재 위치로 설정 · 인기 지역 · 최근 설정 지역 · 왼쪽 상위 지역/오른쪽 세부 지역.
 * 수도권은 수도권 전체 › 서울 전체·강남·서초·… › 경기 전체·경기북부·수원·… › 인천 순으로 펼친다. 한 곳만 고른다.
 * 완료를 누르면 저장하고, 검색·전통주 목록 화면이면 그 지역으로 다시 연다(그 밖의 화면이면 전통주 목록으로).
 */
import { childrenOf, level2Of, RBY, REGION_TREE, regionById, regionLabel, TOP_REGIONS, topOf, type Region } from "@pairinggo/shared/regions";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useRegion } from "./RegionProvider";

/** 인기 지역 — 캐치테이블과 같은 다섯 곳. 사진 대신 지역 색 원 */
const POPULAR: { id: string; tone: string }[] = [
  { id: "jeju", tone: "#5B8DB8" }, { id: "seocho", tone: "#6E9B6A" }, { id: "ydp", tone: "#C77D5A" }, { id: "jamsil", tone: "#8B7BB5" }, { id: "hongdae", tone: "#C9A227" },
];

export default function RegionSheet() {
  const rg = useRegion();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pick, setPick] = useState<string>(rg.id);          // 아직 저장 안 한 선택
  const [top, setTop] = useState<string>(topOf(rg.region)); // 왼쪽 열
  const [locating, setLocating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // 열 때마다 현재 값으로 맞춘다
  useEffect(() => { if (rg.isOpen) { setPick(rg.id); setTop(topOf(rg.region)); setMsg(null); } }, [rg.isOpen, rg.id, rg.region]);
  // ESC로 닫기 + 배경 스크롤 잠금
  useEffect(() => {
    if (!rg.isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") rg.close(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [rg.isOpen, rg]);

  if (!rg.isOpen) return null;

  const choose = (id: string) => { setPick(id); const r = regionById(id); setTop(topOf(r)); };
  const done = (id = pick) => {
    rg.setRegion(id);
    rg.close();
    // 검색·목록이면 그 화면을 지역 기준으로 다시 연다. 다른 화면이면 전통주 목록으로 가서 바로 보여 준다
    const q = new URLSearchParams(sp.toString());
    if (id === "all") q.delete("region"); else q.set("region", id);
    const qs = q.toString();
    if (pathname === "/search" || pathname === "/drinks") router.push(`${pathname}${qs ? `?${qs}` : ""}`);
    else router.push(`/drinks${id !== "all" ? `?region=${id}` : ""}`);
  };
  const locate = async () => {
    setLocating(true); setMsg(null);
    const id = await rg.locate();
    setLocating(false);
    if (!id) { setMsg("위치를 가져올 수 없어요. 브라우저의 위치 권한을 확인하거나 아래에서 골라 주세요."); return; }
    setPick(id); setTop(topOf(regionById(id)));
    setMsg(`현재 위치는 ${id === "all" ? "전국" : regionLabel(RBY[id])}로 추정됩니다.`);
  };

  /* 오른쪽 열 — 상위 지역에 따라 */
  const Right = () => {
    if (top === "all") return <Row id="all" label="전국 전체" />;
    if (top === "cap") {
      return (
        <>
          <Row id="cap" label="수도권(서울/경기/인천) 전체" />
          {REGION_TREE.cap.map((l2) => {
            const r = RBY[l2.id];
            const kids = childrenOf(r);
            return (
              <div key={l2.id} className="rs-group">
                <Row id={r.id} label={`${l2.label} 전체`} strong />
                {kids.map((k) => <Row key={k.id} id={k.id} label={k.label} sub />)}
              </div>
            );
          })}
        </>
      );
    }
    const r = RBY[top];
    return <Row id={r.id} label={`${r.label} 전체`} />;
  };
  const Row = ({ id, label, strong, sub }: { id: string; label: string; strong?: boolean; sub?: boolean }) => (
    <button type="button" className={`rs-row${pick === id ? " on" : ""}${strong ? " strong" : ""}${sub ? " sub" : ""}`} onClick={() => choose(id)} aria-pressed={pick === id}>
      <span className="chk" aria-hidden>{pick === id ? "✓" : ""}</span>{label}
    </button>
  );
  const nameOf = (id: string) => { const r = regionById(id); return r ? regionLabel(r) : "전국"; };
  const pathOf = (r: Region | null) => { if (!r) return ""; const l2 = level2Of(r); return l2 && l2.id !== r.id ? `${l2.label === r.label ? "" : regionLabel(l2) + " · "}` : ""; };

  return (
    <div className="rs-back" onClick={rg.close} role="presentation">
      <section className="rs" role="dialog" aria-modal="true" aria-labelledby="rs-title" onClick={(e) => e.stopPropagation()}>
        <header className="rs-head">
          <h2 id="rs-title">관심지역 설정</h2>
          <button type="button" className="rs-loc" onClick={locate} disabled={locating}>◎ {locating ? "위치 확인 중…" : "현재 위치로 설정"}</button>
          <button type="button" className="rs-x" onClick={rg.close} aria-label="닫기">✕</button>
        </header>
        <p className="rs-sub">설정한 지역의 전통주와 주변 식당·판매점을 보여 드려요.</p>
        {msg && <p className="rs-msg">{msg}</p>}

        <div className="rs-body">
          <h3>인기 지역</h3>
          <ul className="rs-pop">
            {POPULAR.map((p) => {
              const r = RBY[p.id];
              return (
                <li key={p.id}>
                  <button type="button" className={pick === p.id ? "on" : undefined} style={{ ["--tone" as string]: p.tone }} onClick={() => choose(p.id)}>
                    <span className="circle"><span>{r.label.split("/").join("\n")}</span></span>
                  </button>
                </li>
              );
            })}
          </ul>

          {rg.recent.length > 0 && (
            <>
              <h3>최근 설정 지역</h3>
              <ul className="rs-recent">
                {rg.recent.map((id) => <li key={id}><button type="button" className={pick === id ? "on" : undefined} onClick={() => choose(id)}>{pathOf(regionById(id))}{nameOf(id)}</button></li>)}
              </ul>
            </>
          )}

          <div className="rs-cols">
            <ul className="rs-left" role="tablist">
              {TOP_REGIONS.map((r) => (
                <li key={r.id}>
                  <button type="button" role="tab" aria-selected={top === r.id} className={top === r.id ? "on" : undefined} onClick={() => setTop(r.id)}>
                    {r.label}{r.id === "cap" && <span className="n">{childrenOf(RBY.seoul).length + childrenOf(RBY.gg).length + 3}</span>}
                  </button>
                </li>
              ))}
            </ul>
            <div className="rs-right" role="tabpanel"><Right /></div>
          </div>
        </div>

        <footer className="rs-foot">
          <button type="button" className="btn" onClick={() => { rg.reset(); setPick("all"); setTop("all"); }}>초기화</button>
          <button type="button" className="btn p" onClick={() => done()} disabled={pick === rg.id && rg.id !== "all"}>
            {pick === "all" ? "전국으로 보기" : `${nameOf(pick)} 설정 완료`}
          </button>
        </footer>
      </section>
    </div>
  );
}
