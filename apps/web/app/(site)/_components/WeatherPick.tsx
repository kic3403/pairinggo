"use client";
/**
 * "오늘 같은 날엔" — 사는 곳 날씨·계절에 맞는 조합 칸(2026-10-02 사용자 요청, docs/29). 홈·술 상세·음식 상세·오늘의 페어링에서 같이 쓴다.
 * 시·도 = 로그인 회원의 프로필 시·도(SavedProvider.user.sido) → 없으면 기기의 관심 지역(RegionProvider) → 없으면 서울(“서울 기준” 표시 + 지역 고르기).
 * 서버 `/api/v1/situation`이 날씨를 보고 고른다(규칙 shared situation.ts). 페어링 카드 순위는 그대로 — 이 칸은 따로 얹는 것.
 * 정적으로 만든 화면(검색 색인)은 바뀌지 않게 브라우저에서만 받아 그린다. 조합이 없으면 칸을 그리지 않는다.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { track } from "@/lib/track";
import { useRegion } from "./RegionProvider";
import { useSaved } from "./SavedProvider";

type Item = { d: string; f: string; drink: string; food: string; dslug: string; fslug: string; category: string; region: string; conf: string; grade: string; fit: "both" | "food" | "drink"; local: boolean };
type Resp = {
  situation: { key: string; headline: string; why: string; icon: string; title: string; temp: number | null; precip: string; fromWeather: boolean; sido: string; assumed: boolean; at: string | null };
  self?: boolean; items: Item[];
};
type Props = { mode: "home" | "drink" | "food"; id?: string; n?: number };

const hourOf = (iso: string) => { const h = new Date(new Date(iso).getTime() + 9 * 3600_000).getUTCHours(); return `${h}시`; };

export default function WeatherPick({ mode, id, n }: Props) {
  const saved = useSaved();
  const region = useRegion();
  const [data, setData] = useState<Resp | null>(null);
  const memberSido = saved.user?.sido ?? null;
  const ready = saved.ready && region.ready;
  useEffect(() => {
    if (!ready) return;
    const q = new URLSearchParams();
    if (memberSido) q.set("sido", memberSido);
    else if (region.id && region.id !== "all") q.set("region", region.id);
    if (mode === "drink" && id) q.set("d", id);
    if (mode === "food" && id) q.set("f", id);
    if (n) q.set("n", String(n));
    let alive = true;
    fetch(`/api/v1/situation?${q}`).then((r) => (r.ok ? r.json() : null)).then((j: Resp | null) => { if (alive) setData(j); }).catch(() => { if (alive) setData(null); });
    return () => { alive = false; };
  }, [ready, memberSido, region.id, mode, id, n]);

  if (!data || !data.items.length) return null;
  const s = data.situation;
  const click = (it: Item, what: "pair" | "drink" | "food") => track("situation_click", { key: s.key, mode, what, d: it.d, f: it.f, weather: s.fromWeather, sido: s.sido });
  const note = [
    s.assumed ? "서울 기준" : s.fromWeather ? `${s.sido} 날씨` : `${s.sido} · 계절 기준`,
    s.fromWeather && s.at ? `기상청 ${hourOf(s.at)} 관측` : null,
  ].filter(Boolean).join(" · ");

  return (
    <section className={`box wx wx-${s.key}${mode === "food" ? " f" : ""}`} aria-labelledby="wx-h">
      <div className="wx-head">
        <span className="wx-icon" aria-hidden>{s.icon}</span>
        <div className="wx-text">
          <h3 id="wx-h">{s.title}</h3>
          <p className="wx-line">{s.headline}</p>
        </div>
      </div>
      {mode === "home" && (
        <ul className="wx-list">
          {data.items.map((it) => (
            <li key={`${it.d}|${it.f}`}>
              <Link className="wx-pair" href={`/foods/${it.fslug}?d=${it.d}`} onClick={() => click(it, "pair")}>
                <b className="wx-d">{it.drink}</b><span className="wx-x">×</span><b className="wx-f">{it.food}</b>
              </Link>
              <span className="wx-meta small muted">{it.grade} · {it.conf}{it.local ? ` · ${it.region} 술` : ""}</span>
            </li>
          ))}
        </ul>
      )}
      {mode === "drink" && (
        <div className="wx-chips">
          {data.self && <span className="small muted">이 술은 오늘 같은 날의 술이에요 — </span>}
          {data.items.map((it) => (
            <Link key={it.f} className="nb-chip" href={`/foods/${it.fslug}?d=${it.d}`} onClick={() => click(it, "food")}>{it.food}<span className="small muted"> · {it.conf}</span></Link>
          ))}
        </div>
      )}
      {mode === "food" && (
        <div className="wx-chips">
          {data.self && <span className="small muted">오늘 같은 날의 음식이에요 — </span>}
          {data.items.map((it) => (
            <Link key={it.d} className="nb-chip" href={`/drinks/${it.dslug}`} onClick={() => click(it, "drink")}>{it.drink}<span className="small muted"> · {it.conf}{it.local ? ` · ${it.region} 술` : ""}</span></Link>
          ))}
        </div>
      )}
      <p className="wx-why small muted">
        {s.why} <span className="wx-note">{note}</span>
        {s.assumed && <> · <button type="button" className="linkish" onClick={region.open}>내 지역으로</button></>}
      </p>
    </section>
  );
}
