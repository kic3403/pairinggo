"use client";
/**
 * "오늘 같은 날엔" — 사는 곳 날씨·계절에 맞는 조합 칸(2026-10-02 사용자 요청, docs/29). 홈·술 상세·음식 상세·오늘의 페어링에서 같이 쓴다.
 * 시·도·받기는 useSituation(회원 프로필 시·도 → 기기 관심 지역 → 서울 "서울 기준" + 지역 고르기). 규칙은 shared situation.ts.
 * 페어링 카드 순위는 그대로 — 이 칸은 따로 얹는 것. 정적으로 만든 화면(검색 색인)은 바뀌지 않게 브라우저에서만 받아 그린다. 조합이 없으면 칸을 그리지 않는다.
 * 아래 줄에 그 상황의 모음 화면("비 오는 날 막걸리 안주 추천 →") 링크(2026-10-02, 모음 입구).
 */
import Link from "next/link";
import { track } from "@/lib/track";
import { useRegion } from "./RegionProvider";
import { useSituation, type SituationItem } from "./useSituation";

type Props = { mode: "home" | "drink" | "food"; id?: string; n?: number };

const hourOf = (iso: string) => { const h = new Date(new Date(iso).getTime() + 9 * 3600_000).getUTCHours(); return `${h}시`; };

export default function WeatherPick({ mode, id, n }: Props) {
  const region = useRegion();
  const data = useSituation(mode, id, n);
  if (!data || !data.items.length) return null;
  const s = data.situation;
  const click = (it: SituationItem, what: "pair" | "drink" | "food") => track("situation_click", { key: s.key, mode, what, d: it.d, f: it.f, weather: s.fromWeather, sido: s.sido });
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
              <span className="wx-meta small muted">{it.category} · {it.grade} · {it.conf}{it.local ? ` · ${it.region} 술` : ""}</span>
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
            <Link key={it.d} className="nb-chip" href={`/drinks/${it.dslug}`} onClick={() => click(it, "drink")}>{it.drink}<span className="small muted"> · {it.category}{it.local ? ` · ${it.region}` : ""}</span></Link>
          ))}
        </div>
      )}
      <p className="wx-why small muted">
        {s.why} <span className="wx-note">{note}</span>
        {s.assumed && <> · <button type="button" className="linkish" onClick={region.open}>내 지역으로</button></>}
      </p>
      {data.guide && (
        <p className="wx-guide small">
          <Link href={`/guide/${data.guide.slug}`} onClick={() => track("situation_click", { key: s.key, mode, what: "guide", weather: s.fromWeather, sido: s.sido })}>{data.guide.h1} 모음 →</Link>
        </p>
      )}
    </section>
  );
}
