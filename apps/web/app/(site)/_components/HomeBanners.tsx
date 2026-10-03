"use client";
/**
 * 홈 배너 캐러셀(2026-09-25, 캐치테이블·데일리샷식) — 옆으로 넘기는 카드, 다음 카드가 살짝 보이고 "n/N 전체 >".
 * scroll-snap으로 손가락·마우스 스크롤, 키보드 ←→. 사진이 있으면 사진 카드, 없으면 색·큰 글자 카드.
 * 2026-10-02 사용자 요청: **자동으로 옆으로 넘어가고**(5초마다) **양쪽 ‹ › 버튼**으로 지나간 카드도 다시 본다.
 * 자동 넘김은 마우스를 올리거나 손을 대거나 초점이 들어와 있으면 멈추고, 탭이 가려져 있거나 '움직임 줄이기' 설정이면 돌지 않는다. ⏸ 버튼으로 끌 수 있다.
 * 2026-10-02 사용자 요청: **처음과 끝이 이어진다** — 카드 묶음을 앞뒤로 한 벌씩 더 그려 두고(가운데가 진짜), 스크롤이 멈췄을 때
 * 복사본 쪽에 있으면 같은 카드의 가운데 묶음 자리로 소리 없이 옮긴다. 복사본은 읽어 주는 기기·키보드에서 감춘다.
 * 카드가 한 화면에 다 들어오면 이어 붙이지 않는다(같은 카드가 나란히 두 번 보이므로).
 */
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { BannerCard } from "@pairinggo/shared/home";
import { useSituation } from "./useSituation";

const GAP = 10, EVERY_MS = 5000;

/** 첫 장 = 사는 곳 날씨·계절 카드(2026-10-03 UI 리뉴얼 — 시안의 큰 배너). 날씨 응답이 오기 전엔 나머지 카드만 */
function useWeatherCard(on: boolean): BannerCard | null {
  const sit = useSituation("home", undefined, 1);
  if (!on || !sit?.items.length) return null;
  const s = sit.situation, it = sit.items[0];
  return { id: "weather", kind: "custom", title: s.headline.replace(/^[^·]*·\s*/, ""), subtitle: `${it.drink} × ${it.food}`, badge: `#오늘 같은 날엔${s.fromWeather ? ` · ${s.sido} ${s.temp === null ? "" : `${Math.round(s.temp)}℃`}` : ""}`.trim(), cta: sit.guide ? "모음 보기" : "오늘의 페어링", href: sit.guide ? `/guide/${sit.guide.slug}` : "/today", tone: "navy", imageUrl: null, period: null };
}

export default function HomeBanners({ cards: given, weather = false }: { cards: BannerCard[]; weather?: boolean }) {
  const ref = useRef<HTMLUListElement>(null);
  const wx = useWeatherCard(weather);
  const cards = wx ? [wx, ...given] : given;
  const n = cards.length;
  const [cur, setCur] = useState(1);
  const [playing, setPlaying] = useState(true);
  /** 이어 붙일지 — 카드가 한 화면에 다 들어오면 버튼·자동 넘김·복사본이 필요 없다 */
  const [loop, setLoop] = useState(false);
  const hold = useRef(false);   // 마우스·손가락·초점이 올라와 있는 동안
  const touching = useRef(false);   // 손가락이 닿아 있는 동안 — 끄는 중에 자리를 옮기면 화면이 튄다

  const step = () => (ref.current?.firstElementChild?.clientWidth || 0) + GAP;
  const go = useCallback((d: 1 | -1) => { ref.current?.scrollBy({ left: d * step(), behavior: "smooth" }); }, []);

  // 카드 묶음 한 벌의 너비가 화면보다 넓을 때만 이어 붙인다
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const measure = () => setLoop(n > 1 && n * step() - GAP > el.clientWidth + 4);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [n]);

  // 복사본이 붙으면 가운데 묶음의 첫 카드에서 시작
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    el.scrollLeft = loop ? n * step() : 0;
  }, [loop, n]);

  useEffect(() => {
    const el = ref.current; if (!el) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const settle = () => {
      if (!loop) return;
      if (touching.current) { t = setTimeout(settle, 200); return; }
      const set = n * step();
      // 복사본 쪽에 멈췄으면 같은 카드의 가운데 묶음 자리로(애니메이션 없이 — 보이는 그림은 같다)
      if (el.scrollLeft < set - 2) el.scrollLeft += set;
      else if (el.scrollLeft >= set * 2 - 2) el.scrollLeft -= set;
    };
    const onScroll = () => {
      const i = Math.round(el.scrollLeft / (step() || 1));
      setCur((((i % n) + n) % n) + 1);
      clearTimeout(t);
      t = setTimeout(settle, 140);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => { el.removeEventListener("scroll", onScroll); clearTimeout(t); };
  }, [loop, n]);

  useEffect(() => {
    if (!playing || !loop) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => { if (!hold.current && !document.hidden) go(1); }, EVERY_MS);
    return () => clearInterval(t);
  }, [playing, loop, go]);

  if (!n) return null;
  const holdOn = () => { hold.current = true; }, holdOff = () => { hold.current = false; };
  const card = (c: BannerCard, copy: string) => (
    <li key={copy + c.id} aria-hidden={copy ? true : undefined}>
      <Link href={c.href} className={`bn tone-${c.tone}${c.imageUrl ? " has-img" : ""}`} tabIndex={copy ? -1 : undefined}>
        {c.imageUrl && <img src={c.imageUrl} alt="" loading="lazy" />}
        <span className="bn-body">
          {c.badge && <span className="bn-badge">{c.badge}</span>}
          <b className="bn-title">{c.title}</b>
          {c.subtitle && <span className="bn-sub">{c.subtitle}</span>}
          <span className="bn-foot">{c.period && <span className="bn-period">{c.period}</span>}<span className="bn-cta">{c.cta} →</span></span>
        </span>
      </Link>
    </li>
  );
  return (
    <section className="banners" aria-label="소식" aria-roledescription="carousel"
      onMouseEnter={holdOn} onMouseLeave={holdOff} onFocus={(e) => { if ((e.target as HTMLElement).matches?.(":focus-visible")) holdOn(); }} onBlur={holdOff} onTouchStart={() => { holdOn(); touching.current = true; }} onTouchEnd={() => { touching.current = false; setTimeout(holdOff, 3000); }} onTouchCancel={() => { touching.current = false; holdOff(); }}>
      <ul className="bn-track" ref={ref} onKeyDown={(e) => { if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); }}>
        {loop && cards.map((c) => card(c, "a-"))}
        {cards.map((c) => card(c, ""))}
        {loop && cards.map((c) => card(c, "b-"))}
      </ul>
      {loop && (
        <>
          <button type="button" className="bn-nav prev" onClick={() => go(-1)} aria-label="이전 소식">‹</button>
          <button type="button" className="bn-nav next" onClick={() => go(1)} aria-label="다음 소식">›</button>
        </>
      )}
      <span className="bn-count">
        {loop && <button type="button" className="bn-play" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "자동 넘김 멈추기" : "자동 넘김 켜기"} aria-pressed={!playing}>{playing ? "❚❚" : "▶"}</button>}
        <Link href="/events" aria-label={`소식 ${cur} / ${n}, 전체 보기`}>{cur} / {n} <b>전체 ›</b></Link>
      </span>
    </section>
  );
}
